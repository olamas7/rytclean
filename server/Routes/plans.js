const express = require('express');
const { runQuery, withTransaction } = require('../db');
const { nextMonthStart } = require('../services/planPricing');
const router = express.Router();
const canManage = (req, res, next) => ['Admin', 'Super Admin', 'Manager'].includes(req.user?.role)
  ? next() : res.status(403).json({ code: 2, message: 'Manager or administrator access is required to change plans.' });

router.get('/plans', async (req, res) => {
  const [error, rows] = await runQuery(`SELECT p.id, p.plan_code AS planCode, p.name,
    p.billing_cycle AS billingCycle,
    (SELECT pp.amount FROM plan_prices pp WHERE pp.plan_id = p.id AND pp.effective_from <= UTC_DATE() ORDER BY pp.effective_from DESC LIMIT 1) AS amount,
    (SELECT pp.amount FROM plan_prices pp WHERE pp.plan_id = p.id AND pp.effective_from > UTC_DATE() ORDER BY pp.effective_from LIMIT 1) AS nextAmount,
    (SELECT DATE_FORMAT(pp.effective_from, '%Y-%m-%d') FROM plan_prices pp WHERE pp.plan_id = p.id AND pp.effective_from > UTC_DATE() ORDER BY pp.effective_from LIMIT 1) AS nextEffectiveDate,
    p.pickup_frequency AS pickupFrequency, p.grace_days AS graceDays, p.status,
    (SELECT COUNT(DISTINCT h.customer_id) FROM customer_plan_history h WHERE h.plan_id = p.id) AS customerCount,
    p.created_at, p.updated_at
    FROM plans p ORDER BY p.created_at DESC, p.id DESC`);
  if (error) return res.status(500).json({ code: 2, message: 'Unable to load plans.' });
  return res.json({ code: 1, data: rows, message: 'Plans loaded.' });
});

const savePlan = async (req, res) => {
  const editing = Boolean(req.params.id);
  const id = Number(req.params.id);
  const text = (name) => typeof req.body[name] === 'string' ? req.body[name].trim() : '';
  const planCode = text('planCode');
  const name = text('name');
  const billingCycle = text('billingCycle');
  const status = text('status');
  const amountText = String(req.body.amount ?? '').trim();
  const amount = Number(amountText);
  const pickupFrequency = Number(req.body.pickupFrequency);
  const graceDays = Number(req.body.graceDays);
  if ((editing && (!Number.isSafeInteger(id) || id <= 0)) || !planCode || planCode.length > 60 || !/^[A-Za-z0-9_-]+$/.test(planCode) || !name || name.length > 150) {
    return res.json({ code: 2, message: 'Enter a valid plan code and name. Codes can contain letters, numbers, hyphens and underscores.' });
  }
  if (!['monthly', 'quarterly', 'yearly'].includes(billingCycle) || !['active', 'inactive'].includes(status)) {
    return res.json({ code: 2, message: 'Select a valid billing cycle and status.' });
  }
  if (!/^\d+(\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amount) || amount > 99999999.99) {
    return res.json({ code: 2, message: 'Enter a non-negative amount with no more than two decimal places.' });
  }
  if (req.body.pickupFrequency === '' || !Number.isSafeInteger(pickupFrequency) || pickupFrequency < 1 || pickupFrequency > 2147483647
    || req.body.graceDays === '' || req.body.graceDays === null || req.body.graceDays === undefined || !Number.isSafeInteger(graceDays) || graceDays < 0 || graceDays > 2147483647) {
    return res.json({ code: 2, message: 'Pickups per week must be a positive whole number; grace days must be a non-negative whole number.' });
  }
  try {
    const result = await withTransaction(async (connection) => {
      let planId = id;
      let scheduledDate = null;
      if (editing) {
        const [rows] = await connection.query('SELECT * FROM plans WHERE id = ? FOR UPDATE', [id]);
        if (!rows.length) { const error = new Error('Plan not found.'); error.status = 404; throw error; }
        if (planCode !== rows[0].plan_code) { const error = new Error('Plan codes cannot be changed after creation.'); error.status = 400; throw error; }
        if (billingCycle !== rows[0].billing_cycle) {
          const [assigned] = await connection.query('SELECT id FROM customers WHERE plan_code = ? UNION SELECT customer_id FROM customer_plan_history WHERE plan_id = ? LIMIT 1', [planCode, id]);
          if (assigned.length) { const error = new Error('This plan has customers. Create a new plan to use a different billing cycle.'); error.status = 400; throw error; }
        }
        const [prices] = await connection.query('SELECT amount FROM plan_prices WHERE plan_id = ? AND effective_from <= UTC_DATE() ORDER BY effective_from DESC LIMIT 1', [id]);
        if (!prices.length) { const error = new Error('The current plan price is missing. Run the pricing migration before editing.'); error.status = 400; throw error; }
        const effectiveFrom = nextMonthStart();
        if (Number(prices[0].amount) !== amount) {
          await connection.query(`INSERT INTO plan_prices (plan_id, amount, effective_from, updated_by_user_id) VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE amount = VALUES(amount), updated_by_user_id = VALUES(updated_by_user_id)`, [id, amountText, effectiveFrom, req.user.user_id || null]);
          scheduledDate = effectiveFrom;
        } else {
          // Returning to the current amount cancels an unstarted next-month change only.
          await connection.query('DELETE FROM plan_prices WHERE plan_id = ? AND effective_from = ? AND effective_from > UTC_DATE()', [id, effectiveFrom]);
        }
        await connection.query('UPDATE plans SET name = ?, billing_cycle = ?, amount = ?, pickup_frequency = ?, grace_days = ?, status = ? WHERE id = ?', [name, billingCycle, amountText, pickupFrequency, graceDays, status, id]);
      } else {
        const [created] = await connection.query('INSERT INTO plans (plan_code, name, billing_cycle, amount, pickup_frequency, grace_days, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [planCode, name, billingCycle, amountText, pickupFrequency, graceDays, status]);
        planId = created.insertId;
        await connection.query('INSERT INTO plan_prices (plan_id, amount, effective_from, updated_by_user_id) VALUES (?, ?, UTC_DATE(), ?)', [planId, amountText, req.user.user_id || null]);
      }
      await connection.query('INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [req.user.user_id || null, editing ? 'UPDATE_PLAN' : 'CREATE_PLAN', JSON.stringify({ planCode, amount: amountText, priceEffectiveFrom: scheduledDate, billingCycle }), req.ip]);
      return { id: planId, nextEffectiveDate: scheduledDate };
    });
    return res.json({ code: 1, data: result, message: result.nextEffectiveDate ? `Plan saved. The new amount is available for service cycles starting on or after ${result.nextEffectiveDate}.` : editing ? 'Plan updated successfully.' : 'Plan created successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.json({ code: 2, message: 'Plan code already exists.' });
    return res.status(error.status || 500).json({ code: 2, message: error.status ? error.message : 'Unable to save plan.' });
  }
};

router.post('/plans', canManage, savePlan);
router.patch('/plans/:id', canManage, savePlan);
module.exports = router;
