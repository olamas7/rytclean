const runQuery = require("../runQuery");

const SMS_AUTOMATION_SETTINGS = {
  purchase_confirmation: {
    title: "Purchase confirmation",
    defaultMessage: "Hello, your account {username} is active with unlimited data. Expires on {expiryDate}. Thank you.",
  },
  expiry_warning: {
    title: "Expiry warning",
    defaultMessage: "Hello, your account {username} expires soon. Please renew. https://kayfigh.com",
  },
  fair_use_throttle: {
    title: "Fair-use throttle",
    defaultMessage: "Hello, your account {username} has reached its fair-use allowance. You remain connected at a managed speed until {expiryDate}.",
  },
  super_throttle: {
    title: "Super Throttle",
    defaultMessage: "Hello, your account {username} has been temporarily restricted. You remain connected at a managed speed until {expiryDate}.",
  },
};

const ensureSmsAutomationSettingsTable = async () => {
  const [tableError] = await runQuery(`
    CREATE TABLE IF NOT EXISTS sms_automation_settings (
      event_key VARCHAR(64) PRIMARY KEY,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      message TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  if (tableError) throw tableError;

  for (const [eventKey, setting] of Object.entries(SMS_AUTOMATION_SETTINGS)) {
    const [seedError] = await runQuery(
      `INSERT INTO sms_automation_settings (event_key, enabled, message)
       VALUES (?, 1, ?)
       ON DUPLICATE KEY UPDATE event_key = VALUES(event_key)`,
      [eventKey, setting.defaultMessage],
    );
    if (seedError) throw seedError;
  }
};

const getSmsAutomationSettings = async () => {
  await ensureSmsAutomationSettingsTable();
  const [error, rows] = await runQuery(
    "SELECT event_key, enabled, message, updated_at FROM sms_automation_settings ORDER BY event_key",
  );
  if (error) throw error;

  return Object.entries(SMS_AUTOMATION_SETTINGS).map(([eventKey, setting]) => {
    const saved = rows.find((row) => row.event_key === eventKey);
    return {
      eventKey,
      title: setting.title,
      enabled: Number(saved?.enabled) === 1,
      message: saved?.message || setting.defaultMessage,
      updatedAt: saved?.updated_at || null,
    };
  });
};

const getSmsAutomationSetting = async (eventKey) => {
  const settings = await getSmsAutomationSettings();
  const setting = settings.find((item) => item.eventKey === eventKey);
  if (!setting) throw new Error("Unknown SMS automation setting.");
  return setting;
};

const updateSmsAutomationSetting = async (eventKey, enabled, message) => {
  if (!SMS_AUTOMATION_SETTINGS[eventKey]) throw new Error("Unknown SMS automation setting.");

  await ensureSmsAutomationSettingsTable();
  const [error] = await runQuery(
    "UPDATE sms_automation_settings SET enabled = ?, message = ? WHERE event_key = ?",
    [enabled ? 1 : 0, message, eventKey],
  );
  if (error) throw error;

  return getSmsAutomationSetting(eventKey);
};

const renderSmsAutomationMessage = (message, values) =>
  String(message)
    .replace(/\{username\}/g, values.username || "")
    .replace(/\{expiryDate\}/g, values.expiryDate || "");

module.exports = {
  SMS_AUTOMATION_SETTINGS,
  getSmsAutomationSetting,
  getSmsAutomationSettings,
  renderSmsAutomationMessage,
  updateSmsAutomationSetting,
};
