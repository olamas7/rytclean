const express = require('express');
const { runQuery } = require('../db');
const { providerConfiguration } = require('../services/smsNotifications');
const { previewCampaign, queueCampaign } = require('../services/smsCampaigns');
const router = express.Router();
router.use((req, res, next) => ['Admin', 'Super Admin', 'Manager'].includes(req.user?.role)
  ? next() : res.status(403).json({ code: 2, message: 'Manager or administrator access is required.' }));
const query = async (sql, params = []) => { const [error, rows] = await runQuery(sql, params); if (error) throw error; return rows; };
const handle = (work) => async (req, res) => {
  try { await work(req, res); }
  catch (error) { res.status(error.status || 500).json({ code: 2, message: error.status ? error.message : 'Unable to process SMS notifications. Check SMS configuration and migrations.' }); }
};
router.get('/options', handle(async (req, res) => {
  const provider = providerConfiguration();
  const [zones, plans, categories] = await Promise.all([
    query('SELECT zone_code AS value, name AS label FROM zones ORDER BY name'),
    query('SELECT plan_code AS value, name AS label FROM plans ORDER BY name'),
    query('SELECT CAST(id AS CHAR) AS value, name AS label FROM client_categories ORDER BY name')
  ]);
  res.json({ code: 1, data: { sender: provider.sender, ready: provider.credentialsConfigured && Boolean(provider.sender), transport: provider.transport, zones, plans, categories } });
}));
router.post('/campaigns/preview', handle(async (req, res) => {
  res.json({ code: 1, data: await previewCampaign(req.body, Number(req.user.user_id)) });
}));
router.post('/campaigns/:id/send', handle(async (req, res) => {
  const data = await queueCampaign(req.params.id, req.body, Number(req.user.user_id));
  res.json({ code: 1, data, message: `${data.count} SMS notifications ${data.repeated ? 'were already queued; no duplicates created' : 'queued for sending'}.` });
}));
router.get('/history', handle(async (req, res) => {
  const page = Math.max(0, Math.min(100000, Number.parseInt(req.query.page, 10) || 0));
  const limit = [10, 25, 50, 100].includes(Number(req.query.limit)) ? Number(req.query.limit) : 25;
  const search = String(req.query.search || '').trim().slice(0, 100);
  const status = String(req.query.status || '');
  const event = String(req.query.event || '');
  const conditions = [];
  const params = [];
  if (search) { conditions.push('(LOCATE(?, UPPER(c.full_name)) > 0 OR LOCATE(?, c.customer_code) > 0 OR LOCATE(?, o.phone) > 0 OR LOCATE(?, o.message) > 0 OR LOCATE(?, sc.title) > 0)'); params.push(search.toUpperCase(), search, search, search, search); }
  if (status && status !== 'all') { conditions.push('o.status = ?'); params.push(status); }
  if (event && event !== 'all') { conditions.push('o.event_key = ?'); params.push(event); }
  const from = `FROM sms_outbox o LEFT JOIN customers c ON c.id = o.customer_id LEFT JOIN sms_campaigns sc ON sc.id = o.campaign_id ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}`;
  const [count] = await query(`SELECT COUNT(*) AS total ${from}`, params);
  const rows = await query(`SELECT o.id, o.event_key AS event, o.phone, o.message, o.status, o.detail, o.campaign_id AS campaignId,
    sc.title AS campaignTitle, o.created_at AS createdAt, o.attempted_at AS attemptedAt,
    UPPER(c.full_name) AS customerName, c.customer_code AS customerId ${from} ORDER BY o.id DESC LIMIT ? OFFSET ?`, [...params, limit, page * limit]);
  res.json({ code: 1, data: { rows, total: Number(count.total), page, limit } });
}));
module.exports = router;
