const express = require('express');
const { runQuery, withTransaction } = require('../db');
const { activateSubscription, postEntry, runBilling, lockCustomer, today, dateText, nextMonth } = require('../services/billingAccounts');
const router = express.Router();

router.use((req, res, next) => ['Admin', 'Super Admin', 'Manager', 'Accountant'].includes(req.user?.role)
  ? next() : res.status(403).json({ code: 2, message: 'Financial account access is required.' }));
const handle = (work) => async (req, res) => {
  try { return await work(req, res); }
  catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ code: 2, message: 'This account entry or payment reference has already been recorded. Refresh the statement before retrying.' });
    return res.status(error.status || 500).json({ code: 2, message: error.status ? error.message : 'Unable to process this account request.' });
  }
};
const query = async (sql, params = []) => { const [error, rows] = await runQuery(sql, params); if (error) throw error; return rows; };
router.use(async (req, res, next) => {
  try {
    const [user] = await query('SELECT role, status FROM users WHERE id = ?', [req.user.user_id]);
    if (!user || Number(user.status) !== 1 || !['Admin', 'Super Admin', 'Manager', 'Accountant'].includes(user.role)) return res.status(403).json({ code: 2, message: 'Active financial staff access is required.' });
    next();
  } catch { res.status(500).json({ code: 2, message: 'Unable to confirm financial access.' }); }
});
const invoiceData = (row) => {
  const amount = Number(row.amount_cents);
  const settled = Number(row.settled_cents);
  const outstanding = row.voided ? 0 : Math.max(0, amount - settled);
  return { ...row, id: String(row.id), customerId: row.customerId, amountCents: amount, settledCents: settled, outstandingCents: outstanding,
    periodStart: dateText(row.period_start), periodEnd: dateText(row.period_end), serviceStart: dateText(row.service_start), issuedOn: dateText(row.issued_on), dueOn: dateText(row.due_on),
    status: row.voided ? 'voided' : !outstanding ? 'paid' : dateText(row.due_on) < today() ? 'overdue' : settled > 0 ? 'partially paid' : 'unpaid' };
};

router.get('/accounts', handle(async (req, res) => {
  const rows = await query(`SELECT c.customer_code AS id, UPPER(c.full_name) AS fullName, c.phone, p.name AS planName,
    COALESCE(s.status, 'needs_review') AS billingStatus, s.hold_reason AS holdReason,
    COALESCE(l.balance, 0) AS balanceCents,
    COALESCE(i.overdue, 0) AS overdueCents,
    DATE_FORMAT(s.next_cycle_start, '%Y-%m-%d') AS nextCycleStart
    FROM customers c LEFT JOIN plans p ON p.plan_code = c.plan_code
    LEFT JOIN billing_subscriptions s ON s.customer_id = c.id
    LEFT JOIN (SELECT customer_id, SUM(debit_cents - credit_cents) AS balance FROM account_ledger GROUP BY customer_id) l ON l.customer_id = c.id
    LEFT JOIN (SELECT customer_id, SUM(GREATEST(amount_cents - settled_cents, 0)) AS overdue FROM billing_invoices WHERE voided = 0 AND due_on < UTC_DATE() GROUP BY customer_id) i ON i.customer_id = c.id
    ORDER BY c.full_name, c.id`);
  return res.json({ code: 1, data: rows.map((row) => ({ ...row, balanceCents: Number(row.balanceCents), overdueCents: Number(row.overdueCents) })) });
}));

router.get('/invoices', handle(async (req, res) => {
  const rows = await query(`SELECT i.*, c.customer_code AS customerId, UPPER(c.full_name) AS fullName
    FROM billing_invoices i JOIN customers c ON c.id = i.customer_id ORDER BY i.id DESC`);
  return res.json({ code: 1, data: rows.map(invoiceData) });
}));

router.get('/payments', handle(async (req, res) => {
  const rows = await query(`SELECT l.id, c.customer_code AS customerId, UPPER(c.full_name) AS fullName,
    l.credit_cents AS amountCents, DATE_FORMAT(l.occurred_on, '%Y-%m-%d') AS date,
    l.payment_method AS method, l.payment_reference AS reference, l.description,
    COALESCE(l.payment_source, 'staff') AS source, CASE WHEN l.payment_source = 'paystack' THEN NULL ELSE COALESCE(l.collector_name, u.fullname, 'Legacy staff record') END AS collectorName,
    EXISTS(SELECT 1 FROM account_ledger r WHERE r.reverses_entry_id = l.id) AS reversed
    FROM account_ledger l JOIN customers c ON c.id = l.customer_id LEFT JOIN users u ON u.id = l.created_by_user_id WHERE l.entry_type = 'payment' ORDER BY l.id DESC`);
  return res.json({ code: 1, data: rows.map((row) => ({ ...row, id: String(row.id), amountCents: Number(row.amountCents), receipt: `RCPT-${row.id}`, status: row.reversed ? 'reversed' : 'paid' })) });
}));

router.get('/gateway-payments', handle(async (req, res) => {
  const rows = await query(`SELECT g.id, g.reference, c.customer_code AS customerId, UPPER(c.full_name) AS fullName,
    g.amount_cents AS amountCents, g.status, g.environment, g.ledger_id AS ledgerId, g.created_at AS createdAt,
    g.provider, g.last_checked_at AS lastCheckedAt,
    EXISTS(SELECT 1 FROM account_ledger r WHERE r.reverses_entry_id = g.ledger_id) AS reversed
    FROM gateway_payments g JOIN customers c ON c.id = g.customer_id ORDER BY g.id DESC`);
  res.json({ code: 1, data: rows.map((row) => ({ ...row, id: String(row.id), amountCents: Number(row.amountCents), date: dateText(row.createdAt), receipt: row.ledgerId ? `RCPT-${row.ledgerId}` : null })) });
}));
router.post('/gateway-payments/:id/verify', handle(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ code: 2, message: 'Select a valid Paystack transaction.' });
  const [payment] = await query('SELECT reference FROM gateway_payments WHERE id = ?', [req.params.id]);
  if (!payment) return res.status(404).json({ code: 2, message: 'Paystack transaction not found.' });
  await require('../services/customerPayments').verifyReference(payment.reference);
  res.json({ code: 1, message: 'Verification checked. Only a matching, confirmed Paystack success can credit the ledger; review the updated status.' });
}));

router.get('/customers/:id/account', handle(async (req, res) => {
  const data = await withTransaction(async (connection) => {
    const customer = await lockCustomer(connection, req.params.id);
    const [subscriptions] = await connection.query('SELECT * FROM billing_subscriptions WHERE customer_id = ?', [customer.id]);
    const [plan] = await connection.query(`SELECT p.plan_code AS planId, p.name AS planName FROM customer_plan_history h JOIN plans p ON p.id = h.plan_id WHERE h.customer_id = ? AND h.effective_from <= UTC_DATE() ORDER BY h.effective_from DESC LIMIT 1`, [customer.id]);
    const [pending] = await connection.query(`SELECT p.plan_code AS planId, p.name AS planName, DATE_FORMAT(h.effective_from, '%Y-%m-%d') AS effectiveFrom
      FROM customer_plan_history h JOIN plans p ON p.id = h.plan_id WHERE h.customer_id = ? AND h.effective_from > UTC_DATE() ORDER BY h.effective_from LIMIT 1`, [customer.id]);
    const [entries] = await connection.query('SELECT l.*, u.fullname AS actor_name FROM account_ledger l LEFT JOIN users u ON u.id = l.created_by_user_id WHERE l.customer_id = ? ORDER BY l.id', [customer.id]);
    const reversed = new Set(entries.filter((entry) => entry.reverses_entry_id).map((entry) => String(entry.reverses_entry_id)));
    let balance = 0;
    const statement = entries.map((entry) => {
      const debit = Number(entry.debit_cents);
      const credit = Number(entry.credit_cents);
      balance += debit - credit;
      if (!Number.isSafeInteger(balance)) throw new Error('Account total exceeds supported precision.');
      return { id: String(entry.id), date: dateText(entry.occurred_on), type: entry.entry_type, description: entry.description,
        debitCents: debit, creditCents: credit, balanceCents: balance, method: entry.payment_method, reference: entry.payment_reference,
        source: entry.payment_source || (entry.entry_type === 'payment' ? 'staff' : null), collectorName: entry.payment_source === 'paystack' ? null : entry.collector_name || entry.actor_name || 'Legacy staff record',
        invoiceId: entry.invoice_id ? String(entry.invoice_id) : null, reversed: reversed.has(String(entry.id)), reversesEntryId: entry.reverses_entry_id ? String(entry.reverses_entry_id) : null };
    });
    const [invoiceRows] = await connection.query('SELECT * FROM billing_invoices WHERE customer_id = ? ORDER BY id DESC', [customer.id]);
    const invoices = invoiceRows.map(invoiceData);
    const activeEntries = entries.filter((entry) => !entry.reverses_entry_id && !reversed.has(String(entry.id)));
    const sub = subscriptions[0];
    return { customer: { id: customer.customer_code, fullName: customer.full_name.toUpperCase(), phone: customer.phone, status: customer.status, joinedDate: dateText(customer.joined_date || customer.created_at), planId: plan[0]?.planId || customer.plan_code, planName: plan[0]?.planName || customer.plan_code },
      subscription: { status: sub?.status || 'needs_review', holdReason: sub?.hold_reason, serviceStart: sub?.service_start ? dateText(sub.service_start) : null,
        nextCycleStart: sub?.next_cycle_start ? dateText(sub.next_cycle_start) : null, firstMonthPolicy: sub?.first_month_policy,
        billEligibleFrom: sub?.status === 'active' && sub.next_cycle_start ? nextMonth(dateText(sub.next_cycle_start)) : null,
        cycleAmountCents: sub?.cycle_amount_cents === null || !sub ? null : Number(sub.cycle_amount_cents) },
      pendingPlan: pending[0] || null, statement, invoices,
      summary: { balanceCents: balance, owingCents: Math.max(0, balance), creditCents: Math.max(0, -balance),
        totalBilledCents: invoices.filter((invoice) => !invoice.voided).reduce((sum, invoice) => sum + invoice.amountCents, 0),
        totalPaidCents: activeEntries.filter((entry) => entry.entry_type === 'payment').reduce((sum, entry) => sum + Number(entry.credit_cents), 0),
        overdueCents: invoices.filter((invoice) => invoice.dueOn < today()).reduce((sum, invoice) => sum + invoice.outstandingCents, 0) } };
  });
  return res.json({ code: 1, data });
}));

router.post('/customers/:id/activate', handle(async (req, res) => {
  await activateSubscription(req.params.id, req.body.serviceStart, req.user.user_id);
  return res.json({ code: 1, message: 'Monthly billing activated from the selected service date.' });
}));
router.post('/customers/:id/entries', handle(async (req, res) => {
  const data = await postEntry(req.params.id, req.body, req.user.user_id);
  return res.json({ code: 1, data, message: data.repeated ? 'This entry was already recorded. No duplicate was created.' : 'Account entry recorded successfully.' });
}));
router.post('/run', handle(async (req, res) => {
  const data = await runBilling(req.user.user_id, req.body.customerId || null);
  return res.json({ code: 1, data, message: `${data.created} bills created. ${data.skipped.length} accounts were held/skipped during this run. Only completed monthly service periods were considered.${data.batchLimitReached ? ' Batch limit reached; run again to process any remaining due accounts.' : ''}` });
}));
module.exports = router;
