const express = require('express');
const { runQuery, withTransaction } = require('../db');
const router = express.Router();

router.get('/billing-settings', async (req, res) => {
  const [error, rows] = await runQuery('SELECT first_month_policy AS firstMonthPolicy, automatic_billing AS automaticBilling FROM billing_settings WHERE id = 1');
  if (error || !rows.length) return res.status(500).json({ code: 2, message: 'Unable to load billing settings.' });
  return res.json({ code: 1, data: rows[0] });
});

router.patch('/billing-settings', async (req, res) => {
  if (!['Admin', 'Super Admin'].includes(req.user?.role)) return res.status(403).json({ code: 2, message: 'Administrator access is required.' });
  const policy = req.body.firstMonthPolicy;
  const automatic = req.body.automaticBilling;
  if (![true, false, 0, 1].includes(automatic)) return res.json({ code: 2, message: 'Choose whether automatic billing is enabled.' });
  if (!['full_month', 'prorated'].includes(policy)) return res.json({ code: 2, message: 'Select full-month or prorated billing.' });
  try {
    await withTransaction(async (connection) => {
      const [rows] = await connection.query('SELECT id FROM billing_settings WHERE id = 1 FOR UPDATE');
      if (!rows.length) throw new Error('Billing settings are missing.');
      await connection.query('UPDATE billing_settings SET first_month_policy = ?, automatic_billing = ?, updated_by_user_id = ? WHERE id = 1', [policy, automatic ? 1 : 0, req.user.user_id || null]);
      await connection.query('INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [req.user.user_id || null, 'UPDATE_BILLING_SETTINGS', JSON.stringify({ firstMonthPolicy: policy, automaticBilling: Boolean(automatic) }), req.ip]);
    });
    return res.json({ code: 1, data: { firstMonthPolicy: policy, automaticBilling: Boolean(automatic) }, message: 'Billing settings saved.' });
  } catch {
    return res.status(500).json({ code: 2, message: 'Unable to save billing settings.' });
  }
});

module.exports = router;
