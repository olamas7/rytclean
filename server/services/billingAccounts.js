const { createHash } = require('crypto');
const { runQuery, withTransaction } = require('../db');
const { resolvePlanPrice, nextMonthStart } = require('./planPricing');
const { enqueue, amountText } = require('./smsNotifications');

const today = () => new Date().toISOString().slice(0, 10);
const dateText = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const validDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const addDays = (value, days) => { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
const monthStart = (value) => `${value.slice(0, 7)}-01`;
const nextMonth = (value) => { const date = new Date(`${monthStart(value)}T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + 1); return date.toISOString().slice(0, 10); };
const moneyCents = (value) => {
  const text = String(value ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw fail('Enter a valid amount with up to two decimal places.');
  const [whole, decimal = ''] = text.split('.');
  const cents = Number(BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0')));
  if (!Number.isSafeInteger(cents) || cents > 9999999999) throw fail('Amount exceeds the supported limit.');
  return cents;
};
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const audit = (connection, actor, action, details) => connection.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)', [actor || null, action, JSON.stringify(details)]);

async function lockCustomer(connection, code) {
  const [rows] = await connection.query('SELECT * FROM customers WHERE customer_code = ? FOR UPDATE', [code]);
  if (!rows.length) throw fail('Customer not found.', 404);
  return rows[0];
}

async function planAt(connection, customerId, date) {
  const [rows] = await connection.query(`SELECT p.* FROM customer_plan_history h JOIN plans p ON p.id = h.plan_id
    WHERE h.customer_id = ? AND h.effective_from <= ? ORDER BY h.effective_from DESC LIMIT 1`, [customerId, date]);
  if (!rows.length) throw fail('The customer’s plan history needs review before billing.');
  return rows[0];
}

async function snapshotCycle(connection, subscription) {
  const period = dateText(subscription.next_cycle_start);
  const serviceStart = dateText(subscription.service_start);
  const rateDate = period < serviceStart ? serviceStart : period;
  const plan = await planAt(connection, subscription.customer_id, rateDate);
  if (plan.billing_cycle !== 'monthly') throw fail('Quarterly/yearly billing is on hold until its cycle rules are agreed.');
  let price;
  try { price = await resolvePlanPrice(connection, plan.id, rateDate); }
  catch (error) { if (error.message.startsWith('No recorded plan price')) throw fail(error.message); throw error; }
  const cents = moneyCents(price.amount);
  await connection.query(`UPDATE billing_subscriptions SET cycle_plan_id = ?, cycle_plan_code = ?, cycle_plan_name = ?, cycle_amount_cents = ?, cycle_grace_days = ? WHERE customer_id = ?`, [plan.id, plan.plan_code, plan.name, cents, plan.grace_days, subscription.customer_id]);
  Object.assign(subscription, { cycle_plan_id: plan.id, cycle_plan_code: plan.plan_code, cycle_plan_name: plan.name, cycle_amount_cents: cents, cycle_grace_days: plan.grace_days });
}

async function enrolCustomer(connection, customer, actor) {
  const [plans] = await connection.query('SELECT * FROM plans WHERE plan_code = ?', [customer.plan_code]);
  const plan = plans[0];
  await connection.query('INSERT INTO billing_subscriptions (customer_id) VALUES (?)', [customer.id]);
  if (!plan) return;
  const joined = dateText(customer.joined_date || customer.created_at);
  await connection.query('INSERT INTO customer_plan_history (customer_id, plan_id, effective_from, created_by_user_id) VALUES (?, ?, ?, ?)', [customer.id, plan.id, joined >= today() ? joined : today(), actor || null]);
  if (customer.status !== 'active' || plan.billing_cycle !== 'monthly' || joined < today()) return;
  const [settings] = await connection.query('SELECT first_month_policy FROM billing_settings WHERE id = 1');
  const sub = { customer_id: customer.id, service_start: joined, next_cycle_start: monthStart(joined), first_month_policy: settings[0].first_month_policy };
  await connection.query("UPDATE billing_subscriptions SET status = 'active', service_start = ?, next_cycle_start = ?, first_month_policy = ? WHERE customer_id = ?", [joined, sub.next_cycle_start, sub.first_month_policy, customer.id]);
  if (joined <= today()) await snapshotCycle(connection, sub);
  await audit(connection, actor, 'ENROL_MONTHLY_BILLING', { customer: customer.customer_code, serviceStart: joined, policy: sub.first_month_policy });
}

async function schedulePlan(connection, customer, planCode, actor) {
  const [plans] = await connection.query("SELECT * FROM plans WHERE plan_code = ? AND (status = 'active' OR plan_code = ?)", [planCode, customer.plan_code]);
  if (!plans.length) throw fail('Select an active plan.');
  const [subscriptions] = await connection.query('SELECT status FROM billing_subscriptions WHERE customer_id = ?', [customer.id]);
  if (!subscriptions.length) await connection.query('INSERT INTO billing_subscriptions (customer_id) VALUES (?)', [customer.id]);
  const [history] = await connection.query('SELECT id FROM customer_plan_history WHERE customer_id = ? LIMIT 1', [customer.id]);
  if (!history.length) {
    // Repair an unrecognised legacy plan; no subscription is activated and no charges are made.
    await connection.query('INSERT INTO customer_plan_history (customer_id, plan_id, effective_from, created_by_user_id) VALUES (?, ?, ?, ?)', [customer.id, plans[0].id, today(), actor || null]);
    await connection.query('UPDATE customers SET plan_code = ? WHERE id = ?', [planCode, customer.id]);
    return null;
  }
  const effective = nextMonthStart();
  const [current] = await connection.query(`SELECT p.* FROM customer_plan_history h JOIN plans p ON p.id = h.plan_id WHERE h.customer_id = ? AND h.effective_from <= ? ORDER BY h.effective_from DESC LIMIT 1`, [customer.id, today()]);
  if (!current.length) {
    const [future] = await connection.query('SELECT effective_from FROM customer_plan_history WHERE customer_id = ? ORDER BY effective_from LIMIT 1', [customer.id]);
    await connection.query('UPDATE customer_plan_history SET plan_id = ?, created_by_user_id = ? WHERE customer_id = ? AND effective_from = ?', [plans[0].id, actor || null, customer.id, future[0].effective_from]);
    await connection.query('UPDATE customers SET plan_code = ? WHERE id = ?', [planCode, customer.id]);
    await connection.query('UPDATE billing_subscriptions SET cycle_amount_cents = NULL WHERE customer_id = ?', [customer.id]);
    return dateText(future[0].effective_from);
  }
  const currentPlan = current[0];
  if (currentPlan.plan_code === planCode) await connection.query('DELETE FROM customer_plan_history WHERE customer_id = ? AND effective_from = ?', [customer.id, effective]);
  else await connection.query(`INSERT INTO customer_plan_history (customer_id, plan_id, effective_from, created_by_user_id) VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE plan_id = VALUES(plan_id), created_by_user_id = VALUES(created_by_user_id)`, [customer.id, plans[0].id, effective, actor || null]);
  await audit(connection, actor, 'SCHEDULE_CUSTOMER_PLAN', { customer: customer.customer_code, planCode, effectiveFrom: effective });
  return currentPlan.plan_code === planCode ? null : effective;
}

async function rebalance(connection, customerId) {
  const [entries] = await connection.query('SELECT * FROM account_ledger WHERE customer_id = ? ORDER BY occurred_on, id', [customerId]);
  const reversed = new Set(entries.filter((entry) => entry.reverses_entry_id).map((entry) => String(entry.reverses_entry_id)));
  const active = entries.filter((entry) => !entry.reverses_entry_id && !reversed.has(String(entry.id)));
  let debitTotal = 0;
  for (const entry of active) {
    debitTotal += Number(entry.debit_cents);
    if (!Number.isSafeInteger(debitTotal)) throw fail('Account totals exceed the supported limit. Contact an administrator.');
  }
  let available = active.reduce((sum, entry) => sum + Number(entry.credit_cents), 0);
  if (!Number.isSafeInteger(available)) throw fail('Account totals exceed the supported limit. Contact an administrator.');
  for (const entry of active) {
    const debit = Number(entry.debit_cents);
    if (!debit) continue;
    const allocated = Math.min(available, debit);
    available -= allocated;
    if (entry.invoice_id) await connection.query('UPDATE billing_invoices SET settled_cents = ? WHERE id = ?', [allocated, entry.invoice_id]);
  }
  for (const entry of entries.filter((entry) => entry.invoice_id && reversed.has(String(entry.id)))) await connection.query('UPDATE billing_invoices SET voided = 1, settled_cents = 0 WHERE id = ?', [entry.invoice_id]);
}

async function activateSubscription(code, serviceStart, actor) {
  if (!validDate(serviceStart) || serviceStart < today()) throw fail('Billing must start today or later. Historical arrears require a reviewed adjustment.');
  return withTransaction(async (connection) => {
    const customer = await lockCustomer(connection, code);
    if (customer.status !== 'active') throw fail('Activate the customer before starting billing.');
    if (serviceStart < dateText(customer.joined_date || customer.created_at)) throw fail('Billing cannot start before the joined date.');
    const [rows] = await connection.query('SELECT * FROM billing_subscriptions WHERE customer_id = ? FOR UPDATE', [customer.id]);
    if (rows[0]?.status === 'active') throw fail('Billing is already active for this customer.');
    const [invoices] = await connection.query('SELECT id FROM billing_invoices WHERE customer_id = ? AND period_start = ? LIMIT 1', [customer.id, monthStart(serviceStart)]);
    if (invoices.length) throw fail('This month already has an invoice. Choose a later month.');
    const [settings] = await connection.query('SELECT first_month_policy FROM billing_settings WHERE id = 1');
    const sub = { customer_id: customer.id, service_start: serviceStart, next_cycle_start: monthStart(serviceStart), first_month_policy: settings[0].first_month_policy };
    await connection.query(`INSERT INTO billing_subscriptions (customer_id, status, service_start, next_cycle_start, first_month_policy)
      VALUES (?, 'active', ?, ?, ?) ON DUPLICATE KEY UPDATE status = 'active', hold_reason = NULL, service_start = VALUES(service_start), next_cycle_start = VALUES(next_cycle_start), first_month_policy = VALUES(first_month_policy), cycle_amount_cents = NULL`, [customer.id, serviceStart, sub.next_cycle_start, sub.first_month_policy]);
    // Validate the plan/price now; future-start cycles are re-snapshotted when service begins.
    await snapshotCycle(connection, sub);
    if (serviceStart > today()) await connection.query('UPDATE billing_subscriptions SET cycle_amount_cents = NULL WHERE customer_id = ?', [customer.id]);
    await audit(connection, actor, 'ACTIVATE_BILLING', { customer: code, serviceStart, policy: sub.first_month_policy });
    return sub;
  });
}

async function billCustomer(code, actor) {
  return withTransaction(async (connection) => {
    const customer = await lockCustomer(connection, code);
    const [rows] = await connection.query('SELECT * FROM billing_subscriptions WHERE customer_id = ? FOR UPDATE', [customer.id]);
    const sub = rows[0];
    if (!sub || sub.status !== 'active') return { created: 0, skipped: 'Billing needs activation/review.' };
    if (customer.status !== 'active' && sub.cycle_amount_cents === null) {
      await connection.query("UPDATE billing_subscriptions SET status = 'paused' WHERE customer_id = ?", [customer.id]);
      return { created: 0, skipped: 'Billing paused: the customer became inactive before this cycle started.' };
    }
    if (dateText(sub.service_start) > today()) return { created: 0, skipped: 'Service has not started.' };
    let created = 0;
    let held = '';
    const freezeOrHold = async () => {
      try { await snapshotCycle(connection, sub); return true; }
      catch (error) {
        if (!error.status) throw error;
        held = error.message;
        await connection.query("UPDATE billing_subscriptions SET status = 'needs_review', hold_reason = ? WHERE customer_id = ?", [held.slice(0, 255), customer.id]);
        return false;
      }
    };
    for (let index = 0; index < 24; index += 1) {
      if (sub.cycle_amount_cents === null && !await freezeOrHold()) break;
      const start = dateText(sub.next_cycle_start);
      const next = nextMonth(start);
      if (next > today()) break; // Bill only fully completed months.
      const end = addDays(next, -1);
      const monthDays = Number(end.slice(8, 10));
      const actualStart = dateText(sub.service_start) > start ? dateText(sub.service_start) : start;
      const days = Math.round((Date.parse(`${next}T00:00:00Z`) - Date.parse(`${actualStart}T00:00:00Z`)) / 86400000);
      const rate = Number(sub.cycle_amount_cents);
      const prorated = sub.first_month_policy === 'prorated' && monthStart(dateText(sub.service_start)) === start;
      const amount = prorated ? Number((BigInt(rate) * BigInt(days) + BigInt(Math.floor(monthDays / 2))) / BigInt(monthDays)) : rate;
      const reference = `INV-${start.slice(0, 7).replace('-', '')}-${customer.customer_code}`;
      const [existing] = await connection.query('SELECT id FROM billing_invoices WHERE customer_id = ? AND period_start = ?', [customer.id, start]);
      if (!existing.length) {
        const [invoice] = await connection.query(`INSERT INTO billing_invoices
          (reference, customer_id, period_start, period_end, service_start, plan_code, plan_name, rate_cents, amount_cents, first_month_policy, service_days, month_days, issued_on, due_on)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [reference, customer.id, start, end, actualStart, sub.cycle_plan_code, sub.cycle_plan_name, rate, amount, prorated ? 'prorated' : 'full_month', days, monthDays, today(), addDays(today(), Number(sub.cycle_grace_days))]);
        await connection.query(`INSERT INTO account_ledger (customer_id, entry_type, debit_cents, occurred_on, description, invoice_id, request_key, created_by_user_id)
          VALUES (?, 'invoice', ?, ?, ?, ?, ?, ?)`, [customer.id, amount, today(), `${sub.cycle_plan_name}: ${start} to ${end}`, invoice.insertId, `invoice:${customer.id}:${start}`, actor || null]);
        created += 1;
        await enqueue(connection, 'bill', customer, `bill:${invoice.insertId}`, { amount: amountText(amount), reference, dueDate: addDays(today(), Number(sub.cycle_grace_days)) }, invoice.insertId);
      }
      sub.next_cycle_start = next;
      sub.cycle_amount_cents = null;
      await connection.query('UPDATE billing_subscriptions SET next_cycle_start = ?, cycle_amount_cents = NULL WHERE customer_id = ?', [next, customer.id]);
      if (customer.status !== 'active') {
        await connection.query("UPDATE billing_subscriptions SET status = 'paused' WHERE customer_id = ?", [customer.id]);
        break;
      }
    }
    // Freeze this month's price before later edits can affect its eventual invoice.
    if (!held && customer.status === 'active' && sub.cycle_amount_cents === null && dateText(sub.next_cycle_start) <= today()) await freezeOrHold();
    await rebalance(connection, customer.id);
    if (created) await audit(connection, actor, 'GENERATE_CUSTOMER_BILLS', { customer: code, created });
    return { created, ...(held ? { skipped: held } : {}) };
  });
}

async function syncOperationalPlans() {
  const [error] = await runQuery(`UPDATE customers c JOIN customer_plan_history h ON h.id =
    (SELECT h2.id FROM customer_plan_history h2 WHERE h2.customer_id = c.id AND h2.effective_from <= UTC_DATE() ORDER BY h2.effective_from DESC LIMIT 1)
    JOIN plans p ON p.id = h.plan_id SET c.plan_code = p.plan_code WHERE c.plan_code <> p.plan_code`);
  if (error) throw fail('Unable to apply scheduled plan changes.', 500);
}

let running = false;
async function runBilling(actor, customerCode, automatic = false) {
  if (running) throw fail('A billing run is already in progress. Please try again shortly.', 409);
  running = true;
  try {
    await syncOperationalPlans();
    const [error, settings] = await runQuery('SELECT automatic_billing FROM billing_settings WHERE id = 1');
    if (error || !settings.length) throw fail('Unable to load billing settings.', 500);
    if (automatic && !settings[0].automatic_billing) return { created: 0, processed: 0, skipped: [] };
    const [loadError, customers] = await runQuery(`SELECT c.customer_code FROM customers c JOIN billing_subscriptions s ON s.customer_id = c.id
      WHERE s.status = 'active' AND s.service_start <= UTC_DATE()
      AND (DATE_ADD(s.next_cycle_start, INTERVAL 1 MONTH) <= UTC_DATE() OR s.cycle_amount_cents IS NULL)
      ${customerCode ? 'AND c.customer_code = ?' : ''} ORDER BY s.next_cycle_start, c.id LIMIT 250`, customerCode ? [customerCode] : []);
    if (loadError) throw fail('Unable to load billing subscriptions.', 500);
    const result = { created: 0, processed: customers.length, batchLimitReached: customers.length === 250, skipped: [] };
    for (const customer of customers) {
      try {
        const account = await billCustomer(customer.customer_code, actor);
        result.created += account.created;
        if (account.skipped) result.skipped.push({ customerId: customer.customer_code, reason: account.skipped });
      } catch (error) { result.skipped.push({ customerId: customer.customer_code, reason: error.status ? error.message : 'Billing failed. Review the subscription and recorded price history.' }); }
    }
    return result;
  } finally { running = false; }
}

async function postEntry(code, input, actor) {
  const type = input.type;
  if (!['payment', 'credit_adjustment', 'debit_adjustment', 'reversal'].includes(type)) throw fail('Invalid account entry type.');
  const key = String(input.requestKey || '');
  if (!/^[A-Za-z0-9-]{16,80}$/.test(key)) throw fail('A valid request key is required. Reload the form.');
  const occurredOn = input.date;
  if (!validDate(occurredOn) || occurredOn > today()) throw fail('Choose a valid transaction date, not a future date.');
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (!note || note.length > 500) throw fail('Enter a description/reason of up to 500 characters.');
  const method = type === 'payment' ? input.method : null;
  if (type === 'payment' && !['cash', 'mobile_money', 'bank_transfer', 'bank_wire', 'cheque', 'other'].includes(method)) throw fail('Select a valid payment method.');
  const reference = type === 'payment' ? String(input.reference || '').trim() : null;
  if (reference?.length > 120) throw fail('Payment reference is too long.');
  if (type === 'payment' && method !== 'cash' && !reference) throw fail('A transaction reference is required for non-cash payments.');
  const externalKey = type === 'payment' && method !== 'cash' ? createHash('sha256').update(`${method}:${reference.toUpperCase()}`).digest('hex') : null;
  const amount = type === 'reversal' ? null : moneyCents(input.amount);
  if (amount !== null && amount <= 0) throw fail('Amount must be greater than zero.');
  const reverseId = type === 'reversal' ? Number(input.entryId) : null;
  if (type === 'reversal' && (!Number.isSafeInteger(reverseId) || reverseId <= 0)) throw fail('Select a valid entry to reverse.');
  const fingerprint = createHash('sha256').update(JSON.stringify({ code, type, occurredOn, note, method, reference, amount, reverseId })).digest('hex');
  return withTransaction(async (connection) => {
    const customer = await lockCustomer(connection, code);
    const [existing] = await connection.query('SELECT id, customer_id, request_fingerprint FROM account_ledger WHERE request_key = ?', [key]);
    if (existing.length) {
      if (existing[0].customer_id !== customer.id || existing[0].request_fingerprint !== fingerprint) throw fail('This request was already used for different details. Refresh the statement before submitting again.', 409);
      return { id: existing[0].id, repeated: true };
    }
    if (type === 'payment' && reference) {
      const [online] = await connection.query('SELECT id FROM gateway_payments WHERE reference = ? LIMIT 1', [reference]);
      if (online.length) throw fail('This is an online Paystack reference. Verify its existing transaction instead of recording it again as a staff collection.', 409);
    }
    let debit = type === 'debit_adjustment' ? amount : 0;
    let credit = ['payment', 'credit_adjustment'].includes(type) ? amount : 0;
    if (type === 'reversal') {
      const [entries] = await connection.query('SELECT * FROM account_ledger WHERE id = ? AND customer_id = ?', [reverseId, customer.id]);
      const [reversed] = await connection.query('SELECT id FROM account_ledger WHERE reverses_entry_id = ?', [reverseId]);
      if (!entries.length || entries[0].entry_type === 'reversal' || reversed.length) throw fail('This entry cannot be reversed or has already been reversed.');
      debit = Number(entries[0].credit_cents);
      credit = Number(entries[0].debit_cents);
    }
    if (externalKey) {
      const [duplicate] = await connection.query('SELECT id FROM account_ledger WHERE external_payment_key = ?', [externalKey]);
      if (duplicate.length) throw fail('This payment reference has already been recorded. Review the receipt before submitting another payment.', 409);
    }
    const [collectors] = actor ? await connection.query('SELECT fullname FROM users WHERE id = ?', [actor]) : [[]];
    const [entry] = await connection.query(`INSERT INTO account_ledger (customer_id, entry_type, debit_cents, credit_cents, occurred_on, description, payment_method, payment_reference, reverses_entry_id, request_key, request_fingerprint, external_payment_key, created_by_user_id, payment_source, collector_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [customer.id, type, debit, credit, occurredOn, note, method, reference, reverseId, key, fingerprint, externalKey, actor || null, type === 'payment' ? 'staff' : null, type === 'payment' ? collectors[0]?.fullname || 'Staff' : null]);
    await rebalance(connection, customer.id);
    await audit(connection, actor, 'POST_ACCOUNT_ENTRY', { customer: code, type, entryId: entry.insertId, debit, credit, reason: note });
    if (type === 'payment') await enqueue(connection, 'payment', customer, `payment:${entry.insertId}`, { amount: amountText(amount), reference: `RCPT-${entry.insertId}` });
    return { id: entry.insertId, repeated: false };
  });
}

// Called only after trusted server-side gateway verification, inside the same
// customer-locked transaction that marks the gateway payment as posted.
async function postVerifiedGatewayPayment(connection, customer, payment) {
  const [entry] = await connection.query(`INSERT INTO account_ledger
    (customer_id, entry_type, credit_cents, occurred_on, description, payment_method, payment_reference,
     request_key, external_payment_key, payment_source)
    VALUES (?, 'payment', ?, ?, 'Client online payment via Paystack', 'paystack', ?, ?, ?, 'paystack')`,
  [customer.id, payment.amount_cents, payment.paidOn, payment.reference, `paystack-${payment.id}`, createHash('sha256').update(`paystack:${payment.reference.toUpperCase()}`).digest('hex')]);
  await rebalance(connection, customer.id);
  await audit(connection, null, 'POST_PAYSTACK_PAYMENT', { customer: customer.customer_code, entryId: entry.insertId, reference: payment.reference, amountCents: Number(payment.amount_cents) });
  await enqueue(connection, 'payment', customer, `payment:${entry.insertId}`, { amount: amountText(payment.amount_cents), reference: `RCPT-${entry.insertId}` });
  return entry.insertId;
}

function startBillingScheduler() {
  const timer = setInterval(() => { runBilling(null, null, true).catch(() => console.warn('Scheduled billing could not complete; review billing configuration.')); }, 15 * 60 * 1000);
  timer.unref();
  return timer;
}

module.exports = { today, dateText, validDate, monthStart, nextMonth, moneyCents, fail, audit, lockCustomer, planAt, enrolCustomer, schedulePlan, activateSubscription, postEntry, postVerifiedGatewayPayment, runBilling, startBillingScheduler };
