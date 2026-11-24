const { randomUUID, createHash } = require('crypto');
const { withTransaction } = require('../db');
const { providerConfiguration } = require('./smsNotifications');
const { phone, render, validateTemplate } = require('./smsTemplates');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const MAX_RECIPIENTS = 1000;
const gsmBasic = new Set(Array.from('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'));
const gsmExtended = new Set(Array.from('^{}\\[~]|€\f'));
function estimateSegments(message) {
  let units = 0;
  for (const character of message) {
    if (gsmBasic.has(character)) units += 1;
    else if (gsmExtended.has(character)) units += 2;
    else return { encoding: 'Unicode', segments: message.length <= 70 ? 1 : Math.ceil(message.length / 67) };
  }
  return { encoding: 'GSM-7', segments: units <= 160 ? 1 : Math.ceil(units / 153) };
}
function normaliseFilters(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail('Invalid recipient filters.');
  const result = { status: input.status || 'all', search: String(input.search || '').trim(), zone: String(input.zone || ''), plan: String(input.plan || ''), category: String(input.category || '') };
  for (const key of ['zone', 'plan', 'category']) if (result[key] === 'all') result[key] = '';
  if (!['active', 'inactive', 'all'].includes(result.status) || result.search.length > 100 || result.zone.length > 60 || result.plan.length > 60 || (result.category && !/^\d{1,10}$/.test(result.category))) throw fail('Invalid recipient filters.');
  return result;
}
async function audience(connection, filters, ids) {
  const conditions = [];
  const params = [];
  if (filters.status !== 'all') { conditions.push('c.status = ?'); params.push(filters.status); }
  if (filters.zone) { conditions.push('c.zone_code = ?'); params.push(filters.zone); }
  if (filters.plan) { conditions.push('COALESCE(p.plan_code, c.plan_code) = ?'); params.push(filters.plan); }
  if (filters.category) { conditions.push('c.category_id = ?'); params.push(filters.category); }
  if (filters.search) {
    conditions.push('(LOCATE(?, UPPER(c.full_name)) > 0 OR LOCATE(?, c.phone) > 0 OR LOCATE(?, c.customer_code) > 0)');
    params.push(filters.search.toUpperCase(), filters.search, filters.search);
  }
  if (ids) { conditions.push(`c.id IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }
  const [rows] = await connection.query(`SELECT c.id, c.customer_code, UPPER(c.full_name) AS full_name, c.phone, c.status,
    z.name AS zone_name, p.name AS plan_name, cc.name AS category_name FROM customers c
    LEFT JOIN zones z ON z.zone_code = c.zone_code
    LEFT JOIN plans p ON p.id = COALESCE((SELECT h.plan_id FROM customer_plan_history h WHERE h.customer_id = c.id AND h.effective_from <= UTC_DATE() ORDER BY h.effective_from DESC LIMIT 1), (SELECT fallback.id FROM plans fallback WHERE fallback.plan_code = c.plan_code))
    LEFT JOIN client_categories cc ON cc.id = c.category_id
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY c.id LIMIT ${MAX_RECIPIENTS + 1}`, params);
  if (rows.length > MAX_RECIPIENTS) throw fail(`More than ${MAX_RECIPIENTS} customers match. Narrow the filters and preview again.`);
  return rows;
}
function recipientSnapshot(rows, message) {
  const destinations = new Set();
  let invalid = 0;
  let duplicates = 0;
  const recipients = [];
  for (const row of rows) {
    let destination;
    try { destination = phone(row.phone); } catch { invalid += 1; continue; }
    if (destinations.has(destination)) { duplicates += 1; continue; }
    destinations.add(destination);
    const text = render(message, { name: row.full_name, customerId: row.customer_code });
    recipients.push({ id: row.id, customerId: row.customer_code, name: row.full_name, phone: destination, message: text,
      zone: row.zone_name, plan: row.plan_name, category: row.category_name, ...estimateSegments(text) });
  }
  return { recipients, matched: rows.length, invalid, duplicates };
}
async function previewCampaign(input, actor) {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title || title.length > 100) throw fail('Enter a campaign title of 1–100 characters.');
  let message;
  try { message = validateTemplate(input.message, 'registration'); } catch { throw fail('Enter a message of 1–1000 characters using only {name} and {customerId} placeholders.'); }
  const filters = normaliseFilters(input.filters);
  return withTransaction(async (connection) => {
    await connection.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [actor]);
    const [recent] = await connection.query('SELECT COUNT(*) AS total FROM sms_campaigns WHERE created_by_user_id = ? AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)', [actor]);
    if (Number(recent[0].total) >= 20) throw fail('Preview limit reached. Wait 10 minutes before creating more campaigns.', 429);
    const snapshot = recipientSnapshot(await audience(connection, filters), message);
    if (!snapshot.recipients.length) throw fail('No customers with valid Ghana phone numbers match these filters.');
    const id = randomUUID();
    await connection.query(`INSERT INTO sms_campaigns (id, title, created_by_user_id, message, filters_json, recipients_json, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE))`, [id, title, actor, message, JSON.stringify(filters), JSON.stringify(snapshot.recipients)]);
    return { id, title, ...snapshot, expiresInMinutes: 15 };
  });
}
async function queueCampaign(id, input, actor) {
  if (!/^[a-f0-9-]{36}$/i.test(id) || input.confirmed !== true || !Array.isArray(input.recipientIds) || !input.recipientIds.length || input.recipientIds.length > MAX_RECIPIENTS || input.recipientIds.some((value) => !Number.isSafeInteger(value) || value <= 0)) throw fail('Confirm a preview and select at least one valid recipient.');
  const ids = [...new Set(input.recipientIds)].sort((a, b) => a - b);
  const selectionHash = createHash('sha256').update(JSON.stringify(ids)).digest('hex');
  return withTransaction(async (connection) => {
    await connection.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [actor]);
    const [campaigns] = await connection.query('SELECT *, expires_at <= UTC_TIMESTAMP() AS expired FROM sms_campaigns WHERE id = ? FOR UPDATE', [id]);
    const campaign = campaigns[0];
    if (!campaign || campaign.created_by_user_id !== actor) throw fail('Campaign preview not found.', 404);
    if (campaign.status === 'queued') {
      if (campaign.selection_hash !== selectionHash) throw fail('This campaign was already queued for different recipients.', 409);
      return { id, count: campaign.recipient_count, repeated: true };
    }
    if (campaign.expired) throw fail('This preview expired. Preview the recipients again.', 409);
    const provider = providerConfiguration();
    if (!provider.credentialsConfigured || !provider.sender) throw fail('Ask an administrator to configure the SMS API key and sender ID first.');
    const [recent] = await connection.query("SELECT COUNT(*) AS total FROM sms_campaigns WHERE created_by_user_id = ? AND status = 'queued' AND queued_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)", [actor]);
    if (Number(recent[0].total) >= 5) throw fail('Bulk-send limit reached. Wait 10 minutes before sending another campaign.', 429);
    const snapshots = JSON.parse(campaign.recipients_json);
    const selected = snapshots.filter((row) => ids.includes(row.id));
    if (selected.length !== ids.length) throw fail('Select recipients from this campaign preview only.');
    const current = recipientSnapshot(await audience(connection, JSON.parse(campaign.filters_json), ids), campaign.message).recipients;
    if (current.length !== selected.length || selected.some((row, index) => row.id !== current[index].id || row.phone !== current[index].phone || row.message !== current[index].message)) throw fail('Customer details changed after preview. Preview again before sending.', 409);
    for (const recipient of selected) await connection.query(`INSERT INTO sms_outbox (dedupe_key, event_key, customer_id, phone, message, campaign_id)
      VALUES (?, 'bulk', ?, ?, ?, ?)`, [`bulk:${id}:${recipient.phone}`, recipient.id, recipient.phone, recipient.message, id]);
    await connection.query("UPDATE sms_campaigns SET status = 'queued', selection_hash = ?, recipient_count = ?, queued_at = UTC_TIMESTAMP() WHERE id = ?", [selectionHash, selected.length, id]);
    await connection.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)', [actor, 'QUEUE_BULK_SMS', JSON.stringify({ campaignId: id, title: campaign.title, count: selected.length })]);
    return { id, count: selected.length, repeated: false };
  });
}
module.exports = { previewCampaign, queueCampaign, estimateSegments, normaliseFilters };
