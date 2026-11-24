const { randomBytes, createHash, createHmac, timingSafeEqual } = require('crypto');
const axios = require('axios');
const { runQuery, withTransaction } = require('../db');
const { moneyCents, fail, lockCustomer, postVerifiedGatewayPayment, dateText } = require('./billingAccounts');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const query = async (sql, params = []) => { const [error, rows] = await runQuery(sql, params); if (error) throw error; return rows; };
const tokenHash = (value) => { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw fail('Start again with your five-digit customer ID.', 401); return digest(value); };
const referenceText = (value) => { if (typeof value !== 'string' || !/^ryt_[a-f0-9]{32}$/.test(value)) throw fail('Invalid payment reference.'); return value; };
function configuration() {
  const key = process.env.PAYSTACK_SECRET_KEY || '';
  const environment = key.startsWith('sk_live_') ? 'live' : 'test';
  return { configured: /^sk_(live|test)_\S+$/.test(key), environment, shortcode: '*412*99#' };
}
async function provider(method, path, data) {
  if (!configuration().configured) throw fail('Online payment is not configured. Please contact the office.', 503);
  try {
    const response = await axios.request({ method, url: `https://api.paystack.co${path}`, data,
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' }, timeout: 15000, maxRedirects: 0 });
    if (response.status !== 200 || response.data?.status !== true || !response.data.data) throw new Error('Unconfirmed provider response');
    return response.data.data;
  } catch { throw fail('The payment provider could not confirm this request. Check the existing payment status before trying another payment.', 502); }
}
async function session(token) {
  const hash = tokenHash(token);
  const [row] = await query('SELECT customer_id FROM payment_sessions WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP()', [hash]);
  if (!row) throw fail('Payment session expired. Start again with your customer ID. Contact the office with your reference for an older payment.', 401);
  return { hash, customerId: Number(row.customer_id) };
}
async function lookup(code) {
  if (typeof code !== 'string' || !/^[1-9]\d{4}$/.test(code)) throw fail('Enter your five-digit customer ID.');
  const [customer] = await query('SELECT id, full_name FROM customers WHERE customer_code = ?', [code]);
  if (!customer) throw fail('Customer ID could not be confirmed. Check the number or contact the office.', 404);
  const token = randomBytes(32).toString('hex');
  await query('INSERT INTO payment_sessions (token_hash, customer_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))', [digest(token), customer.id]);
  // An ID is a payment destination, not proof of identity. Do not expose debts,
  // phone numbers, addresses, statements or historical payments. The full name
  // is intentionally shown to confirm the payment destination.
  const displayName = String(customer.full_name).toUpperCase().trim();
  return { token, customerId: code, displayName };
}
async function owned(token, reference) {
  const access = await session(token);
  const [row] = await query('SELECT g.*, c.customer_code, UPPER(c.full_name) AS full_name FROM gateway_payments g JOIN customers c ON c.id = g.customer_id WHERE g.reference = ? AND g.session_hash = ?', [referenceText(reference), access.hash]);
  if (!row) throw fail('Payment not found in this payment session.', 404);
  return row;
}
async function view(row) {
  const data = { reference: row.reference, status: row.status, amountCents: Number(row.amount_cents), environment: row.environment,
    message: row.status === 'send_otp' ? 'Enter the OTP sent to your payment phone. Never enter your wallet PIN here.' : row.status === 'unknown' ? 'Confirmation is uncertain. Check status; do not start another charge.' : row.status === 'review' ? 'Payment needs office review. Do not pay again; retain this reference.' : 'Approve the payment on your phone, then check payment status.' };
  if (row.status === 'success') {
    const [entry] = row.ledger_id ? await query('SELECT id, occurred_on, EXISTS(SELECT 1 FROM account_ledger r WHERE r.reverses_entry_id = l.id) AS reversed FROM account_ledger l WHERE id = ?', [row.ledger_id]) : [];
    data.receipt = { id: entry ? String(entry.id) : `TEST-${row.reference}`, date: entry ? dateText(entry.occurred_on) : dateText(row.created_at),
      creditCents: Number(row.amount_cents), method: 'paystack', reference: row.reference, description: row.environment === 'test' ? 'TEST payment only — no money collected and no customer balance credited.' : 'Client online payment via Paystack',
      source: 'paystack', collectorName: null, reversed: Boolean(entry?.reversed), testPayment: row.environment === 'test' };
    data.customer = { id: row.customer_code, fullName: row.full_name };
  }
  return data;
}
async function initiate(token, input) {
  const access = await session(token);
  const config = configuration();
  if (!config.configured) throw fail('Online payment is not configured.', 503);
  if (input.confirmed !== true) throw fail('Confirm the customer and payment amount before proceeding.');
  const amount = moneyCents(input.amount);
  if (amount < 100 || amount > 10000000) throw fail('Online payments must be between GHS 1.00 and GHS 100,000.00.');
  if (typeof input.phone !== 'string' || !/^0\d{9}$/.test(input.phone)) throw fail('Enter the ten-digit Ghana payment phone number, starting with 0.');
  if (!['mtn', 'vod', 'tgo'].includes(input.provider)) throw fail('Choose MTN, Telecel or AT Money.');
  const email = String(input.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150) throw fail('Enter a valid payment contact email. This does not change the customer record.');
  if (typeof input.requestKey !== 'string' || !/^[A-Za-z0-9-]{16,80}$/.test(input.requestKey)) throw fail('Reload the payment form to obtain a request key.');
  const fingerprint = digest(JSON.stringify({ customerId: access.customerId, amount, phone: input.phone, provider: input.provider, email, environment: config.environment }));
  const prepared = await withTransaction(async (connection) => {
    await connection.query('SELECT id FROM customers WHERE id = ? FOR UPDATE', [access.customerId]);
    const [existing] = await connection.query('SELECT * FROM gateway_payments WHERE request_key = ?', [input.requestKey]);
    if (existing.length) {
      if (existing[0].session_hash !== access.hash || existing[0].fingerprint !== fingerprint) throw fail('This request key was used for another payment.', 409);
      return { row: existing[0], repeated: true };
    }
    const [pending] = await connection.query("SELECT reference FROM gateway_payments WHERE customer_id = ? AND status IN ('created','pending','unknown','send_otp','review') AND created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 MINUTE) LIMIT 1", [access.customerId]);
    if (pending.length) throw fail('A recent payment is still awaiting confirmation. Use its existing payment session or contact the office before paying again.', 409);
    const reference = `ryt_${randomBytes(16).toString('hex')}`;
    const [entry] = await connection.query(`INSERT INTO gateway_payments (reference, customer_id, session_hash, amount_cents, phone, provider, email, environment, request_key, fingerprint)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [reference, access.customerId, access.hash, amount, input.phone, input.provider, email, config.environment, input.requestKey, fingerprint]);
    return { row: { id: entry.insertId, reference }, repeated: false };
  });
  if (!prepared.repeated) {
    // Persist before network I/O. Retrying an uncertain submission never charges again.
    try {
      const data = await provider('POST', '/charge', { amount, email, currency: 'GHS', reference: prepared.row.reference,
        mobile_money: { phone: input.phone, provider: input.provider }, metadata: { application: 'rytclean', customer_id: String(access.customerId) } });
      if (data.reference !== prepared.row.reference) throw fail('Payment reference did not match.', 502);
      const state = data.status === 'send_otp' ? 'send_otp' : data.status === 'failed' ? 'failed' : 'pending';
      await query("UPDATE gateway_payments SET status = ? WHERE id = ? AND status = 'created'", [state, prepared.row.id]);
      if (data.status === 'success') await verifyReference(prepared.row.reference);
    } catch {
      await query("UPDATE gateway_payments SET status = 'unknown' WHERE id = ? AND status = 'created'", [prepared.row.id]);
    }
  }
  return view(await owned(token, prepared.row.reference));
}
async function verifyReference(reference) {
  const [original] = await query('SELECT * FROM gateway_payments WHERE reference = ?', [referenceText(reference)]);
  if (!original || original.status === 'success') return;
  if (original.environment !== configuration().environment) throw fail('This payment requires the original Paystack environment for verification.', 409);
  let verified;
  try { verified = await provider('GET', `/transaction/verify/${encodeURIComponent(reference)}`); }
  catch { await query('UPDATE gateway_payments SET last_checked_at = UTC_TIMESTAMP() WHERE id = ?', [original.id]); return; }
  await withTransaction(async (connection) => {
    const [customers] = await connection.query('SELECT customer_code FROM customers WHERE id = ?', [original.customer_id]);
    const customer = await lockCustomer(connection, customers[0].customer_code);
    const [payments] = await connection.query('SELECT * FROM gateway_payments WHERE id = ? FOR UPDATE', [original.id]);
    const payment = payments[0];
    if (payment.status === 'success') return;
    await connection.query('UPDATE gateway_payments SET last_checked_at = UTC_TIMESTAMP() WHERE id = ?', [payment.id]);
    if (verified.status !== 'success') {
      if (['failed', 'abandoned', 'reversed'].includes(verified.status)) await connection.query("UPDATE gateway_payments SET status = 'failed' WHERE id = ?", [payment.id]);
      return;
    }
    const paidAt = typeof verified.paid_at === 'string' ? new Date(verified.paid_at) : null;
    const validPaidAt = paidAt && Number.isFinite(paidAt.getTime()) && paidAt.getTime() <= Date.now() + 300000;
    const matches = validPaidAt && verified.reference === payment.reference && verified.currency === 'GHS' && Number.isSafeInteger(verified.amount) && verified.amount === Number(payment.amount_cents)
      && verified.domain === payment.environment && verified.metadata?.application === 'rytclean' && String(verified.metadata?.customer_id) === String(customer.id);
    if (!matches) { await connection.query("UPDATE gateway_payments SET status = 'review' WHERE id = ?", [payment.id]); return; }
    // Sandbox transactions remain in the gateway register, never real balances/SMS.
    const ledgerId = payment.environment === 'live' ? await postVerifiedGatewayPayment(connection, customer, { ...payment, paidOn: paidAt.toISOString().slice(0, 10) }) : null;
    await connection.query("UPDATE gateway_payments SET status = 'success', ledger_id = ? WHERE id = ?", [ledgerId, payment.id]);
  });
}
async function status(token, reference) {
  const row = await owned(token, reference);
  if (!['success', 'failed'].includes(row.status) && (!row.last_checked_at || Date.now() - new Date(row.last_checked_at).getTime() >= 10000)) await verifyReference(reference);
  return view(await owned(token, reference));
}
async function current(token) {
  const access = await session(token);
  const [row] = await query('SELECT reference FROM gateway_payments WHERE session_hash = ? ORDER BY id DESC LIMIT 1', [access.hash]);
  if (!row) throw fail('No payment was submitted in this session.', 404);
  return status(token, row.reference);
}
async function submitOtp(token, reference, otp) {
  const row = await owned(token, reference);
  if (row.status !== 'send_otp') return view(row);
  if (typeof otp !== 'string' || !/^\d{4,10}$/.test(otp)) throw fail('Enter the numeric OTP sent by the provider. Never enter a wallet PIN.');
  const data = await provider('POST', '/charge/submit_otp', { reference, otp });
  if (data.reference && data.reference !== reference) throw fail('Payment reference did not match.', 502);
  await query("UPDATE gateway_payments SET status = ? WHERE id = ? AND status = 'send_otp'", [data.status === 'send_otp' ? 'send_otp' : data.status === 'failed' ? 'failed' : 'pending', row.id]);
  await verifyReference(reference);
  return view(await owned(token, reference));
}
async function webhook(rawBody, signature) {
  if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string' || !/^[a-f0-9]{128}$/.test(signature) || !configuration().configured) throw fail('Invalid webhook signature.', 401);
  const expected = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw fail('Invalid webhook signature.', 401);
  let event;
  try { event = JSON.parse(rawBody.toString('utf8')); } catch { throw fail('Invalid webhook body.'); }
  // Never trust callback amounts/customer metadata alone: independently verify.
  if (event.event === 'charge.success' && /^ryt_[a-f0-9]{32}$/.test(event.data?.reference || '')) await verifyReference(event.data.reference);
}
let reconciling = false;
async function reconcile() {
  if (reconciling || !configuration().configured) return;
  reconciling = true;
  try {
    const pending = await query("SELECT reference FROM gateway_payments WHERE status IN ('created','pending','unknown','send_otp') AND environment = ? AND (last_checked_at IS NULL OR last_checked_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE)) ORDER BY COALESCE(last_checked_at, created_at), id LIMIT 10", [configuration().environment]);
    for (const payment of pending) await verifyReference(payment.reference);
  } finally { reconciling = false; }
}
function startPaymentScheduler() {
  const timer = setInterval(() => { reconcile().catch(() => console.warn('Payment verification paused; review pending gateway payments.')); }, 60000);
  timer.unref(); return timer;
}
module.exports = { configuration, lookup, initiate, status, current, submitOtp, webhook, verifyReference, reconcile, startPaymentScheduler };
