const express = require('express');
const { withTransaction, runQuery } = require('../db');
const { configuration, providerConfiguration, testSend } = require('../services/smsNotifications');
const { events, placeholders, validateTemplate } = require('../services/smsTemplates');
const router = express.Router();
router.use('/sms', (req, res, next) => {
  if (!['Admin', 'Super Admin'].includes(req.user?.role)) return res.status(403).json({ code: 2, message: 'Administrator access is required.' });
  return next();
});
const handle = (work) => async (req, res) => {
  try { await work(req, res); }
  catch (error) { res.status(error.status || 500).json({ code: 2, message: error.status === 400 ? error.message : 'SMS operation failed. Check server configuration and SMS migration.' }); }
};
const invalid = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
router.get('/sms/settings', handle(async (req, res) => res.json({ code: 1, data: { ...await configuration(), placeholders } })));
router.patch('/sms/settings', handle(async (req, res) => {
  const input = req.body;
  if (typeof input.enabled !== 'boolean') invalid('Choose whether automatic SMS is enabled.');
  if (!Array.isArray(input.events) || input.events.length !== Object.keys(events).length || new Set(input.events.map((event) => event.key)).size !== Object.keys(events).length) invalid('Supply each supported notification event exactly once.');
  for (const event of input.events) {
    if (!events[event.key] || typeof event.enabled !== 'boolean') invalid('Invalid notification event.');
    try { event.message = validateTemplate(event.message, event.key); } catch (error) { invalid(error.message); }
  }
  if (input.enabled) {
    let provider;
    try { provider = providerConfiguration(); } catch (error) { invalid(error.message); }
    if (!provider.credentialsConfigured || !provider.sender) invalid('Set SMS_API_KEY and SMS_SENDER_ID in server/.env before enabling SMS.');
  }
  await withTransaction(async (connection) => {
    await connection.query('UPDATE sms_settings SET enabled = ? WHERE id = 1', [input.enabled ? 1 : 0]);
    for (const event of input.events) await connection.query('UPDATE sms_events SET enabled = ?, message = ? WHERE event_key = ?', [event.enabled ? 1 : 0, event.message, event.key]);
    await connection.query('INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [req.user.user_id || null, 'UPDATE_SMS_SETTINGS', JSON.stringify({ enabled: input.enabled, events: input.events.map(({ key, enabled }) => ({ key, enabled })) }), req.ip]);
  });
  res.json({ code: 1, data: { ...await configuration(), placeholders }, message: 'SMS settings saved.' });
}));
router.get('/sms/logs', handle(async (req, res) => {
  const [error, rows] = await runQuery(`SELECT o.id, o.event_key AS event, o.phone, o.message, o.status, o.detail,
    o.created_at AS createdAt, o.attempted_at AS attemptedAt, UPPER(c.full_name) AS customerName, c.customer_code AS customerId
    FROM sms_outbox o LEFT JOIN customers c ON c.id = o.customer_id ORDER BY o.id DESC LIMIT 100`);
  if (error) throw error;
  res.json({ code: 1, data: rows });
}));
router.post('/sms/test', handle(async (req, res) => {
  const { phone, message, requestKey } = req.body;
  if (typeof phone !== 'string' || !/^0\d{9}$/.test(phone)) invalid('Enter a 10-digit Ghana phone number starting with 0.');
  if (typeof message !== 'string' || !message.trim() || message.length > 1000) invalid('Enter a test message of 1–1000 characters.');
  if (typeof requestKey !== 'string' || !/^[A-Za-z0-9-]{16,80}$/.test(requestKey)) invalid('A valid test request key is required.');
  const settings = await configuration();
  if (!settings.credentialsConfigured || !settings.sender) invalid('Configure SMS_API_KEY and a sender ID before testing.');
  // Bound deliberate test sends per authenticated administrator to 5 per 10 minutes.
  const allowed = await withTransaction(async (connection) => {
    await connection.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [req.user.user_id]);
    const [rows] = await connection.query("SELECT COUNT(*) AS total FROM activity_logs WHERE user_id = ? AND action = 'TEST_SMS' AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)", [req.user.user_id]);
    if (Number(rows[0].total) >= 5) return false;
    await connection.query('INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [req.user.user_id, 'TEST_SMS', JSON.stringify({ requestKey }), req.ip]);
    return true;
  });
  if (!allowed) return res.status(429).json({ code: 2, message: 'Test limit reached. Wait 10 minutes.' });
  const data = await testSend(phone, message.trim(), requestKey);
  return res.json({ code: 1, data, message: data.detail || 'Test request recorded.' });
}));
module.exports = router;
