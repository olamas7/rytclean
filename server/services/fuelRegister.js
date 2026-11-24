const { createHash } = require('crypto');
const { withTransaction } = require('../db');
const { fail, id, decimal, query, canFinance, canManage } = require('./fleetOperations');
const hash = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const today = () => new Date().toISOString().slice(0, 10);
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw fail('Choose a valid date.');
  return value;
}
function calculateFuel(litres, pricePerLitre) {
  const litresMilli = decimal(litres, 3);
  const priceUnits = decimal(pricePerLitre, 4);
  const cents = Number((BigInt(litresMilli) * BigInt(priceUnits) + 50000n) / 100000n);
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 9999999999) throw fail('Calculated fuel total is outside the supported range.');
  return { litresMilli, priceUnits, cents };
}
const requireRead = (actor) => { if (!canFinance(actor) && !canManage(actor)) throw fail('Accountant or manager access is required.', 403); };
const requireWrite = (actor) => { if (!canFinance(actor)) throw fail('Accountant or administrator access is required.', 403); };
const base = `FROM fleet_fuel f LEFT JOIN fleet_runs r ON r.id = f.run_id
  JOIN fleet_vehicles v ON v.id = COALESCE(f.vehicle_id, r.vehicle_id)
  JOIN drivers d ON d.id = COALESCE(f.driver_id, r.driver_id) JOIN users u ON u.id = d.user_id`;
const fields = `f.*, COALESCE(f.vehicle_id, r.vehicle_id) AS vehicleId, COALESCE(f.driver_id, r.driver_id) AS driverId,
  COALESCE(f.issue_date, DATE(f.created_at)) AS issueDate,
  COALESCE(f.vehicle_registration, v.registration) AS vehicleRegistration, COALESCE(f.driver_name, u.fullname) AS driverName,
  r.route_name AS routeName, r.service_date AS routeDate,
  EXISTS(SELECT 1 FROM fleet_fuel rev WHERE rev.reverses_id = f.id) AS reversed,
  (f.issue_date IS NULL) AS legacyDate, (f.unit_price_units IS NULL) AS legacyPrice`;

async function fuelOptions(actor, requestedRunId) {
  requireRead(actor);
  const [vehicles, drivers, runs] = await Promise.all([
    query('SELECT id, registration, description, status FROM fleet_vehicles ORDER BY registration'),
    query('SELECT d.id, u.fullname AS name, d.status, u.status AS userStatus FROM drivers d JOIN users u ON u.id = d.user_id ORDER BY u.fullname'),
    query("SELECT id, vehicle_id, driver_id, route_name, service_date, status FROM fleet_runs WHERE status <> 'cancelled' ORDER BY id DESC LIMIT 500")
  ]);
  if (requestedRunId && !runs.some((run) => Number(run.id) === id(requestedRunId))) {
    const requested = await query("SELECT id, vehicle_id, driver_id, route_name, service_date, status FROM fleet_runs WHERE id = ? AND status <> 'cancelled'", [id(requestedRunId)]);
    if (!requested.length) throw fail('The requested route assignment is unavailable.', 404);
    runs.unshift(requested[0]);
  }
  return { vehicles, drivers, runs };
}
async function issueFuel(actor, input) {
  requireWrite(actor);
  const totals = calculateFuel(input.litres, input.pricePerLitre);
  const issueDate = date(input.issueDate);
  if (issueDate > today()) throw fail('Fuel issue date cannot be in the future.');
  const cheque = typeof input.chequeNumber === 'string' ? input.chequeNumber.trim() : '';
  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim() : 'Fuel issued';
  if (!cheque || cheque.length > 120 || note.length > 500) throw fail('Enter a cheque number (up to 120 characters) and notes of at most 500 characters.');
  const data = { vehicleId: id(input.vehicleId), driverId: id(input.driverId), runId: input.runId ? id(input.runId) : null, issueDate, cheque, note, ...totals };
  const requestKey = String(input.requestKey || '');
  if (!/^[A-Za-z0-9-]{16,80}$/.test(requestKey)) throw fail('Reload the form to obtain a valid request key.');
  const fingerprint = hash(data);
  return withTransaction(async (connection) => {
    const [vehicles] = await connection.query('SELECT * FROM fleet_vehicles WHERE id = ? FOR UPDATE', [data.vehicleId]);
    const [drivers] = await connection.query('SELECT d.*, u.fullname AS name FROM drivers d JOIN users u ON u.id = d.user_id WHERE d.id = ? FOR UPDATE', [data.driverId]);
    if (!vehicles.length || !drivers.length) throw fail('Select a registered vehicle and driver.');
    const [existing] = await connection.query('SELECT id, fingerprint FROM fleet_fuel WHERE request_key = ?', [requestKey]);
    if (existing.length) { if (existing[0].fingerprint !== fingerprint) throw fail('This request key was used for a different fuel issue.', 409); return { id: existing[0].id, repeated: true }; }
    if (data.runId) {
      const [runs] = await connection.query('SELECT vehicle_id, driver_id, status FROM fleet_runs WHERE id = ?', [data.runId]);
      if (!runs.length || Number(runs[0].vehicle_id) !== data.vehicleId || Number(runs[0].driver_id) !== data.driverId || runs[0].status === 'cancelled') throw fail('The optional route assignment must belong to this driver and vehicle and must not be cancelled.');
    }
    const [entry] = await connection.query(`INSERT INTO fleet_fuel (run_id, vehicle_id, driver_id, issue_date, unit_price_units, vehicle_registration, driver_name,
      entry_type, litres_milli, amount_cents, method, reference, external_key, note, request_key, fingerprint, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'issue', ?, ?, 'cheque', ?, ?, ?, ?, ?, ?)`, [data.runId, data.vehicleId, data.driverId, issueDate, totals.priceUnits,
      vehicles[0].registration, drivers[0].name, totals.litresMilli, totals.cents, cheque, hash(`cheque:${cheque.toUpperCase()}`), note, requestKey, fingerprint, actor.id]);
    await connection.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)', [actor.id, 'ISSUE_VEHICLE_FUEL', JSON.stringify({ entryId: entry.insertId, vehicleId: data.vehicleId, driverId: data.driverId, issueDate, runId: data.runId, amountCents: totals.cents })]);
    return { id: entry.insertId, amountCents: totals.cents, issueDate, vehicleId: data.vehicleId, driverId: data.driverId, repeated: false };
  });
}
async function reverseFuel(actor, entryId, input) {
  requireWrite(actor);
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  const requestKey = String(input.requestKey || '');
  if (!note || note.length > 500 || !/^[A-Za-z0-9-]{16,80}$/.test(requestKey)) throw fail('Enter a reversal reason and valid request key.');
  const fingerprint = hash({ entryId: id(entryId), note, type: 'fuel_reversal' });
  return withTransaction(async (connection) => {
    const [issues] = await connection.query(`SELECT ${fields} ${base} WHERE f.id = ? FOR UPDATE`, [id(entryId)]);
    const original = issues[0];
    const [existing] = await connection.query('SELECT id, fingerprint FROM fleet_fuel WHERE request_key = ?', [requestKey]);
    if (existing.length) { if (existing[0].fingerprint !== fingerprint) throw fail('This request key was used for different details.', 409); return { id: existing[0].id, repeated: true }; }
    if (!original || original.entry_type !== 'issue' || original.reversed) throw fail('This fuel issue cannot be reversed or is already reversed.');
    const issueDate = original.issueDate instanceof Date ? original.issueDate.toISOString().slice(0, 10) : String(original.issueDate).slice(0, 10);
    const [entry] = await connection.query(`INSERT INTO fleet_fuel (run_id, vehicle_id, driver_id, issue_date, unit_price_units, vehicle_registration, driver_name,
      entry_type, litres_milli, amount_cents, method, reference, note, reverses_id, request_key, fingerprint, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'reversal', ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [original.run_id, original.vehicleId, original.driverId, issueDate,
      original.unit_price_units, original.vehicleRegistration, original.driverName, original.litres_milli, original.amount_cents, original.method, original.reference, note, original.id, requestKey, fingerprint, actor.id]);
    await connection.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)', [actor.id, 'REVERSE_VEHICLE_FUEL', JSON.stringify({ entryId: entry.insertId, reversesId: original.id, note })]);
    return { id: entry.insertId, issueDate, vehicleId: original.vehicleId, driverId: original.driverId, repeated: false };
  });
}
async function fuelReport(actor, input) {
  requireRead(actor);
  const from = date(input.from || `${today().slice(0, 7)}-01`); const to = date(input.to || today());
  if (from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 366) throw fail('Choose a reporting period of at most 366 days, with From before To.');
  const vehicleId = input.vehicleId && input.vehicleId !== 'all' ? id(input.vehicleId) : null;
  const driverId = input.driverId && input.driverId !== 'all' ? id(input.driverId) : null;
  const page = Math.max(0, Math.min(100000, Number.parseInt(input.page, 10) || 0));
  const runPage = Math.max(0, Math.min(100000, Number.parseInt(input.runPage, 10) || 0));
  const limit = [10, 25, 50, 100].includes(Number(input.limit)) ? Number(input.limit) : 25;
  const conditions = ['COALESCE(f.issue_date, DATE(f.created_at)) BETWEEN ? AND ?']; const params = [from, to];
  if (vehicleId) { conditions.push('COALESCE(f.vehicle_id, r.vehicle_id) = ?'); params.push(vehicleId); }
  if (driverId) { conditions.push('COALESCE(f.driver_id, r.driver_id) = ?'); params.push(driverId); }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const sign = "IF(f.entry_type = 'reversal', -1, 1)";
  const [count] = await query(`SELECT COUNT(*) AS total, COALESCE(SUM(${sign} * f.litres_milli),0) AS litresMilli,
    COALESCE(SUM(${sign} * f.amount_cents),0) AS amountCents,
    COALESCE(SUM(IF(f.run_id IS NULL, ${sign} * f.litres_milli, 0)),0) AS unlinkedLitresMilli ${base} ${where}`, params);
  const entries = await query(`SELECT ${fields} ${base} ${where} ORDER BY issueDate DESC, f.id DESC LIMIT ? OFFSET ?`, [...params, limit, page * limit]);
  const fuelGroups = await query(`SELECT COALESCE(f.vehicle_id,r.vehicle_id) AS vehicleId, COALESCE(f.driver_id,r.driver_id) AS driverId,
    MAX(v.registration) AS vehicleRegistration, MAX(u.fullname) AS driverName,
    SUM(${sign} * f.litres_milli) AS litresMilli, SUM(${sign} * f.amount_cents) AS amountCents,
    SUM(IF(f.run_id IS NULL, ${sign} * f.litres_milli, 0)) AS unlinkedLitresMilli
    ${base} ${where} GROUP BY COALESCE(f.vehicle_id,r.vehicle_id), COALESCE(f.driver_id,r.driver_id)`, params);
  for (const group of [count, ...fuelGroups]) for (const name of ['litresMilli', 'amountCents', 'unlinkedLitresMilli']) {
    if (!Number.isSafeInteger(Number(group[name]))) throw fail('Report totals exceed the supported precision. Narrow the reporting period.');
  }
  const runConditions = ['r.service_date BETWEEN ? AND ?', "r.status <> 'cancelled'"]; const runParams = [from, to];
  if (vehicleId) { runConditions.push('r.vehicle_id = ?'); runParams.push(vehicleId); }
  if (driverId) { runConditions.push('r.driver_id = ?'); runParams.push(driverId); }
  const runFrom = `FROM fleet_runs r JOIN fleet_vehicles v ON v.id = r.vehicle_id JOIN drivers d ON d.id = r.driver_id JOIN users u ON u.id = d.user_id WHERE ${runConditions.join(' AND ')}`;
  const [runCount] = await query(`SELECT COUNT(*) AS total ${runFrom}`, runParams);
  const runGroups = await query(`SELECT r.vehicle_id AS vehicleId, r.driver_id AS driverId, MAX(v.registration) AS vehicleRegistration,
    MAX(u.fullname) AS driverName, COUNT(*) AS runCount, SUM(r.distance_m) / 1000 AS gpsKm,
    SUM(IF(r.start_odometer IS NOT NULL AND r.end_odometer IS NOT NULL, r.end_odometer-r.start_odometer, r.distance_m/1000)) AS comparisonKm,
    SUM(IF(r.start_odometer IS NOT NULL AND r.end_odometer IS NOT NULL, 1, 0)) AS odometerRuns, SUM(r.tracking_gaps) AS trackingGaps
    ${runFrom} GROUP BY r.vehicle_id,r.driver_id`, runParams);
  const runs = await query(`SELECT r.id, r.vehicle_id AS vehicleId, r.driver_id AS driverId, r.route_name, r.service_date, r.status,
    v.registration AS vehicleRegistration, u.fullname AS driverName, r.distance_m/1000 AS gpsKm,
    IF(r.start_odometer IS NOT NULL AND r.end_odometer IS NOT NULL,r.end_odometer-r.start_odometer,NULL) AS odometerKm, r.tracking_gaps
    ${runFrom} ORDER BY r.service_date DESC,r.id DESC LIMIT ? OFFSET ?`, [...runParams, limit, runPage * limit]);
  const groups = new Map();
  for (const group of [...fuelGroups, ...runGroups]) {
    const groupKey = `${group.vehicleId}:${group.driverId}`;
    groups.set(groupKey, { id: groupKey, litresMilli: 0, amountCents: 0, unlinkedLitresMilli: 0, runCount: 0, gpsKm: 0, comparisonKm: 0, odometerRuns: 0, trackingGaps: 0, ...groups.get(groupKey), ...group });
  }
  return { from, to, total: Number(count.total), runTotal: Number(runCount.total), entries, runs, page, runPage, limit,
    summary: { litresMilli: Number(count.litresMilli), amountCents: Number(count.amountCents), unlinkedLitresMilli: Number(count.unlinkedLitresMilli) },
    groups: [...groups.values()].map((group) => ({ ...group, litresMilli: Number(group.litresMilli), amountCents: Number(group.amountCents), comparisonKm: Number(group.comparisonKm), gpsKm: Number(group.gpsKm), issuedLitresPer100Km: Number(group.comparisonKm) > 0 ? Number(group.litresMilli) / 1000 / Number(group.comparisonKm) * 100 : null })) };
}
async function fuelDetail(actor, entryId) {
  requireRead(actor);
  const [entry] = await query(`SELECT ${fields} ${base} WHERE f.id = ?`, [id(entryId)]);
  if (!entry) throw fail('Fuel entry not found.', 404);
  return entry;
}
module.exports = { calculateFuel, fuelOptions, issueFuel, reverseFuel, fuelReport, fuelDetail };
