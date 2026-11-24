const express = require('express');
const { randomInt } = require('crypto');
const { runQuery, withTransaction } = require('../db');
const { receiveHousePhoto, storePhoto, removePhoto, photoPath } = require('../utils/customerHousePhoto');
const { enrolCustomer, schedulePlan, dateText, fail } = require('../services/billingAccounts');
const router = express.Router();

const today = () => new Date().toISOString().slice(0, 10); // Ghana uses UTC year-round.
const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const coordinate = (value) => (typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '' ? NaN : Number(value);

router.get('/customers', async (req, res) => {
  const [err, rows] = await runQuery(`
    SELECT c.customer_code AS id, UPPER(c.full_name) AS fullName, c.phone, c.email, c.address,
      c.zone_code AS zoneId, z.name AS zoneName, COALESCE(p.plan_code, c.plan_code) AS planId, p.name AS planName,
      (SELECT pp.plan_code FROM customer_plan_history h JOIN plans pp ON pp.id = h.plan_id WHERE h.customer_id = c.id AND h.effective_from > UTC_DATE() ORDER BY h.effective_from LIMIT 1) AS pendingPlanId,
      (SELECT pp.name FROM customer_plan_history h JOIN plans pp ON pp.id = h.plan_id WHERE h.customer_id = c.id AND h.effective_from > UTC_DATE() ORDER BY h.effective_from LIMIT 1) AS pendingPlanName,
      (SELECT DATE_FORMAT(h.effective_from, '%Y-%m-%d') FROM customer_plan_history h WHERE h.customer_id = c.id AND h.effective_from > UTC_DATE() ORDER BY h.effective_from LIMIT 1) AS pendingPlanDate,
      c.category_id AS categoryId, cc.name AS categoryName,
      DATE_FORMAT(COALESCE(c.joined_date, DATE(c.created_at)), '%Y-%m-%d') AS joinedDate,
      c.latitude, c.longitude, c.location_address AS locationAddress,
      c.location_description AS locationDescription, c.status, (c.house_photo_key IS NOT NULL) AS hasHousePhoto,
      bs.status AS billingStatus,
      EXISTS(SELECT 1 FROM account_ledger al WHERE al.customer_id = c.id) AS hasAccountEntries,
      DATE_FORMAT(c.next_pickup_date, '%Y-%m-%d') AS nextPickupDate, c.created_at, c.updated_at
    FROM customers c
    LEFT JOIN zones z ON z.zone_code = c.zone_code
    LEFT JOIN plans p ON p.id = COALESCE((SELECT h.plan_id FROM customer_plan_history h WHERE h.customer_id = c.id AND h.effective_from <= UTC_DATE() ORDER BY h.effective_from DESC LIMIT 1), (SELECT fallback.id FROM plans fallback WHERE fallback.plan_code = c.plan_code))
    LEFT JOIN client_categories cc ON cc.id = c.category_id
    LEFT JOIN billing_subscriptions bs ON bs.customer_id = c.id
    ORDER BY c.created_at DESC, c.id DESC
  `);
  if (err) return res.status(500).json({ code: 2, message: 'Unable to load customers.' });
  return res.json({ code: 1, data: rows, message: 'Customers loaded.' });
});

router.get('/customers/:id/house-photo', async (req, res) => {
  const [err, rows] = await runQuery('SELECT house_photo_key, house_photo_mime FROM customers WHERE customer_code = ?', [req.params.id]);
  if (err) return res.status(500).json({ code: 2, message: 'Unable to load house photo.' });
  const photo = rows?.[0];
  const filename = photoPath(photo?.house_photo_key);
  if (!filename || !['image/jpeg', 'image/png', 'image/webp'].includes(photo?.house_photo_mime)) return res.status(404).json({ code: 2, message: 'No house photo has been saved.' });
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  res.type(photo.house_photo_mime);
  return res.sendFile(filename, { cacheControl: false }, (error) => {
    if (error && !res.headersSent) res.status(error.code === 'ENOENT' ? 404 : 500).json({ code: 2, message: 'Unable to load house photo.' });
  });
});

const saveCustomer = async (req, res) => {
  const editing = Boolean(req.params.id);
  const code = editing ? String(req.params.id).trim() : null;
  let existing;
  if (editing) {
    const [err, rows] = await runQuery(`SELECT c.*, COALESCE((SELECT p.plan_code FROM customer_plan_history h JOIN plans p ON p.id = h.plan_id WHERE h.customer_id = c.id AND h.effective_from <= UTC_DATE() ORDER BY h.effective_from DESC LIMIT 1), c.plan_code) AS plan_code FROM customers c WHERE c.customer_code = ?`, [code]);
    if (err) return res.status(500).json({ code: 2, message: 'Unable to load customer.' });
    if (!rows.length) return res.status(404).json({ code: 2, message: 'Customer not found.' });
    existing = rows[0];
  }
  const text = (key, fallback = '') => typeof req.body[key] === 'string' ? req.body[key].trim() : fallback;
  const values = {
    fullName: text('fullName').toUpperCase(), phone: text('phone'), email: text('email'),
    address: text('address', existing?.address || ''), zoneId: text('zoneId'), planId: text('planId'),
    categoryId: Number(req.body.categoryId), joinedDate: req.body.joinedDate ?? (editing ? null : today()),
    latitude: coordinate(req.body.latitude), longitude: coordinate(req.body.longitude),
    locationAddress: text('locationAddress'), locationDescription: text('locationDescription'), status: text('status', 'active'),
  };
  if (!/^\d{10}$/.test(values.phone)) {
    return res.json({ code: 2, message: 'Phone number must be exactly 10 digits.' });
  }
  if (!values.fullName || values.fullName.length > 150
    || values.email.length > 150 || (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
    || !values.zoneId || !values.planId
    || values.zoneId.length > 40 || values.planId.length > 60) {
    return res.json({ code: 2, message: 'Enter a valid customer name, phone, zone and plan. Email is optional but must be valid when provided.' });
  }
  if (!Number.isSafeInteger(values.categoryId) || values.categoryId <= 0 || !isDate(values.joinedDate)) {
    return res.json({ code: 2, message: 'Select a client category and a valid joined date.' });
  }
  if (!Number.isFinite(values.latitude) || !Number.isFinite(values.longitude)
    || Math.abs(values.latitude) > 90 || Math.abs(values.longitude) > 180) {
    return res.json({ code: 2, message: 'Select a valid customer location.' });
  }
  if (values.address.length > 255 || values.locationAddress.length > 255 || values.locationDescription.length > 500
    || !['active', 'inactive'].includes(values.status)) {
    return res.json({ code: 2, message: 'Check address lengths, location description (maximum 500 characters) and status.' });
  }
  // Existing inactive options can remain unchanged; new assignments must be active.
  for (const [sql, params, unchanged, label] of [
    ['SELECT status FROM client_categories WHERE id = ?', [values.categoryId], Number(existing?.category_id) === values.categoryId, 'client category'],
    ['SELECT status FROM zones WHERE zone_code = ?', [values.zoneId], existing?.zone_code === values.zoneId, 'zone'],
    ['SELECT status FROM plans WHERE plan_code = ?', [values.planId], existing?.plan_code === values.planId, 'plan'],
  ]) {
    const [err, rows] = await runQuery(sql, params);
    if (err) return res.status(500).json({ code: 2, message: `Unable to validate ${label}.` });
    if (!rows.length || (rows[0].status !== 'active' && !unchanged)) {
      return res.json({ code: 2, message: `Select an active ${label}.` });
    }
  }
  const params = [values.fullName, values.phone, values.email, values.address, values.zoneId, values.planId,
    values.categoryId, values.joinedDate, values.latitude, values.longitude, values.locationAddress,
    values.locationDescription, values.status];
  const fields = 'full_name = ?, phone = ?, email = ?, address = ?, zone_code = ?, plan_code = ?, category_id = ?, joined_date = ?, latitude = ?, longitude = ?, location_address = ?, location_description = ?, status = ?';
  const removingPhoto = req.body.removeHousePhoto === true || req.body.removeHousePhoto === 'true';
  let newPhoto;
  try {
    if (req.file) newPhoto = await storePhoto(req.file);
    const photoChanged = Boolean(newPhoto) || removingPhoto;
    const photoFields = photoChanged ? ', house_photo_key = ?, house_photo_mime = ?' : '';
    const saveParams = photoChanged ? [...params, newPhoto?.key || null, newPhoto?.mime || null] : params;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const id = editing ? code : String(randomInt(10000, 100000));
      try {
        const saved = await withTransaction(async (connection) => {
          if (editing) {
            const [rows] = await connection.query('SELECT * FROM customers WHERE customer_code = ? FOR UPDATE', [id]);
            if (!rows.length) { const error = new Error('Customer not found.'); error.status = 404; throw error; }
            const customer = rows[0];
            const [activePlan] = await connection.query(`SELECT p.plan_code FROM customer_plan_history h JOIN plans p ON p.id = h.plan_id WHERE h.customer_id = ? AND h.effective_from <= UTC_DATE() ORDER BY h.effective_from DESC LIMIT 1`, [customer.id]);
            const currentPlan = activePlan[0]?.plan_code || customer.plan_code;
            const [subscriptions] = await connection.query('SELECT status FROM billing_subscriptions WHERE customer_id = ?', [customer.id]);
            const [posted] = await connection.query('SELECT id FROM account_ledger WHERE customer_id = ? LIMIT 1', [customer.id]);
            if ((subscriptions[0]?.status === 'active' || posted.length) && values.joinedDate !== dateText(customer.joined_date || customer.created_at)) throw fail('Joined date cannot change after billing is activated or account entries have been posted.');
            const editParams = [...saveParams];
            editParams[5] = currentPlan;
            // IDs and pickup scheduling remain unchanged. Photo metadata and customer details commit together.
            await connection.query(`UPDATE customers SET ${fields}${photoFields} WHERE customer_code = ?`, [...editParams, id]);
            const [pending] = await connection.query('SELECT h.id, p.plan_code FROM customer_plan_history h JOIN plans p ON p.id = h.plan_id WHERE h.customer_id = ? AND h.effective_from > UTC_DATE() ORDER BY h.effective_from LIMIT 1', [customer.id]);
            if (values.planId !== (pending[0]?.plan_code || currentPlan) && !['Admin', 'Super Admin', 'Manager', 'Accountant'].includes(req.user.role)) throw fail('Financial account access is required to change an existing customer’s plan.', 403);
            const planEffectiveDate = values.planId !== currentPlan || pending.length
              ? await schedulePlan(connection, { ...customer, plan_code: currentPlan }, values.planId, req.user.user_id) : null;
            if (planEffectiveDate) {
              const [plans] = await connection.query('SELECT name FROM plans WHERE plan_code = ?', [values.planId]);
              await require('../services/smsNotifications').enqueue(connection, 'plan_change', { ...customer, full_name: values.fullName, phone: values.phone }, `plan:${customer.id}:${planEffectiveDate}:${values.planId}`, { plan: plans[0]?.name || values.planId, effectiveDate: planEffectiveDate });
            }
            return { previousPhoto: photoChanged ? customer.house_photo_key : null, planEffectiveDate };
          }
          const [created] = await connection.query(`INSERT INTO customers SET customer_code = ?, ${fields}${photoFields}`, [id, ...saveParams]);
          await enrolCustomer(connection, { id: created.insertId, customer_code: id, plan_code: values.planId, joined_date: values.joinedDate, status: values.status }, req.user.user_id);
          await require('../services/smsNotifications').enqueue(connection, 'registration', { id: created.insertId, customer_code: id, full_name: values.fullName, phone: values.phone }, `registration:${created.insertId}`);
          return { previousPhoto: null, planEffectiveDate: null };
        });
        await removePhoto(saved.previousPhoto);
        return res.json({ code: 1, data: { id, planEffectiveDate: saved.planEffectiveDate }, message: saved.planEffectiveDate ? `Customer saved. Plan change takes effect on ${saved.planEffectiveDate}.` : editing ? 'Customer updated successfully.' : `Customer ${id} created successfully.` });
      } catch (error) {
        if (!editing && error.code === 'ER_DUP_ENTRY') continue;
        throw error;
      }
    }
    const error = new Error('Unable to allocate a customer ID. Please try again.');
    error.status = 503;
    throw error;
  } catch (error) {
    await removePhoto(newPhoto?.key);
    return res.status(error.status || 500).json({ code: 2, message: error.status ? error.message : 'Unable to save customer and house photo. Please try again.' });
  }
};

router.post('/customers', receiveHousePhoto, saveCustomer);
router.patch('/customers/:id', receiveHousePhoto, saveCustomer);
module.exports = router;
