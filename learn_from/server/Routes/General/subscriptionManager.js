// server/Routes/General/subscriptionManager.js
const runQuery = require("../runQuery");
const { sendSms } = require("../../sms");
const { getSmsAutomationSetting, renderSmsAutomationMessage } = require("./smsAutomationSettings");
const { ensureSubscriptionAuditTable, recordSubscriptionAuditEvent } = require("./subscriptionAudit");
const { ensureAccountingArchiveSchema, getAccountingBaselineBytes, getUsageBytes } = require("./accountingArchive");

function addDays(date, days) {
  return new Date(date.getTime() + Number(days) * 24 * 60 * 60 * 1000);
}

function addHours(date, hours) {
  return new Date(date.getTime() + Number(hours) * 60 * 60 * 1000);
}

function normalizeGhanaPhone(value) {
  if (!value) return null;

  let digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) {
    digits = `0${digits.slice(3)}`;
  }

  return /^0\d{9}$/.test(digits) ? digits : null;
}

async function ensureGuestClient(username) {
  const [existingError, existingClient] = await runQuery(
    "SELECT value, fullname, phone FROM radcheck_client WHERE username = ? LIMIT 1",
    [username],
  );

  if (existingError) {
    console.error("Error checking client account:", existingError);
    throw new Error("Failed to retrieve client details.");
  }

  if (existingClient.length > 0) {
    return { client: existingClient[0], created: false };
  }

  const [conflictError, conflicts] = await runQuery(
    "SELECT username FROM radcheck_client WHERE phone = ? LIMIT 1",
    [username],
  );

  if (conflictError) {
    console.error("Error checking guest client phone conflict:", conflictError);
    throw new Error("Failed to create guest account.");
  }

  if (conflicts.length > 0) {
    throw new Error("Phone number is already linked to another account.");
  }

  const guestClient = {
    value: "12345",
    fullname: "Guest",
    phone: username,
  };

  const [insertError] = await runQuery(
    `INSERT INTO radcheck_client (username, value, fullname, gender, phone, email, hostel, room, role)
     VALUES (?, ?, 'Guest', 'Other', ?, ?, 'None', '', '0')`,
    [username, guestClient.value, username, `${username}@kayfigh.com`],
  );

  if (insertError) {
    console.error("Error creating guest client account:", insertError);
    throw new Error("Failed to create guest account.");
  }

  return { client: guestClient, created: true };
}

function getPaystackTransactionUsername(transaction) {
  const metadataUsername = transaction.metadata?.custom_fields?.find(
    (field) => field.variable_name === "username",
  )?.value;

  return (
    normalizeGhanaPhone(metadataUsername) ||
    normalizeGhanaPhone(transaction.customer?.phone) ||
    normalizeGhanaPhone(transaction.customer?.international_format_phone) ||
    normalizeGhanaPhone(transaction.customer?.email?.split("@")[0]) ||
    normalizeGhanaPhone(transaction.email?.split("@")[0])
  );
}

async function calculatePlanFromAmount(amountPaid) {
  const paidAmount = Number(amountPaid);

  if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
    throw new Error("Invalid payment amount.");
  }

  const [plansError, plans] = await runQuery(
    `SELECT id, plan_name, amount, expire_days,
            fair_use_limit_gb, fair_use_down_kbps, fair_use_up_kbps
     FROM subscription_plans
     WHERE amount > 0 AND expire_days > 0
     ORDER BY amount ASC`,
  );

  if (plansError) {
    console.error("Error fetching subscription plans:", plansError);
    throw new Error("Server error while calculating subscription duration.");
  }

  if (plans.length === 0) {
    throw new Error("No subscription pricing plans are configured.");
  }

  const minimumAmount = Math.max(10, Number(plans[0].amount));
  if (paidAmount < minimumAmount) {
    throw new Error(`Minimum subscription amount is GHS ${minimumAmount}.`);
  }

  const lowerPlan = [...plans].reverse().find((plan) => paidAmount >= Number(plan.amount));
  const higherPlan = plans.find((plan) => Number(plan.amount) > paidAmount);
  let durationDays;
  let fairUseLimitGb;

  if (higherPlan) {
    const lowerAmount = Number(lowerPlan.amount);
    const higherAmount = Number(higherPlan.amount);
    const ratio = (paidAmount - lowerAmount) / (higherAmount - lowerAmount);

    durationDays = Number(lowerPlan.expire_days) + ratio * (Number(higherPlan.expire_days) - Number(lowerPlan.expire_days));
    fairUseLimitGb = Number(lowerPlan.fair_use_limit_gb || 0) + ratio * (Number(higherPlan.fair_use_limit_gb || 0) - Number(lowerPlan.fair_use_limit_gb || 0));
  } else {
    // Continue at the highest configured package rate for amounts above it.
    const multiplier = paidAmount / Number(lowerPlan.amount);
    durationDays = multiplier * Number(lowerPlan.expire_days);
    fairUseLimitGb = multiplier * Number(lowerPlan.fair_use_limit_gb || 0);
  }

  return {
    planId: lowerPlan.id,
    planName: lowerPlan.plan_name,
    planAmount: paidAmount,
    expireDays: durationDays,
    basisAmount: Number(lowerPlan.amount),
    fairUseLimitGb,
    fairUseDownKbps: Number(lowerPlan.fair_use_down_kbps || 0),
    fairUseUpKbps: Number(lowerPlan.fair_use_up_kbps || 0),
  };
}

/**
 * Activates a new subscription for a user.
 * This function handles the entire process of adding a subscription to the database,
 * including calculating expiry dates, and updating radcheck tables.
 * @param {object} subscriptionDetails - The details of the subscription to activate.
 */
async function activateSubscription(subscriptionDetails) {
  const {
    username,
    planId,
    planAmount,
    expireDays,
    expireHours,
    paymentAmount,
    modeOfPayment,
    paidTo,
    paymentRef, // Reference for idempotency
    allowGuestAccount = false,
    confirmationMessage,
    suppressConfirmationSms = false,
    warningSent = false,
    revenueReceived = false,
  } = subscriptionDetails;

  await ensureAccountingArchiveSchema();

  let resolvedPlanId = planId;
  let resolvedPlanAmount = planAmount;
  const resolvedPlanDataLimit = 0;
  let resolvedExpireDays = expireDays;
  let resolvedPlanName = null;
  let fairUseLimitGb = 0;
  let fairUseDownKbps = 0;
  let fairUseUpKbps = 0;
  let calculatedFairUse = null;

  if (expireHours != null) {
    const bonusHours = Number(expireHours);
    if (!Number.isFinite(bonusHours) || bonusHours <= 0) {
      throw new Error("Bonus hours must be greater than zero.");
    }

    resolvedPlanId = "BONUS";
    resolvedPlanAmount = 0;
    resolvedExpireDays = bonusHours / 24;
    resolvedPlanName = `Bonus for ${bonusHours} hours`;
  } else if (paymentAmount != null) {
    const calculatedPlan = await calculatePlanFromAmount(paymentAmount);
    resolvedPlanId = calculatedPlan.planId;
    resolvedPlanAmount = calculatedPlan.planAmount;
    resolvedExpireDays = calculatedPlan.expireDays;
    resolvedPlanName = `${calculatedPlan.planName} rate for GHS ${calculatedPlan.planAmount}`;
    calculatedFairUse = calculatedPlan;
  }

  if (resolvedPlanId !== "BONUS") {
    const [planError, planRows] = await runQuery(
      `SELECT fair_use_limit_gb, fair_use_down_kbps, fair_use_up_kbps
       FROM subscription_plans
       WHERE id = ?
       LIMIT 1`,
      [resolvedPlanId],
    );

    if (planError || planRows.length === 0) {
      console.error("Error fetching fair-use plan settings:", planError);
      throw new Error("Failed to retrieve fair-use plan settings.");
    }

    fairUseLimitGb = Number(planRows[0].fair_use_limit_gb || 0);
    fairUseDownKbps = Number(planRows[0].fair_use_down_kbps || 0);
    fairUseUpKbps = Number(planRows[0].fair_use_up_kbps || 0);

    if (calculatedFairUse) {
      fairUseLimitGb = calculatedFairUse.fairUseLimitGb;
      fairUseDownKbps = calculatedFairUse.fairUseDownKbps;
      fairUseUpKbps = calculatedFairUse.fairUseUpKbps;
    }
  }

  // --- 0. Idempotency Check (Safety Lock) ---
  if (paymentRef) {
    const checkRefQuery = `SELECT id FROM radcheck_subs WHERE payment_ref = ? LIMIT 1`;
    const [checkRefError, checkRefResult] = await runQuery(checkRefQuery, [
      paymentRef,
    ]);

    if (!checkRefError && checkRefResult.length > 0) {
        console.log(
          `[Idempotency] Subscription already active for Ref: ${paymentRef}. Skipping activation.`,
        );
        return { success: true, message: "Subscription already activated.", subscriptionId: checkRefResult[0].id };
    }
  }

  // --- 0.5. Verify Agent/Admin (paidTo) Validity ---
  const systemPaymentReceivers = new Set(["Paystack", "Bonus"]);
  if (paidTo && !systemPaymentReceivers.has(paidTo)) {
    const checkAgentQuery = `SELECT role FROM radcheck_client WHERE username = ? LIMIT 1`;
    const [agentError, agentResult] = await runQuery(checkAgentQuery, [paidTo]);

    if (agentError) {
      console.error("Error verifying agent/admin role:", agentError);
      throw new Error("Server error while verifying agent/admin validity.");
    }

    if (agentResult.length === 0) {
      throw new Error(
        `The specified user (${paidTo}) who received this payment does not exist.`,
      );
    }

    // Role '0' typically represents a subscriber/client, not an agent/admin
    if (agentResult[0].role == "0") {
      throw new Error(
        `The specified user (${paidTo}) is no longer an agent or admin and cannot process payments.`,
      );
    }
  }

  // --- 1. Roll an early purchase into one subscription that starts now ---
  // This preserves both unused validity and unused fair-use data without making
  // customers wait for the current package to expire.
  const startDate = new Date();
  const activeSubQuery = `
    SELECT id, start_date, end_date, fair_use_limit_gb, usage_baseline_bytes
    FROM radcheck_subs 
    WHERE username = ? AND plan_status = 0 AND end_date > NOW() 
    ORDER BY end_date ASC
  `;
  const [activeSubError, activeSubResult] = await runQuery(activeSubQuery, [
    username,
  ]);

  if (activeSubError) {
    console.error("Error checking active subscription:", activeSubError);
    throw new Error("Server error while checking for active subscriptions.");
  }

  let rolloverFairUseLimitGb = 0;
  let rolloverEndDate = null;

  for (const activeSubscription of activeSubResult) {
    const subscriptionEndDate = new Date(activeSubscription.end_date);
    if (!rolloverEndDate || subscriptionEndDate > rolloverEndDate) {
      rolloverEndDate = subscriptionEndDate;
    }

    const subscriptionFairUseLimitGb = Number(activeSubscription.fair_use_limit_gb || 0);
    if (subscriptionFairUseLimitGb <= 0) continue;

    const subscriptionStartDate = new Date(activeSubscription.start_date);
    if (subscriptionStartDate > startDate) {
      // A previously queued package has not started, so all of its allowance rolls over.
      rolloverFairUseLimitGb += subscriptionFairUseLimitGb;
      continue;
    }

    const usedGb = (await getUsageBytes(username, activeSubscription.usage_baseline_bytes)) / (1024 * 1024 * 1024);
    rolloverFairUseLimitGb += Math.max(0, subscriptionFairUseLimitGb - usedGb);
  }

  if (rolloverEndDate) {
    fairUseLimitGb += rolloverFairUseLimitGb;
  }

  const newPackageEndDate = expireHours != null ? addHours(startDate, expireHours) : addDays(startDate, resolvedExpireDays);
  const endDate = rolloverEndDate
    ? new Date(rolloverEndDate.getTime() + (newPackageEndDate.getTime() - startDate.getTime()))
    : newPackageEndDate;

  const formattedStartDate = startDate
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  const formattedEndDate = endDate.toISOString().slice(0, 19).replace("T", " ");

  // --- 3. Insert the new subscription record ---
  // Updated to remove reg_by, amount_paid, pay_status. Added plan_status (default 1).
  let client;
  let guestAccountCreated = false;
  if (allowGuestAccount) {
    const guestResult = await ensureGuestClient(username);
    client = guestResult.client;
    guestAccountCreated = guestResult.created;
  } else {
    const getClientQuery = `SELECT value, fullname, phone FROM radcheck_client WHERE username = ?`;
    const [clientError, clientResult] = await runQuery(getClientQuery, [username]);

    if (clientError || clientResult.length === 0) {
      console.error("Error fetching client details:", clientError);
      throw new Error("Failed to retrieve client details.");
    }

    client = clientResult[0];
  }

  const subsInsertQuery = `
      INSERT INTO radcheck_subs (username, fullname, plan_subs, plan_amount, start_date, end_date, plan_data, mode_of_payment, paid_to, payment_date, payment_ref, plan_status, warning_sent, recieved, fair_use_limit_gb, fair_use_down_kbps, fair_use_up_kbps, usage_baseline_bytes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 0, ?, ?, ?, ?, ?, ?)
    `;
  await ensureSubscriptionAuditTable();
  // Snapshot as close as possible to the subscription insert. From this point
  // forward, the live accounting total minus this baseline is new-plan usage.
  const newUsageBaselineBytes = await getAccountingBaselineBytes(username);
  const [subsError, subsResult] = await runQuery(subsInsertQuery, [
    username,
    client.fullname,
    resolvedPlanId,
    resolvedPlanAmount,
    formattedStartDate,
    formattedEndDate,
    0,
    modeOfPayment,
    paidTo,
    paymentRef,
    warningSent ? 1 : 0,
    revenueReceived ? 1 : 0,
    fairUseLimitGb,
    fairUseDownKbps,
    fairUseUpKbps,
    newUsageBaselineBytes,
  ]);

  if (subsError) {
    console.error("Error inserting into radcheck_subs:", subsError);
    throw new Error("Failed to save new subscription data.");
  }

  const newSubId = subsResult.insertId;

  if (activeSubResult.length > 0) {
    const activeSubscriptionIds = activeSubResult.map((subscription) => subscription.id);
    const placeholders = activeSubscriptionIds.map(() => "?").join(", ");
    const [retireError] = await runQuery(
      `UPDATE radcheck_subs SET plan_status = 1 WHERE id IN (${placeholders}) AND plan_status = 0`,
      activeSubscriptionIds,
    );

    if (retireError) {
      console.error("Error retiring rolled-over subscriptions:", retireError);
      throw new Error("Failed to roll over the existing subscription.");
    }

    const [deleteOldRadcheckError] = await runQuery(
      `DELETE FROM radcheck WHERE username = ? AND plan_id IN (${placeholders})`,
      [username, ...activeSubscriptionIds],
    );

    if (deleteOldRadcheckError) {
      console.error("Error replacing rolled-over RADIUS access:", deleteOldRadcheckError);
      throw new Error("Failed to replace the existing subscription access.");
    }
  }

  // Every new or rolled-over subscription begins at normal speed.
  const [clearThrottleError] = await runQuery(
    `DELETE FROM radreply
     WHERE username = ?
       AND attribute IN ('pfSense-Bandwidth-Max-Down', 'pfSense-Bandwidth-Max-Up')`,
    [username],
  );

  if (clearThrottleError) {
    console.error("Error clearing fair-use RADIUS replies:", clearThrottleError);
    throw new Error("Failed to reset fair-use speed restrictions.");
  }

  // --- 4. Get user's password to update RADIUS ---
  const password = client.value;

  // --- 5. Insert into radcheck for RADIUS authentication ---
  const radcheckInsertQuery = `
      INSERT INTO radcheck (username, fullname, attribute, op, value, expires_at, subscribed_data, plan_id) 
      VALUES (?, ?, 'Cleartext-Password', ':=', ?, ?, ?, ?)
    `;
  const [radcheckError] = await runQuery(radcheckInsertQuery, [
    username,
    client.fullname,
    password,
    formattedEndDate,
    resolvedPlanDataLimit,
    newSubId,
  ]);

  if (radcheckError) {
    console.error("Error inserting into radcheck:", radcheckError);
    throw new Error("Failed to update RADIUS authentication table.");
  }

  await recordSubscriptionAuditEvent({
    subscriptionId: newSubId,
    username,
    eventType: "purchase_activated",
    source: paymentRef ? "payment" : paidTo === "Bonus" ? "system" : "manual",
    actorUsername: paidTo === "Paystack" || paidTo === "Bonus" ? null : paidTo,
    fairUseLimitGb,
    downKbps: fairUseDownKbps,
    upKbps: fairUseUpKbps,
    details: {
      paymentRef: paymentRef || null,
      amount: resolvedPlanAmount,
      usageBaselineBytes: newUsageBaselineBytes,
      rolloverSubscriptionIds: activeSubResult.map((subscription) => subscription.id),
    },
  });

  // New guest accounts need credentials; renewal confirmations must never expose a password.
  const smsExpiry = formattedEndDate.slice(0, 16);
  if (guestAccountCreated && client.phone) {
    await sendSms(
      client.phone,
      `Welcome to KayFi WiFi. Your account is active. Username: ${username}. Temporary password: ${password}. Expires: ${smsExpiry}. Please change your password after logging in.`,
    );
  } else if (suppressConfirmationSms) {
    console.log(`Skipped confirmation SMS for ${username}.`);
  } else if (!client.phone) {
    console.error("Could not find phone number for user to send SMS:", username);
  } else {
    const clientPhone = client.phone;
    let smsMessageText = confirmationMessage;

    if (!smsMessageText) {
      const purchaseConfirmationSetting = await getSmsAutomationSetting("purchase_confirmation");
      if (!purchaseConfirmationSetting.enabled) {
        console.log(`Purchase confirmation SMS is disabled for ${username}.`);
      } else {
        smsMessageText = purchaseConfirmationSetting.message;
      }
    }

    if (smsMessageText) {
      await sendSms(clientPhone, renderSmsAutomationMessage(smsMessageText, { username, expiryDate: smsExpiry }));
    }
  }

  return { success: true, message: "Subscription activated successfully.", subscriptionId: newSubId };
}

module.exports = {
  activateSubscription,
  calculatePlanFromAmount,
  getPaystackTransactionUsername,
  ensureGuestClient,
  normalizeGhanaPhone,
};
