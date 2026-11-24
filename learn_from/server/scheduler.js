const cron = require("node-cron");
const runQuery = require("./Routes/runQuery"); // Adjust path as needed
const { db_new } = require("./db");
const { sendSms } = require("./sms");
const {
  getSmsAutomationSetting,
  renderSmsAutomationMessage,
} = require("./Routes/General/smsAutomationSettings");
const {
  ensureSubscriptionAuditTable,
  recordSubscriptionAuditEvent,
} = require("./Routes/General/subscriptionAudit");
const {
  archiveOldClosedSessions,
  ensureAccountingArchiveSchema,
  getAccountingTotalBytes,
} = require("./Routes/General/accountingArchive");
const axios = require("axios");
const {
  activateSubscription,
  calculatePlanFromAmount,
  getPaystackTransactionUsername,
} = require("./Routes/General/subscriptionManager");

const PAYSTACK_RECONCILE_LOOKBACK_HOURS = 2;
let paystackReconciliationRunning = false;

async function getMinimumSubscriptionPlan() {
  const [err, rows] = await runQuery(
    `SELECT id, amount
     FROM subscription_plans
     WHERE amount > 0 AND expire_days > 0
     ORDER BY amount ASC
     LIMIT 1`,
  );

  if (err) throw err;
  if (rows.length === 0) {
    throw new Error("No subscription pricing plans are configured.");
  }

  return { id: rows[0].id, amount: Number(rows[0].amount) };
}

async function recordPaystackTransaction({
  reference,
  username,
  planId,
  amount,
  email,
  status = "success",
}) {
  await runQuery(
    `INSERT INTO paystack_transactions (reference, username, plan_id, amount, email, status)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE username = VALUES(username), plan_id = VALUES(plan_id), amount = VALUES(amount), email = VALUES(email), status = VALUES(status)`,
    [reference, username, planId, amount, email, status],
  );
}

async function hasSuccessfulPaystackTransaction(reference) {
  const [err, rows] = await runQuery(
    "SELECT id FROM paystack_transactions WHERE reference = ? AND status = 'success' LIMIT 1",
    [reference],
  );
  if (err) throw err;
  return rows.length > 0;
}

async function hasActivatedSubscriptionReference(reference) {
  const [err, rows] = await runQuery(
    "SELECT id FROM radcheck_subs WHERE payment_ref = ? LIMIT 1",
    [reference],
  );
  if (err) throw err;
  return rows.length > 0;
}

async function isPaystackCreditComplete(reference) {
  const [subscriptionActivated, transactionRecorded] = await Promise.all([
    hasActivatedSubscriptionReference(reference),
    hasSuccessfulPaystackTransaction(reference),
  ]);
  return subscriptionActivated && transactionRecorded;
}

async function handleUnderMinimumPaystackPayment({
  reference,
  username,
  paidAmount,
  email,
  minimumPlan,
}) {
  await recordPaystackTransaction({
    reference,
    username,
    planId: minimumPlan.id,
    amount: paidAmount,
    email,
  });

  await runQuery(
    "UPDATE paystack_pending_topups SET status = 'expired' WHERE status = 'pending' AND expires_at <= NOW()",
  );

  const [existingErr, existingRows] = await runQuery(
    "SELECT id, status FROM paystack_pending_topups WHERE reference = ? LIMIT 1",
    [reference],
  );
  if (existingErr) throw existingErr;

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  let isNewTopup = false;
  if (existingRows.length === 0) {
    const [insertErr] = await runQuery(
      `INSERT INTO paystack_pending_topups (username, reference, amount, email, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [username, reference, paidAmount, email, expiresAt],
    );
    if (insertErr) throw insertErr;
    isNewTopup = true;
  } else if (existingRows[0].status !== "pending") {
    return;
  }

  const [sumErr, sumRows] = await runQuery(
    `SELECT COALESCE(SUM(amount), 0) AS total_amount, MIN(expires_at) AS earliest_expiry
     FROM paystack_pending_topups
     WHERE username = ? AND status = 'pending' AND expires_at > NOW()`,
    [username],
  );
  if (sumErr) throw sumErr;

  const totalAmount = Number(sumRows[0]?.total_amount || 0);
  if (totalAmount >= minimumPlan.amount) {
    const calculatedPlan = await calculatePlanFromAmount(totalAmount);
    await activateSubscription({
      username,
      paymentAmount: totalAmount,
      modeOfPayment: 2,
      paidTo: "Paystack",
      paymentRef: reference,
      allowGuestAccount: true,
    });

    await runQuery(
      "UPDATE paystack_pending_topups SET status = 'used', activation_ref = ? WHERE username = ? AND status = 'pending' AND expires_at > NOW()",
      [reference, username],
    );

    await recordPaystackTransaction({
      reference,
      username,
      planId: calculatedPlan.planId,
      amount: paidAmount,
      email,
    });

    console.log(
      `Activated ${username} from accumulated Paystack topups totaling GHS ${totalAmount}.`,
    );
    return;
  }

  if (isNewTopup) {
    const remainingAmount = (minimumPlan.amount - totalAmount).toFixed(2);
    const message = `Hello, GHS ${paidAmount.toFixed(2)} received for account ${username}. Top up GHS ${remainingAmount} within 1hr to activate.`;
    await sendSms(username, message);
  }

  console.log(
    `Stored under-minimum Paystack topup for ${username}: GHS ${paidAmount}. Current pending total: GHS ${totalAmount}.`,
  );
}

async function getPendingTopupTotal(username) {
  await runQuery(
    "UPDATE paystack_pending_topups SET status = 'expired' WHERE status = 'pending' AND expires_at <= NOW()",
  );

  const [err, rows] = await runQuery(
    `SELECT COALESCE(SUM(amount), 0) AS total_amount
     FROM paystack_pending_topups
     WHERE username = ? AND status = 'pending' AND expires_at > NOW()`,
    [username],
  );
  if (err) throw err;

  return Number(rows[0]?.total_amount || 0);
}

async function markPendingTopupsUsed(username, activationRef) {
  await runQuery(
    "UPDATE paystack_pending_topups SET status = 'used', activation_ref = ? WHERE username = ? AND status = 'pending' AND expires_at > NOW()",
    [activationRef, username],
  );
}

/**
 * This job finds and deactivates subscriptions that have expired either
 * due to time running out or data being exhausted.
 * It replicates the logic from the original MySQL event scheduler.
 */
const deactivateExpiredPlans = async () => {
  console.log("Running job: deactivateExpiredPlans...");
  try {
    // --- 1. Flag plans expired by time ---
    const timeExpiredQuery = `
      UPDATE radcheck_subs s
      JOIN radcheck r ON s.id = r.plan_id
      SET s.plan_status = 1, r.active = 1
      WHERE s.end_date <= NOW() AND s.plan_status = 0;
    `;
    const [timeErr, timeResult] = await runQuery(timeExpiredQuery);
    if (timeErr) {
      console.error("Error flagging time-expired plans:", timeErr);
    } else {
      console.log(
        `Flagged ${timeResult.affectedRows} plans as expired by time.`,
      );
    }

    // --- 2. Delete flagged records from radcheck to revoke access ---
    const deleteQuery = `DELETE FROM radcheck WHERE active = 1`;
    const [delErr, delResult] = await runQuery(deleteQuery);
    if (delErr) {
      console.error("Error deleting deactivated plans from radcheck:", delErr);
    } else {
      console.log(
        `Deleted ${delResult.affectedRows} deactivated plans from radcheck.`,
      );
    }
  } catch (error) {
    console.error(
      "An unexpected error occurred in deactivateExpiredPlans job:",
      error,
    );
  }
};

/**
 * Applies the pfSense bandwidth replies after an active subscription reaches
 * its stored fair-use threshold. pfSense reauthenticates connected users each minute.
 */
const applyFairUseThrottles = async () => {
  try {
    await ensureSubscriptionAuditTable();
    await ensureAccountingArchiveSchema();
    let fairUseThrottleSetting = { enabled: false };
    try {
      fairUseThrottleSetting =
        await getSmsAutomationSetting("fair_use_throttle");
    } catch (settingsError) {
      console.error(
        "Failed to load fair-use throttle SMS settings:",
        settingsError,
      );
    }
    const [queryError, subscriptions] = await runQuery(
      `SELECT
         s.id,
         s.username,
          s.end_date,
           s.fair_use_down_kbps,
           s.fair_use_up_kbps,
           s.usage_baseline_bytes,
           s.fair_use_pending_at,
           s.fair_use_pending_usage_bytes,
          c.phone
        FROM radcheck_subs s
        JOIN radcheck_client c ON c.username = s.username
       WHERE s.plan_status = 0
         AND s.start_date <= NOW()
         AND s.end_date > NOW()
          AND s.fair_use_limit_gb > 0
          AND s.fair_use_throttled = 0
          AND s.fair_use_super_throttled = 0`,
    );

    if (queryError) throw queryError;

    for (const candidate of subscriptions) {
      const connection = await db_new.getConnection();
      let appliedSubscription = null;
      let usageBytes = 0;

      try {
        await connection.beginTransaction();
        const [lockedRows] = await connection.query(
          `SELECT id, username, start_date, end_date, fair_use_limit_gb,
                  fair_use_down_kbps, fair_use_up_kbps, usage_baseline_bytes,
                  fair_use_pending_at, fair_use_pending_usage_bytes,
                  TIMESTAMPDIFF(SECOND, fair_use_pending_at, NOW()) AS pending_age_seconds
           FROM radcheck_subs
           WHERE id = ?
             AND plan_status = 0
             AND start_date <= NOW()
             AND end_date > NOW()
             AND fair_use_throttled = 0
             AND fair_use_super_throttled = 0
           FOR UPDATE`,
          [candidate.id],
        );
        if (lockedRows.length === 0) {
          await connection.rollback();
          continue;
        }

        appliedSubscription = lockedRows[0];
        const accountingTotalBytes = await getAccountingTotalBytes(
          appliedSubscription.username,
          connection,
        );
        usageBytes = Math.max(
          0,
          accountingTotalBytes - Number(appliedSubscription.usage_baseline_bytes || 0),
        );
        if (accountingTotalBytes < Number(appliedSubscription.usage_baseline_bytes || 0)) {
          const [regressionEvents] = await connection.query(
            `SELECT id
             FROM subscription_audit_events
             WHERE subscription_id = ?
               AND event_type = 'accounting_regression_detected'
             LIMIT 1`,
            [appliedSubscription.id],
          );
          if (regressionEvents.length === 0) {
            await recordSubscriptionAuditEvent(
              {
                subscriptionId: appliedSubscription.id,
                username: appliedSubscription.username,
                eventType: "accounting_regression_detected",
                source: "automatic",
                usageBytes,
                fairUseLimitGb: appliedSubscription.fair_use_limit_gb,
                details: {
                  accountingTotalBytes,
                  usageBaselineBytes: appliedSubscription.usage_baseline_bytes,
                },
              },
              connection,
            );
          }
        }
        const limitBytes =
          Number(appliedSubscription.fair_use_limit_gb) * 1024 * 1024 * 1024;
        if (usageBytes < limitBytes) {
          if (appliedSubscription.fair_use_pending_at) {
            await connection.query(
              "UPDATE radcheck_subs SET fair_use_pending_at = NULL, fair_use_pending_usage_bytes = NULL WHERE id = ?",
              [appliedSubscription.id],
            );
          }
          await connection.commit();
          continue;
        }

        if (!appliedSubscription.fair_use_pending_at) {
          await connection.query(
            "UPDATE radcheck_subs SET fair_use_pending_at = NOW(), fair_use_pending_usage_bytes = ? WHERE id = ?",
            [usageBytes, appliedSubscription.id],
          );
          await connection.commit();
          continue;
        }

        if (Number(appliedSubscription.pending_age_seconds) < 5 * 60) {
          await connection.rollback();
          continue;
        }

        const downBps = Number(appliedSubscription.fair_use_down_kbps) * 1000;
        const upBps = Number(appliedSubscription.fair_use_up_kbps) * 1000;
        if (downBps <= 0 || upBps <= 0) {
          await connection.rollback();
          continue;
        }

        await connection.query(
          `DELETE FROM radreply
           WHERE username = ?
             AND attribute IN ('pfSense-Bandwidth-Max-Down', 'pfSense-Bandwidth-Max-Up')`,
          [appliedSubscription.username],
        );
        await connection.query(
          `INSERT INTO radreply (username, attribute, op, value)
           VALUES
             (?, 'pfSense-Bandwidth-Max-Down', ':=', ?),
             (?, 'pfSense-Bandwidth-Max-Up', ':=', ?)`,
          [
            appliedSubscription.username,
            String(downBps),
            appliedSubscription.username,
            String(upBps),
          ],
        );
        await connection.query(
          `UPDATE radcheck_subs
           SET fair_use_throttled = 1,
               fair_use_throttled_at = NOW(),
               fair_use_pending_at = NULL,
               fair_use_pending_usage_bytes = NULL
           WHERE id = ?`,
          [appliedSubscription.id],
        );
        await recordSubscriptionAuditEvent(
          {
            subscriptionId: appliedSubscription.id,
            username: appliedSubscription.username,
            eventType: "fair_use_throttled",
            source: "automatic",
            usageBytes,
            fairUseLimitGb: appliedSubscription.fair_use_limit_gb,
            downKbps: appliedSubscription.fair_use_down_kbps,
            upKbps: appliedSubscription.fair_use_up_kbps,
            details: {
              firstObservedUsageBytes: appliedSubscription.fair_use_pending_usage_bytes,
              confirmationIntervalMinutes: 5,
            },
          },
          connection,
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

      console.log(
        `Applied fair-use throttle to ${appliedSubscription.username}.`,
      );
      if (fairUseThrottleSetting.enabled) {
        await sendSms(
          candidate.phone || appliedSubscription.username,
          renderSmsAutomationMessage(fairUseThrottleSetting.message, {
            username: appliedSubscription.username,
            expiryDate: new Date(appliedSubscription.end_date)
              .toISOString()
              .slice(0, 16)
              .replace("T", " "),
          }),
        );
      }
    }
  } catch (error) {
    console.error(
      "An unexpected error occurred in applyFairUseThrottles job:",
      error,
    );
  }
};

/**
 * This job finds subscriptions that are about to expire and sends an SMS warning.
 * It runs every 10 minutes.
 */
const sendExpirationWarnings = async () => {
  console.log("Running job: sendExpirationWarnings...");
  try {
    const expiryWarningSetting =
      await getSmsAutomationSetting("expiry_warning");
    if (!expiryWarningSetting.enabled) {
      console.log("Expiration warning SMS is disabled.");
      return;
    }

    // --- 1. Handle Time-Based Warnings ---
    const timeQuery = `
      SELECT s.id, s.username, c.phone, s.end_date, p.plan_name
      FROM radcheck_subs s
      JOIN radcheck_client c ON s.username = c.username
      JOIN subscription_plans p ON s.plan_subs = p.id
      WHERE s.plan_status = 0 
        AND s.warning_sent = 0
        AND s.end_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 3 HOUR);
    `;
    const [timeErr, timeResults] = await runQuery(timeQuery);

    if (timeErr) {
      console.error("Error fetching subs for time-based warnings:", timeErr);
    } else if (timeResults.length > 0) {
      console.log(
        `Found ${timeResults.length} plans expiring soon (time). Sending notifications...`,
      );
      let sentCount = 0;
      let skippedCount = 0;

      for (const sub of timeResults) {
        const [nextSubErr, nextSubRows] = await runQuery(
          `SELECT id
           FROM radcheck_subs
           WHERE username = ?
             AND id <> ?
             AND plan_status = 0
             AND (
               end_date > ?
               OR (end_date = ? AND id > ?)
             )
           LIMIT 1`,
          [sub.username, sub.id, sub.end_date, sub.end_date, sub.id],
        );

        if (nextSubErr) {
          console.error(
            `Error checking later active subscriptions for ${sub.username}:`,
            nextSubErr,
          );
          continue;
        }

        // Claim the row before any SMS side effect. This prevents duplicate SMS
        // if another scheduler process picked the same subscription concurrently.
        const [claimErr, claimResult] = await runQuery(
          "UPDATE radcheck_subs SET warning_sent = 1 WHERE id = ? AND warning_sent = 0",
          [sub.id],
        );

        if (claimErr) {
          console.error(
            `Error marking expiration warning for ${sub.username} subscription ${sub.id}:`,
            claimErr,
          );
          continue;
        }

        if (!claimResult.affectedRows) {
          console.log(
            `Skipped expiration SMS for ${sub.username} subscription ${sub.id}; warning was already claimed.`,
          );
          continue;
        }

        if (nextSubRows.length > 0) {
          skippedCount++;
          console.log(
            `Skipped expiration SMS for ${sub.username} subscription ${sub.id}; later active subscription exists.`,
          );
          continue;
        }

        const message = renderSmsAutomationMessage(
          expiryWarningSetting.message,
          {
            username: sub.username,
            expiryDate: new Date(sub.end_date)
              .toISOString()
              .slice(0, 16)
              .replace("T", " "),
          },
        );
        await sendSms(sub.phone, message);
        sentCount++;
      }

      console.log(
        `Expiration warnings processed. SMS sent: ${sentCount}. SMS skipped: ${skippedCount}.`,
      );
    }

    console.log(
      `Expiration warning job finished. Time warnings: ${timeResults.length}.`,
    );
  } catch (error) {
    console.error(
      "An unexpected error occurred in sendExpirationWarnings job:",
      error,
    );
  }
};

/**
 * This job finds pending Paystack transactions and verifies them.
 * It activates the subscription if the payment was successful.
 */
const verifyPendingPaystackPayments = async () => {
  console.log("Running job: verifyPendingPaystackPayments...");
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      console.error("PAYSTACK_SECRET_KEY not found in environment variables.");
      return;
    }

    // Fetch pending transactions older than 2 minutes and younger than 1 hour
    const sql = `
      SELECT * FROM paystack_transactions 
      WHERE status = 'pending' 
      AND created_at < DATE_SUB(NOW(), INTERVAL 2 MINUTE)
      AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `;
    const [err, pendingTransactions] = await runQuery(sql);

    if (err) {
      console.error("Error fetching pending Paystack transactions:", err);
      return;
    }

    if (pendingTransactions.length === 0) {
      console.log("No pending Paystack transactions to verify.");
    } else {
      console.log(
        `Verifying ${pendingTransactions.length} pending transactions...`,
      );
    }

    for (const tx of pendingTransactions) {
      try {
        if (await hasSuccessfulPaystackTransaction(tx.reference)) {
          console.log(
            `Skipping ${tx.reference}: already recorded as successful.`,
          );
          continue;
        }

        const response = await axios.get(
          `https://api.paystack.co/transaction/verify/${tx.reference}`,
          {
            headers: { Authorization: `Bearer ${secretKey}` },
          },
        );

        const data = response.data.data;
        console.log(
          `Reference: ${tx.reference} | Paystack Status: ${data.status}`,
        );

        if (data.status === "success") {
          const paidAmount = Number(data.amount) / 100;
          const minimumPlan = await getMinimumSubscriptionPlan();
          if (paidAmount < minimumPlan.amount) {
            await handleUnderMinimumPaystackPayment({
              reference: tx.reference,
              username: tx.username,
              paidAmount,
              email: tx.email,
              minimumPlan,
            });
            continue;
          }

          const pendingTopupTotal = await getPendingTopupTotal(tx.username);
          const activationAmount = paidAmount + pendingTopupTotal;
          const calculatedPlan =
            await calculatePlanFromAmount(activationAmount);
          const subscriptionDetails = {
            username: tx.username,
            paymentAmount: activationAmount,
            modeOfPayment: 2,
            paidTo: "Paystack",
            paymentRef: tx.reference,
            allowGuestAccount: true,
          };

          await activateSubscription(subscriptionDetails);
          if (pendingTopupTotal > 0) {
            await markPendingTopupsUsed(tx.username, tx.reference);
          }

          await recordPaystackTransaction({
            reference: tx.reference,
            username: tx.username,
            planId: calculatedPlan.planId,
            amount: paidAmount,
            email: tx.email,
          });
          console.log(`Activated subscription for ${tx.username} via cron.`);
        } else if (data.status === "failed" || data.status === "reversed") {
          // Update status in paystack_transactions
          await runQuery(
            "UPDATE paystack_transactions SET status = ? WHERE id = ?",
            [data.status, tx.id],
          );
          console.log(`Transaction ${tx.reference} marked as ${data.status}.`);
        }
      } catch (reqErr) {
        console.error(
          `Error verifying reference ${tx.reference}:`,
          reqErr.message,
        );
      }
    }

  } catch (error) {
    console.error(
      "An unexpected error occurred in verifyPendingPaystackPayments job:",
      error,
    );
  } finally {
    // Reconciliation remains available even if the narrow pending-payment check fails.
    await reconcilePaystackTransactions();
  }
};

/**
 * Reconciles successful Paystack payments directly from Paystack.
 * This catches cases where our local paystack_transactions insert failed.
 */
const reconcilePaystackTransactions = async () => {
  if (paystackReconciliationRunning) {
    console.log("Skipped overlapping Paystack reconciliation run.");
    return;
  }

  paystackReconciliationRunning = true;
  console.log("Running job: reconcilePaystackTransactions...");

  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      console.error("PAYSTACK_SECRET_KEY not found in environment variables.");
      return;
    }

    const to = new Date();
    const from = new Date(
      Date.now() - PAYSTACK_RECONCILE_LOOKBACK_HOURS * 60 * 60 * 1000,
    );

    const transactions = [];
    let page = 1;
    let pageCount = 1;

    do {
      const response = await axios.get("https://api.paystack.co/transaction", {
        headers: { Authorization: `Bearer ${secretKey}` },
        params: {
          status: "success",
          perPage: 100,
          page,
          from: from.toISOString(),
          to: to.toISOString(),
        },
      });
      transactions.push(...(response.data?.data || []));
      pageCount = Number(response.data?.meta?.pageCount || 1);
      page += 1;
    } while (page <= pageCount);

    console.log(
      `Reconciling ${transactions.length} successful Paystack transactions from the last ${PAYSTACK_RECONCILE_LOOKBACK_HOURS} hours.`,
    );

    for (const transaction of transactions) {
      try {
        const reference = transaction.reference;
        if (!reference) continue;

        if (await isPaystackCreditComplete(reference)) {
          continue;
        }

        const username = getPaystackTransactionUsername(transaction);
        const paidAmount = Number(transaction.amount) / 100;
        const email = transaction.customer?.email || transaction.email || null;

        if (!username || paidAmount <= 0) {
          console.warn(
            `Skipping Paystack reference ${reference}: missing username metadata or amount.`,
          );
          continue;
        }

        // A previous activation may have completed just before its local payment
        // status was written. Repair that status without issuing a second package.
        if (await hasActivatedSubscriptionReference(reference)) {
          const calculatedPlan = await calculatePlanFromAmount(paidAmount);
          await recordPaystackTransaction({
            reference,
            username,
            planId: calculatedPlan.planId,
            amount: paidAmount,
            email,
          });
          console.log(`Reconciled local success status for Paystack reference ${reference}.`);
          continue;
        }

        const [topupErr, topupRows] = await runQuery(
          "SELECT status FROM paystack_pending_topups WHERE reference = ? LIMIT 1",
          [reference],
        );
        if (topupErr) throw topupErr;
        if (topupRows.length > 0 && topupRows[0].status !== "pending") {
          continue;
        }

        const minimumPlan = await getMinimumSubscriptionPlan();
        if (paidAmount < minimumPlan.amount) {
          await handleUnderMinimumPaystackPayment({
            reference,
            username,
            paidAmount,
            email,
            minimumPlan,
          });
          continue;
        }

        const pendingTopupTotal = await getPendingTopupTotal(username);
        const activationAmount = paidAmount + pendingTopupTotal;
        const calculatedPlan = await calculatePlanFromAmount(activationAmount);

        await activateSubscription({
          username,
          paymentAmount: activationAmount,
          modeOfPayment: 2,
          paidTo: "Paystack",
          paymentRef: reference,
          allowGuestAccount: true,
        });
        if (pendingTopupTotal > 0) {
          await markPendingTopupsUsed(username, reference);
        }

        await recordPaystackTransaction({
          reference,
          username,
          planId: calculatedPlan.planId,
          amount: paidAmount,
          email,
        });

        console.log(
          `Reconciled Paystack reference ${reference} and activated subscription for ${username}.`,
        );
      } catch (transactionErr) {
        console.error(
          `Error reconciling Paystack reference ${transaction.reference}:`,
          transactionErr.message,
        );
      }
    }
  } catch (error) {
    console.error(
      "An unexpected error occurred in reconcilePaystackTransactions job:",
      error.response?.data || error.message,
    );
  } finally {
    paystackReconciliationRunning = false;
  }
};

// Schedule the jobs
// Runs every 5 minutes
cron.schedule("*/20 * * * *", deactivateExpiredPlans);

// Confirm threshold readings five minutes apart before applying a fair-use throttle.
cron.schedule("*/5 * * * *", applyFairUseThrottles);

// Runs every 10 minutes
cron.schedule("*/20 * * * *", sendExpirationWarnings);

// Retain recent and active sessions in radacct; preserve older closed sessions in the archive.
cron.schedule("0 3 1 * *", async () => {
  try {
    const archived = await archiveOldClosedSessions();
    console.log(`Archived ${archived} closed RADIUS accounting sessions.`);
  } catch (error) {
    console.error(
      "An unexpected error occurred in monthly accounting archive job:",
      error,
    );
  }
});

// Runs every 1 minutes
cron.schedule("* * * * *", verifyPendingPaystackPayments);

console.log("Scheduler initialized. Jobs are scheduled.");

module.exports = {
  deactivateExpiredPlans,
  applyFairUseThrottles,
  sendExpirationWarnings,
  reconcilePaystackTransactions,
};
