const axios = require('axios');
const { runQuery, withTransaction } = require('../db');
const { events, eventPlaceholders, render, phone } = require('./smsTemplates');
const amountText = (cents) => (Number(cents) / 100).toFixed(2);
const dateText = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
function providerConfiguration(env = process.env) {
  const host = String(env.SMS_API_HOST || '').trim() || 'api.smsonlinegh.com';
  const sender = String(env.SMS_SENDER_ID || '').trim();
  if (host.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(host)) throw new Error('SMS_API_HOST must be a hostname only, without a protocol, path or port.');
  if (sender && !/^[A-Za-z0-9 ._-]{1,11}$/.test(sender)) throw new Error('SMS_SENDER_ID must be a provider-approved sender of up to 11 characters.');
  return { host, sender, credentialsConfigured: Boolean(String(env.SMS_API_KEY || '').trim()), transport: env.SMS_API_PROTOCOL === 'http' ? 'http' : 'https' };
}

async function query(sql, params = []) {
  const [error, rows] = await runQuery(sql, params);
  if (error) throw new Error('SMS storage is unavailable. Apply the SMS migration.');
  return rows;
}
async function configuration() {
  const rows = await query('SELECT * FROM sms_settings WHERE id = 1');
  if (!rows.length) throw new Error('SMS settings are missing.');
  const settings = rows[0];
  return { enabled: Boolean(settings.enabled), ...providerConfiguration(),
    events: (await query('SELECT * FROM sms_events ORDER BY event_key')).map((row) => ({ key: row.event_key, title: events[row.event_key]?.title || row.event_key, placeholders: eventPlaceholders[row.event_key] || [], enabled: Boolean(row.enabled), message: row.message })) };
}

// Savepoint keeps notification-storage errors from rolling back the business operation.
// Successful queue inserts still commit/roll back with the customer/payment transaction.
async function enqueue(connection, event, customer, key, values = {}, invoiceId = null) {
  await connection.query('SAVEPOINT sms_notification');
  try {
    const [settings] = await connection.query('SELECT enabled FROM sms_settings WHERE id = 1');
    const [templates] = await connection.query('SELECT enabled, message FROM sms_events WHERE event_key = ?', [event]);
    if (settings[0]?.enabled && templates[0]?.enabled) {
      const destination = phone(customer.phone);
      const message = render(templates[0].message, { name: String(customer.full_name).toUpperCase(), customerId: customer.customer_code, ...values });
      await connection.query(`INSERT IGNORE INTO sms_outbox (dedupe_key, event_key, customer_id, invoice_id, phone, message) VALUES (?, ?, ?, ?, ?, ?)`, [key, event, customer.id, invoiceId, destination, message]);
    }
    await connection.query('RELEASE SAVEPOINT sms_notification');
  } catch {
    await connection.query('ROLLBACK TO SAVEPOINT sms_notification');
    await connection.query('RELEASE SAVEPOINT sms_notification');
    console.warn('SMS notification could not be queued; business data remains saved.');
  }
}

async function transport(destination, message, sender) {
  const key = process.env.SMS_API_KEY;
  if (!key || !sender) throw new Error('SMS_API_KEY and a sender ID are required.');
  // Host is controlled only by the server environment, never by an API/UI payload.
  const { host, transport: protocol } = providerConfiguration();
  const response = await axios.request({ method: 'POST', url: `${protocol}://${host}/v5/message/sms/send`,
    data: { text: message, type: 0, sender, destinations: [destination] },
    headers: { Host: host, 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `key ${key}` },
    timeout: 15000, maxRedirects: 0, validateStatus: () => true });
  // The working reference only documents HTTP 200, not provider acceptance/delivery codes.
  return { status: response.status === 200 ? 'submitted_unverified' : 'failed',
    detail: response.status === 200 ? 'HTTP 200 received; provider acceptance and delivery are not confirmed.' : `Provider returned HTTP ${response.status}. No automatic retry.` };
}

async function dispatch(id, settings) {
  const claim = await query("UPDATE sms_outbox SET status = 'sending', attempted_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'queued'", [id]);
  if (!claim.affectedRows) return;
  const [row] = await query('SELECT * FROM sms_outbox WHERE id = ?', [id]);
  let result;
  try {
    if (row.event_key === 'bulk') {
      const [customer] = await query('SELECT phone FROM customers WHERE id = ?', [row.customer_id]);
      let currentPhone;
      try { currentPhone = customer && phone(customer.phone); } catch { currentPhone = null; }
      if (currentPhone !== row.phone) result = { status: 'cancelled', detail: 'Recipient phone changed after campaign confirmation.' };
    }
    if (row.event_key === 'payment') {
      const entryId = row.dedupe_key.slice('payment:'.length);
      const [entry] = await query(`SELECT l.id FROM account_ledger l WHERE l.id = ? AND l.entry_type = 'payment'
        AND NOT EXISTS (SELECT 1 FROM account_ledger r WHERE r.reverses_entry_id = l.id)`, [entryId]);
      if (!entry) result = { status: 'cancelled', detail: 'Payment was reversed before notification.' };
    }
    if (row.event_key === 'bill') {
      const [invoice] = await query('SELECT voided FROM billing_invoices WHERE id = ?', [row.invoice_id]);
      if (!invoice || invoice.voided) result = { status: 'cancelled', detail: 'Bill was voided before notification.' };
    }
    if (row.event_key === 'plan_change') {
      const [, , effective, planCode] = row.dedupe_key.split(':');
      const [plan] = await query(`SELECT h.id FROM customer_plan_history h JOIN plans p ON p.id = h.plan_id
        WHERE h.customer_id = ? AND h.effective_from = ? AND p.plan_code = ? AND h.effective_from > UTC_DATE()`, [row.customer_id, effective, planCode]);
      if (!plan) result = { status: 'cancelled', detail: 'Plan change was cancelled, replaced or already took effect.' };
    }
    if (['due', 'overdue'].includes(row.event_key)) {
      const [invoice] = await query('SELECT * FROM billing_invoices WHERE id = ?', [row.invoice_id]);
      const today = new Date().toISOString().slice(0, 10);
      if (!invoice || invoice.voided || Number(invoice.amount_cents) <= Number(invoice.settled_cents) ||
          (row.event_key === 'due' && dateText(invoice.due_on) !== today)) {
        result = { status: 'cancelled', detail: 'Bill settled, voided or due reminder no longer current.' };
      } else {
        const [customer] = await query('SELECT * FROM customers WHERE id = ?', [row.customer_id]);
        if (!customer || customer.status !== 'active') result = { status: 'cancelled', detail: 'Customer is no longer active.' };
        else {
          row.phone = phone(customer.phone);
          const template = settings.events.find((event) => event.key === row.event_key);
          row.message = render(template.message, { name: customer.full_name.toUpperCase(), customerId: customer.customer_code,
            amount: amountText(Number(invoice.amount_cents) - Number(invoice.settled_cents)), reference: invoice.reference, dueDate: dateText(invoice.due_on) });
          await query('UPDATE sms_outbox SET phone = ?, message = ? WHERE id = ?', [row.phone, row.message, id]);
        }
      }
    }
    if (!result) result = await transport(row.phone, row.message, settings.sender);
  } catch {
    result = { status: 'unknown', detail: 'Request failed or timed out; delivery is unknown. No automatic retry to avoid duplicates.' };
  }
  await query('UPDATE sms_outbox SET status = ?, detail = ? WHERE id = ?', [result.status, result.detail, id]);
}

async function queueReminders() {
  const invoices = await query(`SELECT i.id AS invoice_id, i.reference, i.due_on, i.amount_cents, i.settled_cents, c.*,
    IF(i.due_on = UTC_DATE(), 'due', 'overdue') AS reminder_event
    FROM billing_invoices i JOIN customers c ON c.id = i.customer_id
    JOIN sms_events e ON e.event_key = IF(i.due_on = UTC_DATE(), 'due', 'overdue') AND e.enabled = 1
    WHERE i.voided = 0 AND i.amount_cents > i.settled_cents AND c.status = 'active'
    AND (i.due_on = UTC_DATE() OR i.due_on <= DATE_SUB(UTC_DATE(), INTERVAL 7 DAY))
    AND NOT EXISTS (SELECT 1 FROM sms_outbox o WHERE o.dedupe_key = CONCAT('reminder:', i.id, ':', IF(i.due_on = UTC_DATE(), 'due', 'overdue')))
    ORDER BY i.id LIMIT 250`);
  for (const invoice of invoices) await withTransaction((connection) => enqueue(connection, invoice.reminder_event, invoice,
    `reminder:${invoice.invoice_id}:${invoice.reminder_event}`, { amount: amountText(Number(invoice.amount_cents) - Number(invoice.settled_cents)), reference: invoice.reference, dueDate: dateText(invoice.due_on) }, invoice.invoice_id));
}
let running = false;
async function processQueue() {
  if (running) return;
  running = true;
  try {
    const settings = await configuration();
    if (!settings.credentialsConfigured || !settings.sender) return;
    // A crashed worker may have submitted: never blindly retry an ambiguous send.
    await query("UPDATE sms_outbox SET status = 'unknown', detail = 'Worker interrupted; check provider before resending.' WHERE status = 'sending' AND attempted_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)");
    if (settings.enabled) await queueReminders();
    const pending = await query("SELECT id, event_key FROM sms_outbox WHERE status = 'queued' AND (event_key = 'bulk' OR (? = 1 AND event_key <> 'test')) ORDER BY id LIMIT 50", [settings.enabled ? 1 : 0]);
    for (const row of pending) {
      const current = await configuration();
      if (row.event_key === 'bulk') { await dispatch(row.id, current); continue; }
      if (!current.enabled) continue;
      if (!current.events.find((event) => event.key === row.event_key)?.enabled) {
        await query("UPDATE sms_outbox SET status = 'cancelled', detail = 'Event disabled before sending.' WHERE id = ? AND status = 'queued'", [row.id]);
      } else await dispatch(row.id, current);
    }
  } finally { running = false; }
}
async function testSend(destination, message, requestKey) {
  const settings = await configuration();
  if (!settings.credentialsConfigured || !settings.sender) throw new Error('Configure SMS_API_KEY and sender ID before testing.');
  const number = phone(destination);
  const key = `test:${requestKey}`;
  await query("INSERT IGNORE INTO sms_outbox (dedupe_key, event_key, phone, message) VALUES (?, 'test', ?, ?)", [key, number, message]);
  const [row] = await query('SELECT * FROM sms_outbox WHERE dedupe_key = ?', [key]);
  if (row.phone !== number || row.message !== message) throw new Error('This test request was already used for different details.');
  await dispatch(row.id, settings);
  return (await query('SELECT id, status, detail FROM sms_outbox WHERE id = ?', [row.id]))[0];
}
function startSmsScheduler() {
  const timer = setInterval(() => processQueue().catch(() => console.warn('SMS worker unavailable; check SMS configuration/migration.')), 60000);
  timer.unref();
  return timer;
}
module.exports = { configuration, providerConfiguration, enqueue, processQueue, testSend, startSmsScheduler, amountText };
