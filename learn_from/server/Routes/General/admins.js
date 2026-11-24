const express = require("express");
const router = express.Router();
const runQuery = require("../runQuery");
const { format, startOfDay, endOfDay } = require("date-fns");
const { sendSms } = require("../../sms");
const { activateSubscription } = require("./subscriptionManager");
const {
  SMS_AUTOMATION_SETTINGS,
  getSmsAutomationSettings,
  getSmsAutomationSetting,
  renderSmsAutomationMessage,
  updateSmsAutomationSetting,
} = require("./smsAutomationSettings");
const { ensureSubscriptionAuditTable, recordSubscriptionAuditEvent } = require("./subscriptionAudit");
const { ensureAccountingArchiveSchema } = require("./accountingArchive");
const {
  USER_TEMPLATE_FIELDS,
  getApprovedWhatsAppTemplates,
  getRecentWhatsAppMessages,
  sendSubscriptionActivationTemplate,
  sendWhatsAppTemplate,
} = require("../../whatsappMessaging");

const ensureSmsTemplatesTable = async () => {
  const [error] = await runQuery(`
    CREATE TABLE IF NOT EXISTS sms_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(120) NOT NULL UNIQUE,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  if (error) throw error;
};

const ensureBonusTables = async () => {
  const [templateError] = await runQuery(`
    CREATE TABLE IF NOT EXISTS bonus_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(120) NOT NULL UNIQUE,
      hours INT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  if (templateError) throw templateError;

  const [issuanceError] = await runQuery(`
    CREATE TABLE IF NOT EXISTS bonus_issuances (
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_ref VARCHAR(100) NOT NULL,
      username VARCHAR(64) NOT NULL,
      title VARCHAR(120) NOT NULL,
      hours INT NOT NULL,
      message TEXT NOT NULL,
      issued_by VARCHAR(64) NOT NULL,
      subscription_id INT UNSIGNED NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_bonus_issue (request_ref, username)
    )
  `);
  if (issuanceError) throw issuanceError;
};

const isSuperAdmin = async (username) => {
  const [error, rows] = await runQuery(
    "SELECT role FROM radcheck_client WHERE username = ? LIMIT 1",
    [username],
  );

  if (error) throw error;
  return rows.length > 0 && String(rows[0].role).split(",").map((role) => role.trim()).includes("13");
};

let clientRegistrationSchemaReady = null;

const ensureClientRegistrationSchema = async () => {
  if (!clientRegistrationSchemaReady) {
    clientRegistrationSchemaReady = (async () => {
      const [columnError, columns] = await runQuery("SHOW COLUMNS FROM radcheck_client LIKE 'registered_at'");
      if (columnError) throw columnError;
      if (columns.length > 0) return;

      const [addColumnError] = await runQuery(
        "ALTER TABLE radcheck_client ADD COLUMN registered_at DATETIME NULL AFTER time_1",
      );
      if (addColumnError) throw addColumnError;

      const [backfillError] = await runQuery(`
        UPDATE radcheck_client c
        LEFT JOIN (
          SELECT username, MIN(payment_date) AS first_payment_date
          FROM radcheck_subs
          GROUP BY username
        ) s ON s.username = c.username
        SET c.registered_at = COALESCE(s.first_payment_date, c.time_1)
        WHERE c.registered_at IS NULL
      `);
      if (backfillError) throw backfillError;

      const [defaultError] = await runQuery(
        "ALTER TABLE radcheck_client MODIFY registered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
      );
      if (defaultError) throw defaultError;
    })().catch((error) => {
      clientRegistrationSchemaReady = null;
      throw error;
    });
  }
  return clientRegistrationSchemaReady;
};

const ensureHostelOwnerRevenuePeriodTable = async () => {
  const [error] = await runQuery(`
    CREATE TABLE IF NOT EXISTS hostel_owner_revenue_period (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      period_start DATE NULL,
      period_end DATE NULL,
      updated_by VARCHAR(64) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  if (error) throw error;
  const [seedError] = await runQuery(
    "INSERT IGNORE INTO hostel_owner_revenue_period (id, period_start, period_end) VALUES (1, NULL, NULL)",
  );
  if (seedError) throw seedError;
};

const isValidIsoDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const getHostelOwnerRevenuePeriod = async () => {
  await ensureHostelOwnerRevenuePeriodTable();
  const [error, rows] = await runQuery(
    "SELECT DATE_FORMAT(period_start, '%Y-%m-%d') AS period_start, DATE_FORMAT(period_end, '%Y-%m-%d') AS period_end, updated_at FROM hostel_owner_revenue_period WHERE id = 1 LIMIT 1",
  );
  if (error) throw error;
  return rows[0] || { period_start: null, period_end: null, updated_at: null };
};

const getManagedSubscription = async (subscriptionId) => {
  const [error, rows] = await runQuery(
    `SELECT s.*, c.value AS password, c.fullname AS client_fullname, c.disabled
     FROM radcheck_subs s
     JOIN radcheck_client c ON c.username = s.username
     WHERE s.id = ?
     LIMIT 1`,
    [subscriptionId],
  );

  if (error) throw error;
  return rows[0] || null;
};

const SUPER_ADMIN_DASHBOARD_METRICS = {
  today_subscriptions: `
    SELECT COUNT(*) AS value
    FROM radcheck_subs
    WHERE payment_date >= ?
      AND payment_date < DATE_ADD(?, INTERVAL 1 DAY)
  `,
  today_amount: `
    SELECT COALESCE(SUM(plan_amount), 0) AS value
    FROM radcheck_subs
    WHERE payment_date >= ?
      AND payment_date < DATE_ADD(?, INTERVAL 1 DAY)
      AND paid_to = 'Paystack'
  `,
  month_amount: `
    SELECT COALESCE(SUM(plan_amount), 0) AS value
    FROM radcheck_subs
    WHERE payment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
      AND payment_date < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
      AND paid_to = 'Paystack'
  `,
  expired_today: `
    SELECT COUNT(DISTINCT username) AS value
    FROM radcheck_subs
    WHERE end_date >= ?
      AND end_date < DATE_ADD(?, INTERVAL 1 DAY)
  `,
  active_subscriptions: `
    SELECT COUNT(*) AS value
    FROM radcheck_subs
    WHERE plan_status = 0
      AND start_date <= NOW()
      AND end_date > NOW()
  `,
};

router.get("/super-admin-dashboard/:metric", async (req, res) => {
  const query = SUPER_ADMIN_DASHBOARD_METRICS[req.params.metric];
  if (!query) return res.status(404).json({ error: "Unknown dashboard metric." });

  const dateSpecificMetrics = ["today_subscriptions", "today_amount", "expired_today"];
  const selectedDate = String(req.query.date || "");
  const parsedDate = new Date(`${selectedDate}T00:00:00.000Z`);
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) &&
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === selectedDate;
  if (dateSpecificMetrics.includes(req.params.metric) && !validDate) {
    return res.status(400).json({ error: "A valid date is required for this dashboard metric." });
  }

  try {
    if (!(await isSuperAdmin(req.query.issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can view this dashboard." });
    }

    const params = dateSpecificMetrics.includes(req.params.metric) ? [selectedDate, selectedDate] : [];
    const [error, rows] = await runQuery(query, params);
    if (error) throw error;
    res.status(200).json({ metric: req.params.metric, value: rows[0]?.value || 0 });
  } catch (error) {
    console.error(`Error loading Super Admin dashboard metric ${req.params.metric}:`, error);
    res.status(500).json({ error: "Failed to load Super Admin dashboard metric." });
  }
});

router.get("/client-history/search", async (req, res) => {
  const search = String(req.query.search || "").trim();
  if (search.length < 2) return res.status(200).json([]);

  try {
    if (!(await isSuperAdmin(req.query.issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can search client history." });
    }
    const term = `%${search}%`;
    const [error, clients] = await runQuery(
      `SELECT username, fullname, phone, hostel
       FROM radcheck_client
       WHERE role = '0'
         AND (username LIKE ? OR fullname LIKE ? OR phone LIKE ?)
       ORDER BY fullname ASC
       LIMIT 20`,
      [term, term, term],
    );
    if (error) throw error;
    res.status(200).json(clients);
  } catch (error) {
    console.error("Error searching client history:", error);
    res.status(500).json({ error: "Failed to search clients." });
  }
});

router.get("/client-history/:username", async (req, res) => {
  try {
    if (!(await isSuperAdmin(req.query.issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can view client history." });
    }

    await ensureClientRegistrationSchema();

    const username = String(req.params.username || "").trim();
    const [clientError, clients] = await runQuery(
      `SELECT username, value AS password, fullname, phone, email, hostel, room,
              DATE_FORMAT(registered_at, '%d-%m-%Y %h:%i %p') AS registered_at
       FROM radcheck_client
       WHERE username = ? AND role = '0'
       LIMIT 1`,
      [username],
    );
    if (clientError) throw clientError;
    if (clients.length === 0) return res.status(404).json({ error: "Client not found." });

    const [historyError, subscriptions] = await runQuery(
      `SELECT s.id, s.plan_amount, s.payment_ref, s.plan_status,
              s.fair_use_limit_gb, s.fair_use_throttled, s.fair_use_super_throttled,
              DATE_FORMAT(s.payment_date, '%d-%m-%Y %h:%i %p') AS payment_date,
              DATE_FORMAT(s.start_date, '%d-%m-%Y %h:%i %p') AS start_date,
              DATE_FORMAT(s.end_date, '%d-%m-%Y %h:%i %p') AS end_date,
              p.plan_name,
              pm.name AS payment_method,
              CASE
                WHEN s.plan_status = 0 AND s.start_date <= NOW() AND s.end_date > NOW() THEN 'Active'
                WHEN s.end_date <= NOW() THEN 'Expired'
                ELSE 'Replaced'
              END AS subscription_status,
              CASE
                WHEN s.paid_to = 'Bonus' THEN 'Bonus'
                WHEN s.paid_to = 'Paystack' THEN 'Paystack'
                ELSE COALESCE((SELECT fullname FROM radcheck_client WHERE username = s.paid_to), s.paid_to)
              END AS paid_by
       FROM radcheck_subs s
       LEFT JOIN subscription_plans p ON p.id = s.plan_subs
       LEFT JOIN payment_methods pm ON pm.id = s.mode_of_payment
       WHERE s.username = ?
       ORDER BY s.payment_date DESC, s.id DESC`,
      [username],
    );
    if (historyError) throw historyError;

    res.status(200).json({ client: clients[0], subscriptions });
  } catch (error) {
    console.error("Error loading client history:", error);
    res.status(500).json({ error: "Failed to load client history." });
  }
});

router.get("/whatsapp/test-messages", async (req, res) => {
  try {
    if (!(await isSuperAdmin(req.query.issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can view WhatsApp test messages." });
    }
    res.status(200).json(await getRecentWhatsAppMessages("test"));
  } catch (error) {
    console.error("Error loading WhatsApp test messages:", error);
    res.status(500).json({ error: "Failed to load WhatsApp test messages." });
  }
});

router.post("/whatsapp/test-subscription-activation", async (req, res) => {
  const { issuedBy, recipientPhone, customerName, accountNumber, expiryDate } = req.body;
  try {
    if (!(await isSuperAdmin(issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can send WhatsApp test messages." });
    }
    const result = await sendSubscriptionActivationTemplate({
      recipientPhone,
      customerName,
      accountNumber,
      expiryDate,
      source: "test",
    });
    res.status(200).json({ message: "WhatsApp test template submitted successfully.", result });
  } catch (error) {
    console.error("Error sending WhatsApp test message:", error.message);
    res.status(502).json({ error: error.message || "Failed to send WhatsApp test message." });
  }
});

router.get("/whatsapp/templates", async (req, res) => {
  try {
    if (!(await isSuperAdmin(req.query.issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can view WhatsApp templates." });
    }
    res.status(200).json(await getApprovedWhatsAppTemplates());
  } catch (error) {
    console.error("Error loading WhatsApp templates:", error.message);
    res.status(502).json({ error: error.message || "Failed to load WhatsApp templates." });
  }
});

router.get("/whatsapp/recipients", async (req, res) => {
  try {
    if (!(await isSuperAdmin(req.query.issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can view WhatsApp recipients." });
    }
    const [error, recipients] = await runQuery(`
      SELECT c.username, c.fullname, c.phone, c.email, c.hostel, c.room,
             EXISTS(
               SELECT 1 FROM radcheck_subs s
               WHERE s.username = c.username
                 AND s.plan_status = 0
                 AND s.start_date <= NOW()
                 AND s.end_date > NOW()
             ) AS has_active_subscription
      FROM radcheck_client c
      WHERE c.role = '0'
      ORDER BY has_active_subscription DESC, c.fullname ASC
    `);
    if (error) throw error;
    res.status(200).json(recipients);
  } catch (error) {
    console.error("Error loading WhatsApp recipients:", error);
    res.status(500).json({ error: "Failed to load WhatsApp recipients." });
  }
});

router.post("/whatsapp/send-template", async (req, res) => {
  const { issuedBy, templateName, languageCode, mappings, recipientUsernames } = req.body;
  if (!Array.isArray(recipientUsernames) || recipientUsernames.length === 0) {
    return res.status(400).json({ error: "Select at least one recipient." });
  }
  if (recipientUsernames.length > 500) {
    return res.status(400).json({ error: "A campaign can include at most 500 recipients." });
  }

  try {
    if (!(await isSuperAdmin(issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can send WhatsApp templates." });
    }

    const templates = await getApprovedWhatsAppTemplates();
    const template = templates.find(
      (item) => item.name === templateName && item.language === languageCode,
    );
    if (!template) {
      return res.status(400).json({ error: "Choose an approved, supported WhatsApp template." });
    }

    const expectedKeys = template.variableSlots.map((slot) => `${slot.component}:${slot.parameterIndex}`);
    if (!mappings || typeof mappings !== "object" || expectedKeys.some((key) => !USER_TEMPLATE_FIELDS.has(mappings[key]))) {
      return res.status(400).json({ error: "Map every template variable to an approved user field." });
    }

    const usernames = [...new Set(recipientUsernames.map((username) => String(username || "").trim()).filter(Boolean))];
    const placeholders = usernames.map(() => "?").join(", ");
    const [queryError, recipients] = await runQuery(
      `SELECT username, fullname, phone, email, hostel, room
       FROM radcheck_client
       WHERE role = '0' AND username IN (${placeholders})`,
      usernames,
    );
    if (queryError) throw queryError;
    if (recipients.length !== usernames.length) {
      return res.status(400).json({ error: "One or more selected recipients are no longer available." });
    }

    const sendRecipient = async (recipient) => {
      try {
        const componentsByType = new Map();
        const variables = {};
        for (const slot of template.variableSlots) {
          const field = mappings[`${slot.component}:${slot.parameterIndex}`];
          const value = String(recipient[field] || "").trim();
          if (!value) throw new Error(`${recipient.fullname || recipient.username} has no ${field} value.`);
          variables[`${slot.component} ${slot.variable}`] = value;
          if (!componentsByType.has(slot.component)) componentsByType.set(slot.component, []);
          componentsByType.get(slot.component).push({ type: "text", text: value });
        }
        const componentParameters = [...componentsByType.entries()].map(([type, parameters]) => ({ type, parameters }));
        await sendWhatsAppTemplate({
          recipientPhone: recipient.phone,
          templateName: template.name,
          languageCode: template.language,
          componentParameters,
          variables,
          source: "campaign",
        });
        return { username: recipient.username, status: "submitted" };
      } catch (error) {
        return { username: recipient.username, status: "failed", error: error.message };
      }
    };
    const results = [];
    for (let index = 0; index < recipients.length; index += 5) {
      results.push(...await Promise.all(recipients.slice(index, index + 5).map(sendRecipient)));
    }

    const submitted = results.filter((result) => result.status === "submitted").length;
    res.status(200).json({
      message: `${submitted} of ${results.length} WhatsApp messages submitted to Meta.`,
      submitted,
      failed: results.filter((result) => result.status === "failed"),
    });
  } catch (error) {
    console.error("Error sending WhatsApp template campaign:", error.message);
    res.status(502).json({ error: error.message || "Failed to send WhatsApp template campaign." });
  }
});

router.get("/subscribers/:id/manage", async (req, res) => {
  const subscriptionId = Number(req.params.id);
  const { issuedBy } = req.query;

  if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
    return res.status(400).json({ error: "Invalid subscription." });
  }

  try {
    if (!(await isSuperAdmin(issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can manage subscribers." });
    }

    const subscription = await getManagedSubscription(subscriptionId);
    if (!subscription) return res.status(404).json({ error: "Subscriber not found." });

    const [planError, plans] = await runQuery(
      `SELECT id, plan_name, amount, expire_days, expires_display,
              fair_use_limit_gb, fair_use_down_kbps, fair_use_up_kbps
       FROM subscription_plans
       WHERE active = '1'
       ORDER BY CAST(amount AS DECIMAL(10, 2)) ASC`,
    );
    if (planError) throw planError;

    res.status(200).json({ subscription, plans });
  } catch (error) {
    console.error("Error loading subscriber management data:", error);
    res.status(500).json({ error: "Failed to load subscriber management data." });
  }
});

router.get("/subscribers/:id/audit", async (req, res) => {
  const subscriptionId = Number(req.params.id);
  const { issuedBy } = req.query;

  if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
    return res.status(400).json({ error: "Invalid subscription." });
  }

  try {
    if (!(await isSuperAdmin(issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can view subscription history." });
    }

    await ensureSubscriptionAuditTable();
    const [error, events] = await runQuery(
      `SELECT event_type, source, actor_username, usage_bytes, fair_use_limit_gb,
              down_kbps, up_kbps, details, created_at
       FROM subscription_audit_events
       WHERE subscription_id = ?
       ORDER BY id DESC
       LIMIT 20`,
      [subscriptionId],
    );
    if (error) throw error;
    res.status(200).json(events);
  } catch (error) {
    console.error("Error fetching subscription audit history:", error);
    res.status(500).json({ error: "Failed to fetch subscription history." });
  }
});

router.get("/fair-use-review", async (req, res) => {
  const { issuedBy } = req.query;

  try {
    if (!(await isSuperAdmin(issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can review fair-use throttles." });
    }

    await ensureAccountingArchiveSchema();

    const [error, subscribers] = await runQuery(
      `SELECT s.id, s.username, c.fullname, s.fair_use_limit_gb,
              s.fair_use_throttled_at,
               GREATEST(0, COALESCE((SELECT SUM(r.acctinputoctets + r.acctoutputoctets)
                         FROM radacct r
                         WHERE r.username = s.username), 0) - s.usage_baseline_bytes) AS current_usage_bytes
       FROM radcheck_subs s
       JOIN radcheck_client c ON c.username = s.username
       WHERE s.plan_status = 0
         AND s.start_date <= NOW()
         AND s.end_date > NOW()
         AND s.fair_use_throttled = 1
         AND s.fair_use_super_throttled = 0
       HAVING current_usage_bytes < s.fair_use_limit_gb * 1024 * 1024 * 1024
       ORDER BY s.fair_use_throttled_at DESC`,
    );
    if (error) throw error;
    res.status(200).json(subscribers);
  } catch (error) {
    console.error("Error reviewing fair-use throttles:", error);
    res.status(500).json({ error: "Failed to review fair-use throttles." });
  }
});

router.put("/subscribers/:id/plan", async (req, res) => {
  const subscriptionId = Number(req.params.id);
  const planId = Number(req.body.planId);
  const { issuedBy } = req.body;

  if (!Number.isInteger(subscriptionId) || subscriptionId <= 0 || !Number.isInteger(planId) || planId <= 0) {
    return res.status(400).json({ error: "A valid subscription and plan are required." });
  }

  try {
    if (!(await isSuperAdmin(issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can manage subscribers." });
    }

    const subscription = await getManagedSubscription(subscriptionId);
    if (!subscription) return res.status(404).json({ error: "Subscriber not found." });

    const [planError, plans] = await runQuery(
      `SELECT id, amount, expire_days, fair_use_limit_gb, fair_use_down_kbps, fair_use_up_kbps
       FROM subscription_plans
       WHERE id = ? AND active = '1'
       LIMIT 1`,
      [planId],
    );
    if (planError) throw planError;
    if (plans.length === 0) return res.status(404).json({ error: "Active subscription plan not found." });

    const plan = plans[0];
    await ensureAccountingArchiveSchema();
    await ensureSubscriptionAuditTable();
    const [updateError] = await runQuery(
      `UPDATE radcheck_subs
       SET plan_subs = ?,
           plan_amount = ?,
           end_date = DATE_ADD(start_date, INTERVAL ? DAY),
           fair_use_limit_gb = ?,
           fair_use_down_kbps = ?,
            fair_use_up_kbps = ?,
             fair_use_throttled = 0,
             fair_use_throttled_at = NULL,
             fair_use_pending_at = NULL,
             fair_use_pending_usage_bytes = NULL,
             fair_use_super_throttled = 0,
            fair_use_super_throttled_at = NULL
       WHERE id = ?`,
      [
        plan.id,
        plan.amount,
        Number(plan.expire_days),
        plan.fair_use_limit_gb,
        plan.fair_use_down_kbps,
        plan.fair_use_up_kbps,
        subscriptionId,
      ],
    );
    if (updateError) throw updateError;

    const [updatedError, updatedRows] = await runQuery(
      "SELECT end_date FROM radcheck_subs WHERE id = ? LIMIT 1",
      [subscriptionId],
    );
    if (updatedError) throw updatedError;

    const endDate = updatedRows[0].end_date;
    await runQuery(
      `UPDATE radcheck
       SET expires_at = ?, subscribed_data = '0'
       WHERE plan_id = ?`,
      [endDate, subscriptionId],
    );
    await runQuery(
      `DELETE FROM radreply
       WHERE username = ?
         AND attribute IN ('pfSense-Bandwidth-Max-Down', 'pfSense-Bandwidth-Max-Up')`,
      [subscription.username],
    );
    await recordSubscriptionAuditEvent({
      subscriptionId,
      username: subscription.username,
      eventType: "plan_changed",
      source: "super_admin",
      actorUsername: issuedBy,
      fairUseLimitGb: plan.fair_use_limit_gb,
      downKbps: plan.fair_use_down_kbps,
      upKbps: plan.fair_use_up_kbps,
      details: { previousPlanId: subscription.plan_subs, newPlanId: plan.id },
    });

    res.status(200).json({ message: "Plan changed. The original subscription start date was preserved.", endDate });
  } catch (error) {
    console.error("Error changing subscription plan:", error);
    res.status(500).json({ error: "Failed to change subscription plan." });
  }
});

router.put("/subscribers/:id/fair-use", async (req, res) => {
  const subscriptionId = Number(req.params.id);
  const { issuedBy, mode } = req.body;

  if (!Number.isInteger(subscriptionId) || subscriptionId <= 0 || !["normal", "fair_use", "super"].includes(mode)) {
    return res.status(400).json({ error: "Invalid fair-use request." });
  }

  try {
    if (!(await isSuperAdmin(issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can manage subscribers." });
    }

    const subscription = await getManagedSubscription(subscriptionId);
    if (!subscription) return res.status(404).json({ error: "Subscriber not found." });

    let downBps = 0;
    let upBps = 0;
    if (mode === "fair_use") {
      downBps = Number(subscription.fair_use_down_kbps) * 1000;
      upBps = Number(subscription.fair_use_up_kbps) * 1000;
      if (downBps <= 0 || upBps <= 0) {
        return res.status(409).json({ error: "This subscription has no fair-use speed configured." });
      }
    } else if (mode === "super") {
      downBps = 20000;
      upBps = 20000;
    }
    await ensureAccountingArchiveSchema();
    await ensureSubscriptionAuditTable();

    const [deleteError] = await runQuery(
      `DELETE FROM radreply
       WHERE username = ?
         AND attribute IN ('pfSense-Bandwidth-Max-Down', 'pfSense-Bandwidth-Max-Up')`,
      [subscription.username],
    );
    if (deleteError) throw deleteError;

    if (mode !== "normal") {
      const [replyError] = await runQuery(
        `INSERT INTO radreply (username, attribute, op, value)
         VALUES
           (?, 'pfSense-Bandwidth-Max-Down', ':=', ?),
           (?, 'pfSense-Bandwidth-Max-Up', ':=', ?)`,
        [subscription.username, String(downBps), subscription.username, String(upBps)],
      );
      if (replyError) throw replyError;
    }

    const [updateError] = await runQuery(
      `UPDATE radcheck_subs
         SET fair_use_throttled = ?,
             fair_use_throttled_at = ${mode === "fair_use" ? "NOW()" : "NULL"},
             fair_use_pending_at = NULL,
             fair_use_pending_usage_bytes = NULL,
             fair_use_super_throttled = ?,
            fair_use_super_throttled_at = ${mode === "super" ? "NOW()" : "NULL"}
        WHERE id = ?`,
      [mode === "fair_use" ? 1 : 0, mode === "super" ? 1 : 0, subscriptionId],
    );
    if (updateError) throw updateError;

    await recordSubscriptionAuditEvent({
      subscriptionId,
      username: subscription.username,
      eventType: mode === "normal" ? "normal_speed_restored" : mode === "super" ? "super_throttled" : "fair_use_throttled",
      source: "super_admin",
      actorUsername: issuedBy,
      fairUseLimitGb: subscription.fair_use_limit_gb,
      downKbps: downBps / 1000,
      upKbps: upBps / 1000,
    });

    const throttleSettingKey = mode === "super" ? "super_throttle" : mode === "fair_use" ? "fair_use_throttle" : null;
    const wasAlreadyThrottled = mode === "super" ? Number(subscription.fair_use_super_throttled) === 1 : Number(subscription.fair_use_throttled) === 1;
    if (throttleSettingKey && !wasAlreadyThrottled) {
      try {
        const throttleSetting = await getSmsAutomationSetting(throttleSettingKey);
        if (throttleSetting.enabled) {
          await sendSms(
            subscription.username,
            renderSmsAutomationMessage(throttleSetting.message, {
              username: subscription.username,
              expiryDate: new Date(subscription.end_date).toISOString().slice(0, 16).replace("T", " "),
            }),
          );
        }
      } catch (smsError) {
        console.error(`Failed to send ${throttleSettingKey} SMS for ${subscription.username}:`, smsError);
      }
    }

    res.status(200).json({
      message: mode === "super" ? "Super Throttle applied at 20 kbit/s." : mode === "fair_use" ? "Fair-use throttle applied." : "Throttle removed. Automatic fair-use rules remain in effect.",
    });
  } catch (error) {
    console.error("Error updating fair-use throttle:", error);
    res.status(500).json({ error: "Failed to update fair-use throttle." });
  }
});

router.get("/sms-automation-settings", async (req, res) => {
  const { issuedBy } = req.query;

  try {
    if (!(await isSuperAdmin(issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can manage automated SMS settings." });
    }

    res.status(200).json(await getSmsAutomationSettings());
  } catch (error) {
    console.error("Error fetching automated SMS settings:", error);
    res.status(500).json({ error: "Failed to fetch automated SMS settings." });
  }
});

router.put("/sms-automation-settings/:eventKey", async (req, res) => {
  const { eventKey } = req.params;
  const { issuedBy, enabled, message } = req.body;

  if (!SMS_AUTOMATION_SETTINGS[eventKey] || typeof enabled !== "boolean" || !message || !message.trim()) {
    return res.status(400).json({ error: "A valid SMS setting, enabled state, and message are required." });
  }

  try {
    if (!(await isSuperAdmin(issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can manage automated SMS settings." });
    }

    const setting = await updateSmsAutomationSetting(eventKey, enabled, message.trim());
    res.status(200).json({ message: "Automated SMS setting updated successfully.", setting });
  } catch (error) {
    console.error("Error updating automated SMS setting:", error);
    res.status(500).json({ error: "Failed to update automated SMS setting." });
  }
});

router.put("/subscribers/:id/account-status", async (req, res) => {
  const subscriptionId = Number(req.params.id);
  const { issuedBy, disabled } = req.body;

  if (!Number.isInteger(subscriptionId) || subscriptionId <= 0 || typeof disabled !== "boolean") {
    return res.status(400).json({ error: "Invalid account status request." });
  }

  try {
    if (!(await isSuperAdmin(issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can manage subscribers." });
    }

    const subscription = await getManagedSubscription(subscriptionId);
    if (!subscription) return res.status(404).json({ error: "Subscriber not found." });

    await ensureSubscriptionAuditTable();

    const [clientError] = await runQuery(
      "UPDATE radcheck_client SET disabled = ? WHERE username = ?",
      [disabled ? 1 : 0, subscription.username],
    );
    if (clientError) throw clientError;

    if (disabled) {
      await runQuery("DELETE FROM radcheck WHERE username = ?", [subscription.username]);
      await recordSubscriptionAuditEvent({
        subscriptionId,
        username: subscription.username,
        eventType: "account_disabled",
        source: "super_admin",
        actorUsername: issuedBy,
      });
      return res.status(200).json({ message: "Account disabled and RADIUS access removed." });
    }

    const [activeError, activeSubscriptions] = await runQuery(
      `SELECT * FROM radcheck_subs
       WHERE username = ? AND plan_status = 0 AND start_date <= NOW() AND end_date > NOW()
       ORDER BY end_date DESC
       LIMIT 1`,
      [subscription.username],
    );
    if (activeError) throw activeError;
    if (activeSubscriptions.length === 0) {
      return res.status(200).json({ message: "Account enabled. No active subscription is available for RADIUS access." });
    }

    const activeSubscription = activeSubscriptions[0];
    await runQuery("DELETE FROM radcheck WHERE username = ?", [subscription.username]);
    const [radcheckError] = await runQuery(
      `INSERT INTO radcheck (username, fullname, attribute, op, value, expires_at, subscribed_data, plan_id)
       VALUES (?, ?, 'Cleartext-Password', ':=', ?, ?, '0', ?)`,
      [
        subscription.username,
        subscription.client_fullname,
        subscription.password,
        activeSubscription.end_date,
        activeSubscription.id,
      ],
    );
    if (radcheckError) throw radcheckError;

    await recordSubscriptionAuditEvent({
      subscriptionId,
      username: subscription.username,
      eventType: "account_enabled",
      source: "super_admin",
      actorUsername: issuedBy,
    });

    res.status(200).json({ message: "Account enabled and RADIUS access restored." });
  } catch (error) {
    console.error("Error updating account status:", error);
    res.status(500).json({ error: "Failed to update account status." });
  }
});

router.get("/fair-use-plans", async (req, res) => {
  const { issuedBy } = req.query;

  try {
    if (!(await isSuperAdmin(issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can manage fair-use settings." });
    }

    const [error, rows] = await runQuery(
      `SELECT id, plan_name, amount, expires_display, active,
              fair_use_limit_gb, fair_use_down_kbps, fair_use_up_kbps
       FROM subscription_plans
       ORDER BY CAST(amount AS DECIMAL(10, 2)) ASC, id ASC`,
    );
    if (error) throw error;

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching fair-use plans:", error);
    res.status(500).json({ error: "Failed to fetch fair-use settings. Run the fair-use database migration first." });
  }
});

router.put("/fair-use-plans/:id", async (req, res) => {
  const planId = Number(req.params.id);
  const { issuedBy, fairUseLimitGb, fairUseDownKbps, fairUseUpKbps } = req.body;
  const limitGb = Number(fairUseLimitGb);
  const downKbps = Number(fairUseDownKbps);
  const upKbps = Number(fairUseUpKbps);

  if (!Number.isInteger(planId) || planId <= 0) {
    return res.status(400).json({ error: "Invalid plan." });
  }

  if (
    !Number.isFinite(limitGb) || limitGb < 0 ||
    !Number.isInteger(downKbps) || downKbps < 0 ||
    !Number.isInteger(upKbps) || upKbps < 0 ||
    (limitGb > 0 && (downKbps === 0 || upKbps === 0))
  ) {
    return res.status(400).json({
      error: "Enter a valid data limit and non-zero upload/download speeds, or set all fair-use values to 0 to disable it.",
    });
  }

  try {
    if (!(await isSuperAdmin(issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can manage fair-use settings." });
    }

    const [updateError, result] = await runQuery(
      `UPDATE subscription_plans
       SET fair_use_limit_gb = ?, fair_use_down_kbps = ?, fair_use_up_kbps = ?
       WHERE id = ?`,
      [limitGb, downKbps, upKbps, planId],
    );
    if (updateError) throw updateError;
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Subscription plan not found." });
    }

    res.status(200).json({ message: "Fair-use settings updated successfully." });
  } catch (error) {
    console.error("Error updating fair-use plan:", error);
    res.status(500).json({ error: "Failed to update fair-use settings. Run the fair-use database migration first." });
  }
});

// Send Bulk SMS
router.post("/send-bulk-sms", async (req, res) => {
  const { recipients, message } = req.body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: "Recipients list is required." });
  }

  if (!message) {
    return res.status(400).json({ error: "Message content is required." });
  }

  try {
    // Send SMS to each recipient
    const smsPromises = recipients.map((recipient) => {
      let personalizedMessage = message;
      
      // Check if recipient is an object (new format) or string (legacy format just in case)
      if (typeof recipient === 'object' && recipient.phone) {
        // Replace placeholders
        personalizedMessage = personalizedMessage
          .replace(/{username}/g, recipient.username || '')
          .replace(/{fullname}/g, recipient.fullname || '');
        
        return sendSms(recipient.phone, personalizedMessage);
      } else if (typeof recipient === 'string') {
         // Fallback for just phone strings (though frontend now sends objects)
         return sendSms(recipient, message);
      }
    });

    await Promise.all(smsPromises);

    res.status(200).json({ message: "Bulk SMS sending initiated successfully." });
  } catch (error) {
    console.error("Error in /send-bulk-sms endpoint:", error);
    res.status(500).json({ error: "Internal server error while sending SMS." });
  }
});

// Get All Clients for Bulk SMS (ignoring role to ensure all are found)
router.get("/all-clients-for-sms", async (req, res) => {
  try {
    const query = `
      SELECT username, fullname, phone, hostel
      FROM radcheck_client
      WHERE id IN (
        SELECT MAX(id)
        FROM radcheck_client
        GROUP BY phone
      )
      ORDER BY fullname ASC
    `;
    const [error, result] = await runQuery(query);

    if (error) {
      console.error("Error fetching all clients for SMS:", error);
      return res.status(500).json({
        code: 2,
        message: "Internal server error while fetching clients.",
      });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in /all-clients-for-sms endpoint:", error);
    res.status(500).json({
      code: 2,
      message: "Internal server error.",
    });
  }
});

router.get("/sms-templates", async (req, res) => {
  try {
    await ensureSmsTemplatesTable();

    const [error, result] = await runQuery(
      "SELECT id, title, message, created_at FROM sms_templates ORDER BY created_at DESC",
    );

    if (error) {
      console.error("Error fetching SMS templates:", error);
      return res.status(500).json({ error: "Failed to fetch saved messages." });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in /sms-templates endpoint:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/sms-templates", async (req, res) => {
  const { title, message } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Template title is required." });
  }

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message content is required." });
  }

  try {
    await ensureSmsTemplatesTable();

    const [error, result] = await runQuery(
      "INSERT INTO sms_templates (title, message) VALUES (?, ?)",
      [title.trim(), message.trim()],
    );

    if (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "A saved message with this title already exists." });
      }

      console.error("Error saving SMS template:", error);
      return res.status(500).json({ error: "Failed to save message." });
    }

    res.status(201).json({
      message: "Message saved successfully.",
      template: {
        id: result.insertId,
        title: title.trim(),
        message: message.trim(),
      },
    });
  } catch (error) {
    console.error("Error in POST /sms-templates endpoint:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.delete("/sms-templates/:id", async (req, res) => {
  const templateId = Number(req.params.id);

  if (!Number.isInteger(templateId) || templateId <= 0) {
    return res.status(400).json({ error: "Invalid template id." });
  }

  try {
    await ensureSmsTemplatesTable();

    const [error, result] = await runQuery(
      "DELETE FROM sms_templates WHERE id = ?",
      [templateId],
    );

    if (error) {
      console.error("Error deleting SMS template:", error);
      return res.status(500).json({ error: "Failed to delete saved message." });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Saved message not found." });
    }

    res.status(200).json({ message: "Saved message deleted successfully." });
  } catch (error) {
    console.error("Error in DELETE /sms-templates endpoint:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/bonus-recipients", async (req, res) => {
  try {
    const [error, result] = await runQuery(`
      SELECT
        rc.username,
        rc.fullname,
        rc.phone,
        rc.hostel,
        EXISTS(
          SELECT 1
          FROM radcheck_subs rs
          WHERE rs.username = rc.username
            AND rs.plan_status = 0
            AND rs.end_date > NOW()
        ) AS has_active_subscription
      FROM radcheck_client rc
      ORDER BY rc.fullname ASC
    `);

    if (error) {
      console.error("Error fetching bonus recipients:", error);
      return res.status(500).json({ error: "Failed to fetch bonus recipients." });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in /bonus-recipients endpoint:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/bonus-templates", async (req, res) => {
  try {
    await ensureBonusTables();
    const [error, result] = await runQuery(
      "SELECT id, title, hours, message, created_at FROM bonus_templates ORDER BY created_at DESC",
    );

    if (error) {
      console.error("Error fetching bonus templates:", error);
      return res.status(500).json({ error: "Failed to fetch saved bonus types." });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in /bonus-templates endpoint:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/bonus-templates", async (req, res) => {
  const { title, hours, message } = req.body;
  const bonusHours = Number(hours);

  if (!title || !title.trim() || !message || !message.trim() || !Number.isInteger(bonusHours) || bonusHours <= 0) {
    return res.status(400).json({ error: "A title, whole number of hours, and message are required." });
  }

  try {
    await ensureBonusTables();
    const [error, result] = await runQuery(
      "INSERT INTO bonus_templates (title, hours, message) VALUES (?, ?, ?)",
      [title.trim(), bonusHours, message.trim()],
    );

    if (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "A saved bonus type with this title already exists." });
      }
      console.error("Error saving bonus template:", error);
      return res.status(500).json({ error: "Failed to save bonus type." });
    }

    res.status(201).json({
      message: "Bonus type saved successfully.",
      template: { id: result.insertId, title: title.trim(), hours: bonusHours, message: message.trim() },
    });
  } catch (error) {
    console.error("Error in POST /bonus-templates endpoint:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.delete("/bonus-templates/:id", async (req, res) => {
  const templateId = Number(req.params.id);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return res.status(400).json({ error: "Invalid bonus template id." });
  }

  try {
    await ensureBonusTables();
    const [error, result] = await runQuery("DELETE FROM bonus_templates WHERE id = ?", [templateId]);

    if (error) {
      console.error("Error deleting bonus template:", error);
      return res.status(500).json({ error: "Failed to delete bonus type." });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Saved bonus type not found." });
    }

    res.status(200).json({ message: "Bonus type deleted successfully." });
  } catch (error) {
    console.error("Error in DELETE /bonus-templates endpoint:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/issue-bonus", async (req, res) => {
  const { usernames, title, hours, message, issuedBy, requestRef } = req.body;
  const bonusHours = Number(hours);
  const recipients = [...new Set(Array.isArray(usernames) ? usernames.filter(Boolean) : [])];

  if (!issuedBy || !requestRef || recipients.length === 0) {
    return res.status(400).json({ error: "Issuer, request reference, and at least one recipient are required." });
  }
  if (!title || !title.trim() || !message || !message.trim() || !Number.isInteger(bonusHours) || bonusHours <= 0) {
    return res.status(400).json({ error: "A title, whole number of hours, and message are required." });
  }

  try {
    if (!(await isSuperAdmin(issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can issue bonuses." });
    }

    await ensureBonusTables();
    const issued = [];
    const skipped = [];

    for (const username of recipients) {
      const [existingError, existingRows] = await runQuery(
        "SELECT id FROM bonus_issuances WHERE request_ref = ? AND username = ? LIMIT 1",
        [requestRef, username],
      );
      if (existingError) throw existingError;
      if (existingRows.length > 0) {
        skipped.push({ username, reason: "Bonus request was already processed." });
        continue;
      }

      const [clientError, clientRows] = await runQuery(
        "SELECT username, fullname FROM radcheck_client WHERE username = ? LIMIT 1",
        [username],
      );
      if (clientError) throw clientError;
      if (clientRows.length === 0) {
        skipped.push({ username, reason: "Client was not found." });
        continue;
      }

      const client = clientRows[0];
      const personalizedMessage = message
        .replace(/{username}/g, client.username)
        .replace(/{fullname}/g, client.fullname || "");
      const paymentRef = `bonus-${requestRef}-${client.username}`.slice(0, 200);

      const activation = await activateSubscription({
        username: client.username,
        expireHours: bonusHours,
        modeOfPayment: 0,
        paidTo: "Bonus",
        paymentRef,
        confirmationMessage: personalizedMessage,
        warningSent: true,
        revenueReceived: true,
      });

      const [issuanceError] = await runQuery(
        `INSERT INTO bonus_issuances (request_ref, username, title, hours, message, issued_by, subscription_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [requestRef, client.username, title.trim(), bonusHours, message.trim(), issuedBy, activation.subscriptionId],
      );
      if (issuanceError) throw issuanceError;

      issued.push(client.username);
    }

    res.status(200).json({
      message: `Bonus issued to ${issued.length} recipient${issued.length === 1 ? "" : "s"}.`,
      issued,
      skipped,
    });
  } catch (error) {
    console.error("Error in /issue-bonus endpoint:", error);
    res.status(500).json({ error: error.message || "Failed to issue bonus." });
  }
});

router.get("/hostels", async (req, res) => {
  const { issuedBy } = req.query;

  try {
    if (!(await isSuperAdmin(issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can manage hostels." });
    }

    const [error, rows] = await runQuery(`
      SELECT
        h.id,
        h.name,
        (SELECT COUNT(*) FROM radcheck_client rc WHERE rc.hostel = h.name) AS client_count,
        (SELECT COUNT(*) FROM user_hostels uh WHERE uh.hostel_id = h.id) AS owner_assignment_count
      FROM hostel_list h
      ORDER BY h.name ASC
    `);

    if (error) {
      console.error("Error fetching hostel settings:", error);
      return res.status(500).json({ error: "Failed to fetch hostels." });
    }

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error in GET /hostels endpoint:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/hostels", async (req, res) => {
  const { name, issuedBy } = req.body;
  const hostelName = String(name || "").trim();

  if (!hostelName) {
    return res.status(400).json({ error: "Hostel name is required." });
  }

  try {
    if (!(await isSuperAdmin(issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can manage hostels." });
    }

    const [existingError, existingRows] = await runQuery(
      "SELECT id FROM hostel_list WHERE LOWER(name) = LOWER(?) LIMIT 1",
      [hostelName],
    );
    if (existingError) throw existingError;
    if (existingRows.length > 0) {
      return res.status(409).json({ error: "This hostel already exists." });
    }

    const [insertError, result] = await runQuery(
      "INSERT INTO hostel_list (name, location, owner) VALUES (?, '', '')",
      [hostelName],
    );
    if (insertError) {
      console.error("Error adding hostel:", insertError);
      return res.status(500).json({ error: "Failed to add hostel." });
    }

    res.status(201).json({ message: "Hostel added successfully.", hostel: { id: result.insertId, name: hostelName, client_count: 0, owner_assignment_count: 0 } });
  } catch (error) {
    console.error("Error in POST /hostels endpoint:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.delete("/hostels/:id", async (req, res) => {
  const hostelId = Number(req.params.id);
  const { issuedBy } = req.body || {};

  if (!Number.isInteger(hostelId) || hostelId <= 0) {
    return res.status(400).json({ error: "Invalid hostel id." });
  }

  try {
    if (!(await isSuperAdmin(issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can manage hostels." });
    }

    const [hostelError, hostelRows] = await runQuery(
      "SELECT id, name FROM hostel_list WHERE id = ? LIMIT 1",
      [hostelId],
    );
    if (hostelError) throw hostelError;
    if (hostelRows.length === 0) {
      return res.status(404).json({ error: "Hostel not found." });
    }

    const hostel = hostelRows[0];
    const [clientError, clientRows] = await runQuery(
      "SELECT COUNT(*) AS count FROM radcheck_client WHERE hostel = ?",
      [hostel.name],
    );
    const [assignmentError, assignmentRows] = await runQuery(
      "SELECT COUNT(*) AS count FROM user_hostels WHERE hostel_id = ?",
      [hostelId],
    );
    if (clientError || assignmentError) throw clientError || assignmentError;

    const clientCount = Number(clientRows[0].count);
    const assignmentCount = Number(assignmentRows[0].count);
    if (clientCount > 0 || assignmentCount > 0) {
      return res.status(409).json({
        error: `Cannot delete ${hostel.name}: it is assigned to ${clientCount} client${clientCount === 1 ? "" : "s"} and ${assignmentCount} hostel owner${assignmentCount === 1 ? "" : "s"}.`,
      });
    }

    const [deleteError] = await runQuery("DELETE FROM hostel_list WHERE id = ?", [hostelId]);
    if (deleteError) {
      console.error("Error deleting hostel:", deleteError);
      return res.status(500).json({ error: "Failed to delete hostel." });
    }

    res.status(200).json({ message: "Hostel deleted successfully." });
  } catch (error) {
    console.error("Error in DELETE /hostels endpoint:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Get all agents (username and fullname) for select dropdown - for admin use
router.get("/select-agent-dropdown", async (req, res) => {
  try {
    const query = `SELECT username, fullname FROM radcheck_client WHERE role != '0'`;
    const [error, result] = await runQuery(query);

    if (error) {
      console.error("Error fetching agents for dropdown:", error);
      return res.status(500).json({
        code: 2,
        message: "Internal server error while fetching agents.",
      });
    }

    res.status(200).json({
      code: 1,
      message: "Agents fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in /select-agent-dropdown endpoint:", error);
    res.status(500).json({
      code: 2,
      message: "Internal server error.",
    });
  }
});

// Get Revenue Data for Admin
router.get("/revenue-report", async (req, res) => {
  const { agentId } = req.query;

  try {
    let revenueQuery = `
      SELECT
        rs.id,
        CONCAT(rc.username, ' (', rc.fullname, ')') AS subscriber_name,
        rs.plan_amount,
        pm.name AS mode_of_payment,
        DATE_FORMAT(rs.payment_date, '%d-%m-%Y, %h:%i %p') AS payment_date,
        DATE_FORMAT(rs.start_date, '%d-%m-%Y, %h:%i %p') AS start_date,
        DATE_FORMAT(rs.end_date, '%d-%m-%Y, %h:%i %p') AS end_date
      FROM radcheck_subs rs
      JOIN radcheck_client rc ON rs.username = rc.username
      JOIN payment_methods pm ON rs.mode_of_payment = pm.id
      WHERE rs.recieved = 0
    `;
    const params = [];

    if (agentId) {
      revenueQuery += ` AND rs.paid_to = ?`;
      params.push(agentId);
    }

    revenueQuery += ` ORDER BY rs.id DESC`;

    const [revenueError, revenueResult] = await runQuery(revenueQuery, params);

    if (revenueError) {
      console.error("Error fetching revenue data:", revenueError);
      return res.status(500).json({ error: "Internal server error" });
    }

    let totalSubscriptions = 0;
    let totalAmountCollected = 0;
    let totalAmountByMobileMoney = 0;
    let totalAmountByCash = 0;

    revenueResult.forEach((sub) => {
      totalSubscriptions++;
      totalAmountCollected += parseFloat(sub.plan_amount);
      if (sub.mode_of_payment === "Mobile Money") {
        totalAmountByMobileMoney += parseFloat(sub.plan_amount);
      } else if (sub.mode_of_payment === "Cash") {
        totalAmountByCash += parseFloat(sub.plan_amount);
      }
    });

    res.json({
      subscriptions: revenueResult,
      stats: {
        totalSubscriptions,
        totalAmountCollected,
        totalAmountByMobileMoney,
        totalAmountByCash,
      },
    });
  } catch (error) {
    console.error("Error in /revenue-report endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/mark-received", async (req, res) => {
  const { agentId } = req.body;

  try {
    let updateQuery = `UPDATE radcheck_subs SET recieved = 1 WHERE recieved = 0`;
    const params = [];

    if (agentId) {
      updateQuery += ` AND paid_to = ?`;
      params.push(agentId);
    }

    const [updateError] = await runQuery(updateQuery, params);

    if (updateError) {
      console.error("Error marking revenue as received:", updateError);
      return res
        .status(500)
        .json({ error: "Failed to mark revenue as received" });
    }

    res
      .status(200)
      .json({ message: "Revenue marked as received successfully" });
  } catch (error) {
    console.error("Error in /mark-received endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get Admin Revenue Report
router.get("/admin-revenue-report", async (req, res) => {
  const { agentId, dateFrom, dateTo } = req.query;
  console.log(agentId, dateFrom, dateTo);
  try {
    let revenueQuery = `
      SELECT
        rs.id,
        CONCAT(rc.username, ' (', rc.fullname, ')') AS subscriber_name,
        rs.plan_amount,
        pm.name AS mode_of_payment,
        DATE_FORMAT(rs.start_date, '%d-%m-%Y, %h:%i %p') AS start_date,
        DATE_FORMAT(rs.end_date, '%d-%m-%Y, %h:%i %p') AS end_date,
        DATE_FORMAT(rs.payment_date, '%d-%m-%Y, %h:%i %p') AS payment_date
      FROM radcheck_subs rs
      JOIN radcheck_client rc ON rs.username = rc.username
      JOIN payment_methods pm ON rs.mode_of_payment = pm.id
      WHERE rs.recieved = 1
    `;
    const params = [];

    if (agentId) {
      revenueQuery += ` AND rs.paid_to = ?`;
      params.push(agentId);
    }

    if (dateFrom && dateTo) {
      revenueQuery += ` AND rs.payment_date BETWEEN ? AND ?`;
      params.push(dateFrom, dateTo);
    }

    revenueQuery += ` ORDER BY rs.payment_date DESC`;

    const [revenueError, revenueResult] = await runQuery(revenueQuery, params);

    if (revenueError) {
      console.error("Error fetching admin revenue report:", revenueError);
      return res.status(500).json({ error: "Internal server error" });
    }

    let totalSubscriptions = 0;
    let totalAmountCollected = 0;
    let totalAmountByMobileMoney = 0;
    let totalAmountByCash = 0;

    revenueResult.forEach((sub) => {
      totalSubscriptions++;
      totalAmountCollected += parseFloat(sub.plan_amount);
      if (sub.mode_of_payment === "Mobile Money") {
        totalAmountByMobileMoney += parseFloat(sub.plan_amount);
      } else if (sub.mode_of_payment === "Cash") {
        totalAmountByCash += parseFloat(sub.plan_amount);
      }
    });

    console.log(revenueResult);
    res.json({
      subscriptions: revenueResult,
      stats: {
        totalSubscriptions,
        totalAmountCollected,
        totalAmountByMobileMoney,
        totalAmountByCash,
      },
    });
  } catch (error) {
    console.error("Error in /admin-revenue-report endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete Subscriber
router.delete("/delete-subscriber/:sub_id", async (req, res) => {
  const { sub_id } = req.params;

  if (!sub_id || isNaN(parseInt(sub_id, 10))) {
    return res
      .status(400)
      .json({ error: "A valid subscriber ID is required." });
  }

  try {
    // Delete from radcheck using plan_id
    const deleteRadcheckQuery = `DELETE FROM radcheck WHERE plan_id = ?`;
    const [radcheckError] = await runQuery(deleteRadcheckQuery, [sub_id]);

    if (radcheckError) {
      console.error("Error deleting from radcheck:", radcheckError);
      return res.status(500).json({ error: "Failed to delete radcheck data." });
    }

    // Now, delete from the main subscription table
    const deleteSubsQuery = `DELETE FROM radcheck_subs WHERE id = ?`;
    const [subsError, subsResult] = await runQuery(deleteSubsQuery, [sub_id]);

    if (subsError) {
      console.error("Error deleting from radcheck_subs:", subsError);
      return res
        .status(500)
        .json({ error: "Failed to delete subscriber data." });
    }

    if (subsResult.affectedRows === 0) {
      // This means no subscription with the given ID was found.
      return res.status(404).json({ error: "Subscriber not found." });
    }

    res.status(200).json({ message: "Subscriber deleted successfully." });
  } catch (error) {
    console.error("Error in /delete-subscriber endpoint:", error);
    res.status(500).json({ error: "An internal server error occurred." });
  }
});

// Delete Client
router.delete("/delete-client/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const deleteClientQuery = `DELETE FROM radcheck_client WHERE username = ?`;
    const [clientError, clientResult] = await runQuery(deleteClientQuery, [
      username,
    ]);

    if (clientError) {
      console.error("Error deleting client:", clientError);
      return res.status(500).json({ error: "Failed to delete client." });
    }

    if (clientResult.affectedRows === 0) {
      return res.status(404).json({ error: "Client not found." });
    }

    res.status(200).json({ message: "Client deleted successfully." });
  } catch (error) {
    console.error("Error in /delete-client endpoint:", error);
    res.status(500).json({ error: "An internal server error occurred." });
  }
});

// Update Client Role
router.put("/update-client-role/:username", async (req, res) => {
  const { username } = req.params;
  const { role } = req.body;

  console.log(username, role);

  if (!role) {
    return res.status(400).json({ error: "Role is required." });
  }

  try {
    const updateRoleQuery = `UPDATE radcheck_client SET role = ? WHERE username = ?`;
    const [updateError, updateResult] = await runQuery(updateRoleQuery, [
      role,
      username,
    ]);

    if (updateError) {
      console.error("Error updating client role:", updateError);
      return res.status(500).json({ error: "Failed to update client role." });
    }

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: "Client not found." });
    }

    res.status(200).json({ message: "Client role updated successfully." });
  } catch (error) {
    console.error("Error in /update-client-role endpoint:", error);
    res.status(500).json({ error: "An internal server error occurred." });
  }
});

// Get agents details (role != 0)
router.get("/agents-details", async (req, res) => {
  try {
    const query = `SELECT username, fullname, phone, email, hostel, room, role FROM radcheck_client WHERE role != '0'`;
    const [error, result] = await runQuery(query);

    if (error) {
      console.error("Error fetching agents details:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    res.json(result);
  } catch (error) {
    console.error("Error in /agents-details endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- HOSTEL OWNERS MANAGEMENT ---

router.get("/hostel-owner-revenue-period", async (req, res) => {
  try {
    if (!(await isSuperAdmin(req.query.issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can manage the revenue period." });
    }
    const period = await getHostelOwnerRevenuePeriod();
    res.json({ code: 1, period });
  } catch (error) {
    console.error("Error fetching hostel-owner revenue period:", error);
    res.status(500).json({ error: "Failed to fetch the revenue period." });
  }
});

router.put("/hostel-owner-revenue-period", async (req, res) => {
  const { issuedBy, dateFrom, dateTo } = req.body;
  try {
    if (!(await isSuperAdmin(issuedBy))) {
      return res.status(403).json({ error: "Only a Super Admin can manage the revenue period." });
    }
    if (!isValidIsoDate(dateFrom) || !isValidIsoDate(dateTo) || dateFrom > dateTo) {
      return res.status(400).json({ error: "Choose a valid period with the start date on or before the end date." });
    }

    await ensureHostelOwnerRevenuePeriodTable();
    const [error] = await runQuery(
      `UPDATE hostel_owner_revenue_period
       SET period_start = ?, period_end = ?, updated_by = ?
       WHERE id = 1`,
      [dateFrom, dateTo, issuedBy],
    );
    if (error) throw error;
    const period = await getHostelOwnerRevenuePeriod();
    res.json({ code: 1, message: "Hostel owner revenue period updated.", period });
  } catch (error) {
    console.error("Error updating hostel-owner revenue period:", error);
    res.status(500).json({ error: error.message || "Failed to update the revenue period." });
  }
});

// Get hostels assigned to a specific user
router.get("/user-hostels/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const query = `
      SELECT h.id, h.name 
      FROM user_hostels uh
      JOIN hostel_list h ON uh.hostel_id = h.id
      WHERE uh.username = ?
    `;
    const [err, rows] = await runQuery(query, [username]);
    if (err) {
      return res.status(500).json({ code: 2, message: err.message });
    }
    res.json({ code: 1, data: rows });
  } catch (error) {
    res.status(500).json({ code: 2, message: error.message });
  }
});

// Assign multiple hostels to a user
router.post("/assign-hostels", async (req, res) => {
  const { username, hostelIds } = req.body; // Array of IDs

  try {
    // 1. Remove old assignments
    await runQuery("DELETE FROM user_hostels WHERE username = ?", [username]);

    // 2. Insert new ones
    if (hostelIds && hostelIds.length > 0) {
      for (const hId of hostelIds) {
        await runQuery("INSERT INTO user_hostels (username, hostel_id) VALUES (?, ?)", [username, hId]);
      }
    }

    res.json({ code: 1, message: "Hostels assigned successfully." });
  } catch (error) {
    res.status(500).json({ code: 2, message: error.message });
  }
});

// Hostel Owner Revenue Report
router.get("/hostel-owner-revenue", async (req, res) => {
  const { username, hostelId } = req.query;

  try {
    const period = await getHostelOwnerRevenuePeriod();
    if (!period.period_start || !period.period_end) {
      return res.json({
        code: 1,
        data: [],
        stats: { totalSubscribers: 0, totalAmountCollected: 0 },
        period: { dateFrom: null, dateTo: null },
      });
    }

    let query = `
      SELECT 
        rs.id,
        rs.username,
        rc.fullname AS subscriber_name,
        rc.hostel AS hostel_name,
        rs.plan_amount,
        pm.name AS mode_of_payment,
        DATE_FORMAT(rs.payment_date, '%d-%m-%Y %h:%i %p') AS payment_date
      FROM radcheck_subs rs
      JOIN radcheck_client rc ON rs.username = rc.username
      JOIN payment_methods pm ON rs.mode_of_payment = pm.id
      JOIN hostel_list hl ON rc.hostel = hl.name
      JOIN user_hostels uh ON hl.id = uh.hostel_id
      WHERE uh.username = ?
        AND rs.payment_date >= ?
        AND rs.payment_date < DATE_ADD(?, INTERVAL 1 DAY)
    `;
    const params = [username, period.period_start, period.period_end];

    if (hostelId) {
      query += ` AND uh.hostel_id = ?`;
      params.push(hostelId);
    }
    query += ` ORDER BY rs.payment_date DESC`;

    const [err, rows] = await runQuery(query, params);
    if (err) throw err;

    const stats = {
      totalSubscribers: new Set(rows.map((row) => row.username)).size,
      totalAmountCollected: rows.reduce((sum, r) => sum + parseFloat(r.plan_amount), 0),
    };

    res.json({
      code: 1,
      data: rows.map((row) => {
        delete row.username;
        return row;
      }),
      stats,
      period: { dateFrom: period.period_start, dateTo: period.period_end },
    });
  } catch (error) {
    res.status(500).json({ code: 2, message: error.message });
  }
});

module.exports = router;
