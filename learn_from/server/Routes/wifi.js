const express = require("express");
const router = express.Router();
const runQuery = require("./runQuery");
const crypto = require("crypto");
const axios = require("axios"); // Import axios
const { sendApprovalEmail } = require("./General/email");
const {
  ensureAccountingArchiveSchema,
  getUsageBytes,
} = require("./General/accountingArchive");
const {
  activateSubscription,
  calculatePlanFromAmount,
  getPaystackTransactionUsername,
} = require("./General/subscriptionManager");

async function hasSuccessfulPaystackTransaction(reference) {
  const [err, rows] = await runQuery(
    "SELECT id FROM paystack_transactions WHERE reference = ? AND status = 'success' LIMIT 1",
    [reference],
  );
  if (err) throw err;
  return rows.length > 0;
}

// Verify Paystack Payment
router.post("/verify-payment", async (req, res) => {
  const { reference, username } = req.body;

  console.log("--> [Payment Verify] Request Received:", {
    reference,
    username,
  });

  if (!reference || !username) {
    console.error("--> [Payment Verify] Missing details");
    return res
      .status(400)
      .json({ message: "Missing required payment details.", code: 2 });
  }

  try {
    await ensureAccountingArchiveSchema();
    if (await hasSuccessfulPaystackTransaction(reference)) {
      return res.json({
        code: 1,
        message: "Payment already processed.",
      });
    }

    // 1. Verify transaction with Paystack
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    console.log("--> [Payment Verify] Verifying with Paystack...");

    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
    );

    const { status, amount } = paystackResponse.data.data;
    console.log(
      "--> [Payment Verify] Paystack Status:",
      status,
      "| Amount:",
      amount,
    );

    if (status !== "success") {
      console.warn(
        "--> [Payment Verify] Verification Failed: Status is not success",
      );
      return res.status(400).json({
        message: "Payment verification failed. Status not success.",
        code: 2,
      });
    }

    const paidAmount = Number(amount) / 100;

    // Idempotency Check: Ensure this reference hasn't already given a subscription
    // We check if a subscription exists with this specific 'payment_ref' (need to add column or check logic)
    // For now, let's assume if the verification is manually called, we process it.
    // Ideally, you should store the transaction reference in the database to prevent duplicates.

    // 3. Activate Subscription
    console.log("--> [Payment Verify] Activating Subscription...");
    const subscriptionDetails = {
      username: username,
      paymentAmount: paidAmount,
      modeOfPayment: 2, // Mobile Money (assumed)
      paidTo: "Paystack",
      paymentRef: reference, // Pass reference for Idempotency
      allowGuestAccount: true,
    };

    const activationResult = await activateSubscription(subscriptionDetails);
    console.log("--> [Payment Verify] Subscription Activated Successfully.");

    res.json({
      code: 1,
      message: "Payment verified and subscription activated successfully.",
      data: activationResult,
    });
  } catch (error) {
    console.error(
      "--> [Payment Verify] Error:",
      error.response?.data || error.message,
    );
    res.status(500).json({
      message: "Server error verifying payment.",
      code: 2,
      error: error.message,
    });
  }
});

// Paystack Webhook Endpoint
router.post("/webhook", async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  // 1. Verify Signature
  const hash = crypto
    .createHmac("sha512", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"]) {
    console.warn("--> [Webhook] Invalid signature. Ignoring request.");
    return res.status(400).send("Invalid signature");
  }

  // 2. Acknowledge Receipt Immediately (Best Practice)
  res.sendStatus(200);

  const event = req.body;
  console.log("--> [Webhook] Event Received:", event.event);

  if (event.event === "charge.success") {
    const { reference, amount, metadata } = event.data;
    const username = getPaystackTransactionUsername(event.data);

    console.log(
      "--> [Webhook] Processing Success Charge for:",
      username,
      "| Ref:",
      reference,
    );

    if (!username) {
      console.error(
        "--> [Webhook] Missing metadata (username). Cannot activate.",
      );
      return;
    }

    try {
      if (await hasSuccessfulPaystackTransaction(reference)) {
        console.log("--> [Webhook] Payment already processed:", reference);
        return;
      }

      const paidAmount = Number(amount) / 100;
      const calculatedPlan = await calculatePlanFromAmount(paidAmount);

      // 4. Idempotency Check (Prevent Double Activation)
      // Check if this reference was already processed in pending_payments or check logs.
      // Since we don't have a dedicated 'transactions' table with unique refs yet,
      // we risk double activation if the user clicked verify AND webhook fires.
      // TODO: Create a 'transactions' table to track processed references.

      // For now, proceed with activation.
      const subscriptionDetails = {
        username: username,
        paymentAmount: paidAmount,
        modeOfPayment: 2,
        paidTo: "Paystack",
        paymentRef: reference, // Pass reference for Idempotency
        allowGuestAccount: true,
      };

      await activateSubscription(subscriptionDetails);
      console.log(
        "--> [Webhook] Subscription activated via Webhook for:",
        username,
      );

      // Update paystack_transactions table
      await runQuery(
        `INSERT INTO paystack_transactions (reference, username, plan_id, amount, email, status)
         VALUES (?, ?, ?, ?, ?, 'success')
         ON DUPLICATE KEY UPDATE username = VALUES(username), plan_id = VALUES(plan_id), amount = VALUES(amount), email = VALUES(email), status = 'success'`,
        [
          reference,
          username,
          calculatedPlan.planId,
          paidAmount,
          event.data.customer?.email || event.data.email || null,
        ],
      );
    } catch (error) {
      console.error(
        "--> [Webhook] Error processing activation:",
        error.message,
      );
    }
  }
});

// Get WiFi Dashboard Data
router.post("/dashboard", async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  try {
    // Get latest subscription details
    const subsQuery = `
      SELECT a.*, sp.plan_name, DATE_FORMAT(a.end_date, '%d-%m-%Y, %h:%i %p') AS formatted_end_date 
      FROM radcheck_subs AS a
      JOIN subscription_plans sp ON a.plan_subs = sp.id
      WHERE a.username = ? 
      ORDER BY a.id DESC 
      LIMIT 1
    `;
    const [subsError, subsResult] = await runQuery(subsQuery, [username]);

    if (subsError) {
      console.error("Error fetching subscription data:", subsError);
      return res.status(500).json({ error: "Internal server error" });
    }

    let planName = null;
    let formattedEndDate = null;
    let planStatus = "Inactive";
    let rawEndDate = null;
    let subscriptionStartDate = null;
    let fairUseLimitGb = 0;
    let fairUseThrottled = false;
    let fairUseSuperThrottled = false;

    if (subsResult.length > 0) {
      planName = subsResult[0].plan_name;
      formattedEndDate = subsResult[0].formatted_end_date;
      rawEndDate = subsResult[0].end_date;
      subscriptionStartDate = subsResult[0].start_date;
      fairUseLimitGb = Number(subsResult[0].fair_use_limit_gb || 0);
      fairUseThrottled = Boolean(subsResult[0].fair_use_throttled);
      fairUseSuperThrottled = Boolean(subsResult[0].fair_use_super_throttled);

      // Calculate plan status
      if (new Date(subsResult[0].end_date) > new Date()) {
        planStatus = "Active";
      }
    }

    let dataUsed = "0.00 GB";
    let dataUsedVal = 0;
    if (subsResult.length > 0) {
      dataUsedVal =
        (await getUsageBytes(username, subsResult[0].usage_baseline_bytes)) /
        (1024 * 1024 * 1024);
      dataUsed = `${dataUsedVal.toFixed(2)} GB`;
    }

    // Get user details
    const userQuery = `SELECT fullname, email, phone FROM radcheck_client WHERE username = ?`;
    const [userError, userResult] = await runQuery(userQuery, [username]);

    let email = "";
    let fullname = "";
    let phone = "";
    if (!userError && userResult.length > 0) {
      email = userResult[0].email;
      fullname = userResult[0].fullname;
      phone = userResult[0].phone;
    }

    // Get last 5 transactions
    const transQuery = `
      SELECT rs.id, DATE_FORMAT(rs.payment_date, '%d-%m-%Y, %h:%i %p') as formatted_date, rs.plan_amount, rs.end_date
      FROM radcheck_subs rs
      WHERE rs.username = ?
      ORDER BY rs.id DESC
      LIMIT 5
    `;
    const [transError, transResult] = await runQuery(transQuery, [username]);

    let transactions = [];
    if (!transError && transResult.length > 0) {
      transactions = transResult.map((t) => ({
        id: t.id,
        title: "Unlimited WiFi",
        date: t.formatted_date,
        amount: `GHS ${t.plan_amount.toFixed(2)}`,
        status: new Date(t.end_date) > new Date() ? "Active" : "Expired",
      }));
    }

    res.json({
      planSubs: planName,
      endDate: formattedEndDate,
      rawEndDate,
      planStatus,
      dataUsed,
      dataUsedVal,
      fairUseLimitGb,
      fairUseThrottled,
      fairUseSuperThrottled,
      email,
      fullname,
      phone,
      transactions,
    });
  } catch (error) {
    console.error("Error fetching WiFi dashboard data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/subscription-plans", async (req, res) => {
  const sql =
    "SELECT `id`, `plan_name`, `expire_days`, `amount`, `expires_display`, `fair_use_limit_gb`, `fair_use_down_kbps`, `fair_use_up_kbps` FROM `subscription_plans` WHERE active = '1' ORDER BY CAST(amount AS DECIMAL(10, 2)) ASC";
  const [err, results] = await runQuery(sql);

  if (err) {
    console.error("Database error fetching subscription plans:", err);
    return res
      .status(500)
      .json({ message: "Server error fetching subscription plans.", code: 2 });
  }

  res.status(200).json({ code: 1, data: results });
});

router.post("/initiate-purchase", async (req, res) => {
  const { username, plan } = req.body;

  if (!username || !plan) {
    return res
      .status(400)
      .json({ message: "Username and plan details are required.", code: 2 });
  }

  try {
    const approvalToken = crypto.randomBytes(32).toString("hex");

    const insertSql = `
            INSERT INTO pending_payments (username, plan_id, amount, approval_token) 
            VALUES (?, ?, ?, ?)
        `;
    const [err] = await runQuery(insertSql, [
      username,
      plan.id,
      plan.amount,
      approvalToken,
    ]);

    if (err) {
      console.error("Database error creating pending payment:", err);
      return res
        .status(500)
        .json({ message: "Server error creating pending payment.", code: 2 });
    }

    const approvalLink = `${process.env.SERVER_BASE_URL}/api/wifi/approve-payment?token=${approvalToken}`;

    const purchaseDetails = {
      username: username,
      planName: plan.plan_name,
      amount: plan.amount,
    };

    await sendApprovalEmail(
      process.env.ADMIN_EMAIL,
      approvalLink,
      purchaseDetails,
    );

    res.status(200).json({
      code: 1,
      message: "Payment submission received. Awaiting admin approval.",
    });
  } catch (error) {
    console.error("Error initiating purchase:", error);
    return res.status(500).json({
      message: "An error occurred while submitting your payment.",
      code: 2,
    });
  }
});

router.get("/approve-payment", async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send("<h3>Error: Approval token is missing.</h3>");
  }

  try {
    const findSql = `SELECT * FROM pending_payments WHERE approval_token = ? AND status = 'pending'`;
    const [findErr, results] = await runQuery(findSql, [token]);

    if (findErr || results.length === 0) {
      return res
        .status(404)
        .send(
          "<h3>Link is invalid, has expired, or has already been used.</h3>",
        );
    }

    const pendingPayment = results[0];

    // Fetch plan details needed for activation
    const planSql = "SELECT * FROM subscription_plans WHERE id = ?";
    const [planErr, planResults] = await runQuery(planSql, [
      pendingPayment.plan_id,
    ]);

    if (planErr || planResults.length === 0) {
      return res
        .status(500)
        .send(
          "<h3>Error: Could not find the associated subscription plan.</h3>",
        );
    }
    const plan = planResults[0];

    // Prepare subscription details for the activation function
    const subscriptionDetails = {
      username: pendingPayment.username,
      planId: plan.id,
      planAmount: plan.amount,
      expireDays: plan.expire_days,
      regBy: pendingPayment.username, // User subscribed themselves
      amountPaid: pendingPayment.amount, // Amount paid is the plan amount
      payStatus: 1, // 1 = Paid
      modeOfPayment: 1, // Assuming 1 = 'Mobile Money'
      paidTo: pendingPayment.username, // Paid to the user themselves (self-service)
    };

    // Activate the subscription
    await activateSubscription(subscriptionDetails);

    // Update the status of the pending payment
    const updateSql = `UPDATE pending_payments SET status = 'approved' WHERE id = ?`;
    await runQuery(updateSql, [pendingPayment.id]);

    res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 40px;">
                <h1 style="color: #28a745;">Payment Approved!</h1>
                <p>The subscription for user <strong>${pendingPayment.username}</strong> has been successfully activated.</p>
                <p>You can now close this window.</p>
            </div>
        `);
  } catch (error) {
    console.error("Error approving payment:", error);
    res.status(500).send(`
            <div style="font-family: sans-serif; text-align: center; padding: 40px;">
                <h1 style="color: #dc3545;">Activation Failed</h1>
                <p>An unexpected error occurred while trying to activate the subscription.</p>
                <p>Error: ${error.message}</p>
            </div>
        `);
  }
});

// Check User for Public Quick Purchase
router.post("/public/check-user", async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res
      .status(400)
      .json({ message: "Phone number is required", code: 2 });
  }

  try {
    const query = `SELECT fullname, phone, email FROM radcheck_client WHERE username = ?`;
    const [err, results] = await runQuery(query, [username]);

    if (err) {
      console.error("Error checking user:", err);
      return res
        .status(500)
        .json({ message: "Internal server error", code: 2 });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "User not found", code: 2 });
    }

    const user = results[0];

    // Masking Helper
    const maskString = (str, visibleStart = 3, visibleEnd = 3) => {
      if (!str || str.length <= visibleStart + visibleEnd) return str;
      return (
        str.substring(0, visibleStart) +
        "*".repeat(str.length - visibleStart - visibleEnd) +
        str.substring(str.length - visibleEnd)
      );
    };

    // Masking Fullname specifically (First Name Initial + Last Name Masked)
    // Or simplified: Just mask the middle
    const maskedFullname = maskString(user.fullname, 3, 3);
    const maskedPhone = maskString(user.phone, 3, 3);

    res.json({
      code: 1,
      data: {
        fullname: user.fullname,
        phone: maskedPhone,
        real_phone: user.phone, // Send real phone for default value in payment form (hidden/masked in UI if needed, but needed for payment)
        email: user.email, // Needed for Paystack
      },
    });
  } catch (error) {
    console.error("Error in /public/check-user:", error);
    res.status(500).json({ message: "Server error", code: 2 });
  }
});

// ---------------------------------------------------------
// NEW: Direct Paystack Charge (Push to Mobile)
// ---------------------------------------------------------

router.post("/paystack/charge", async (req, res) => {
  const { username, amount, phone, provider, email } = req.body;

  if (!username || !phone || !provider || !amount || !email) {
    return res
      .status(400)
      .json({ message: "Missing payment details.", code: 2 });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  let calculatedPlan;
  try {
    calculatedPlan = await calculatePlanFromAmount(amount);
  } catch (error) {
    return res.status(400).json({ message: error.message, code: 2 });
  }
  const reference =
    "dir_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);

  // Paystack expects amount in kobo/pesewas
  const amountInPesewas = Math.round(Number(amount) * 100);

  const payload = {
    amount: amountInPesewas,
    email: email,
    currency: "GHS",
    mobile_money: {
      phone: phone,
      provider: provider, // 'mtn', 'vod', 'tgo'
    },
    reference: reference,
    metadata: {
      custom_fields: [
        {
          display_name: "Username",
          variable_name: "username",
          value: username,
        },
        { display_name: "Amount", variable_name: "amount", value: amount },
      ],
    },
  };

  try {
    console.log(
      "--> [Direct Charge] Initiating for:",
      phone,
      provider,
      reference,
    );
    const response = await axios.post(
      "https://api.paystack.co/charge",
      payload,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = response.data.data;
    console.log(
      "--> [Direct Charge] Response:",
      data.status,
      data.display_text,
    );

    // Save to paystack_transactions table for cron job fallback
    try {
      const logSql = `
        INSERT INTO paystack_transactions (reference, username, plan_id, amount, email, status) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      await runQuery(logSql, [
        reference,
        username,
        calculatedPlan.planId,
        amount,
        email,
        "pending",
      ]);
    } catch (dbErr) {
      console.error("--> [Direct Charge] Error logging transaction:", dbErr);
    }

    // Possible statuses: 'success', 'send_otp', 'send_pin', 'open_url', 'pending'
    // 'send_otp': The user needs to enter an OTP sent to their phone.
    // 'send_pin' / 'pending': The user needs to approve on their phone.

    res.json({
      code: 1,
      message: data.message,
      data: {
        reference: data.reference,
        status: data.status,
        display_text: data.display_text,
      },
    });
  } catch (error) {
    console.error(
      "--> [Direct Charge] Error:",
      error.response?.data || error.message,
    );
    res.status(500).json({
      message: error.response?.data?.message || "Payment initiation failed.",
      code: 2,
      error: error.response?.data,
    });
  }
});

router.post("/paystack/submit-otp", async (req, res) => {
  const { otp, reference } = req.body;
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  try {
    const response = await axios.post(
      "https://api.paystack.co/charge/submit_otp",
      {
        otp,
        reference,
      },
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      },
    );

    const data = response.data.data;
    res.json({
      code: 1,
      message: data.message,
      data: {
        reference: data.reference,
        status: data.status,
        display_text: data.display_text,
      },
    });
  } catch (error) {
    console.error(
      "--> [Submit OTP] Error:",
      error.response?.data || error.message,
    );
    res.status(500).json({
      message: error.response?.data?.message || "OTP validation failed.",
      code: 2,
    });
  }
});

router.get("/paystack/status/:reference", async (req, res) => {
  const { reference } = req.params;
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  console.log(`--> [Status Check] Checking reference: ${reference}`);

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      },
    );

    const data = response.data.data;
    console.log(`--> [Status Check] Paystack Status: ${data.status}`);

    // Log metadata for debugging
    if (data.status === "success") {
      const username = getPaystackTransactionUsername(data);
      const paidAmount = Number(data.amount) / 100;

      console.log(
        `--> [Status Check] Metadata - Phone Number: ${username}, Amount: ${paidAmount}`,
      );

      if (username && paidAmount > 0) {
        try {
          if (await hasSuccessfulPaystackTransaction(reference)) {
            console.log(
              "--> [Status Check] Payment already processed:",
              reference,
            );
            return res.json({ status: data.status, processed: true });
          }

          const calculatedPlan = await calculatePlanFromAmount(paidAmount);
          const subscriptionDetails = {
            username: username,
            paymentAmount: paidAmount,
            modeOfPayment: 2,
            paidTo: "Paystack",
            paymentRef: reference, // Key for idempotency
            allowGuestAccount: true,
          };

          console.log(
            "--> [Status Check] Attempting server-side activation...",
          );
          await activateSubscription(subscriptionDetails);

          await runQuery(
            `INSERT INTO paystack_transactions (reference, username, plan_id, amount, email, status)
             VALUES (?, ?, ?, ?, ?, 'success')
             ON DUPLICATE KEY UPDATE username = VALUES(username), plan_id = VALUES(plan_id), amount = VALUES(amount), email = VALUES(email), status = 'success'`,
            [
              reference,
              username,
              calculatedPlan.planId,
              paidAmount,
              data.customer?.email || data.email || null,
            ],
          );
        } catch (activationErr) {
          console.error(
            "--> [Status Check] Activation error:",
            activationErr.message,
          );
        }
      }
    }

    res.json({
      code: 1,
      data: {
        status: data.status,
        gateway_response: data.gateway_response,
      },
    });
  } catch (error) {
    console.error("--> [Status Check] Error:", error.message);
    res.json({ code: 2, message: "Check failed" });
  }
});

router.post("/change-password", async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;

  if (!username || !currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ message: "All fields are required.", code: 2 });
  }

  try {
    // 1. Verify Current Password
    const verifySql =
      "SELECT * FROM radcheck_client WHERE username = ? AND value = ?";
    const [verifyErr, verifyRes] = await runQuery(verifySql, [
      username,
      currentPassword,
    ]);

    if (verifyErr) {
      console.error("Error verifying password:", verifyErr);
      return res.status(500).json({ message: "Server error.", code: 2 });
    }

    if (verifyRes.length === 0) {
      return res
        .status(401)
        .json({ message: "Incorrect current password.", code: 2 });
    }

    // 2. Update radcheck_client
    const updateClientSql =
      "UPDATE radcheck_client SET value = ? WHERE username = ?";
    const [updateClientErr] = await runQuery(updateClientSql, [
      newPassword,
      username,
    ]);

    if (updateClientErr) {
      console.error("Error updating client password:", updateClientErr);
      return res
        .status(500)
        .json({ message: "Failed to update password.", code: 2 });
    }

    // 3. Update radcheck (RADIUS)
    const updateRadiusSql =
      "UPDATE radcheck SET value = ? WHERE username = ? AND attribute = 'Cleartext-Password'";
    const [updateRadiusErr] = await runQuery(updateRadiusSql, [
      newPassword,
      username,
    ]);

    if (updateRadiusErr) {
      console.error("Error updating RADIUS password:", updateRadiusErr);
      // Not returning error here as client update succeeded, but logging it is critical.
    }

    res.json({ code: 1, message: "Password updated successfully." });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Internal server error.", code: 2 });
  }
});

router.get("/contact-info", async (req, res) => {
  const sql = "SELECT * FROM contact_us";
  const [err, results] = await runQuery(sql);

  if (err) {
    console.error("Database error fetching contact info:", err);
    return res
      .status(500)
      .json({ message: "Server error fetching contact info.", code: 2 });
  }

  res.status(200).json({ code: 1, data: results });
});

module.exports = router;
