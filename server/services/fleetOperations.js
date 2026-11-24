const { createHash } = require('crypto');
const { runQuery, withTransaction } = require('../db');
const geo = require('./fleetGeometry');
const evidence = require('../utils/pickupEvidence');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const hash = (value) => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const key = (value) => { if (typeof value !== 'string' || !/^[A-Za-z0-9-]{16,80}$/.test(value)) throw fail('Reload the form to obtain a valid request key.'); return value; };
const id = (value) => { const number = Number(value); if (!Number.isSafeInteger(number) || number <= 0) throw fail('Select a valid record.'); return number; };
const text = (value, label, max = 500) => { if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw fail(`${label} is required (maximum ${max} characters).`); return value.trim(); };
const today = () => new Date().toISOString().slice(0, 10);
const json = (value) => typeof value === 'string' ? JSON.parse(value) : value;
const canManage = (actor) => ['Admin', 'Super Admin', 'Manager'].includes(actor.role);
const canFinance = (actor) => ['Admin', 'Super Admin', 'Accountant'].includes(actor.role);
const canDrive = (actor) => ['Driver', 'Supervisor'].includes(actor.role); // Supervisor is a legacy driver-role alias.
const requireManager = (actor) => { if (!canManage(actor)) throw fail('Manager or administrator access is required.', 403); };
const audit = (connection, actor, action, details) => connection.query('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)', [actor.id, action, JSON.stringify(details)]);
async function query(sql, params = []) { const [error, rows] = await runQuery(sql, params); if (error) throw error; return rows; }
const reader = { query: async (sql, params) => [await query(sql, params)] };
function decimal(value, places = 2, allowZero = false) {
  if (!new RegExp(`^\\d+(\\.\\d{1,${places}})?$`).test(String(value ?? ''))) throw fail(`Enter an amount with up to ${places} decimals.`);
  const [whole, fraction = ''] = String(value).split('.');
  const result = Number(BigInt(whole) * (10n ** BigInt(places)) + BigInt(fraction.padEnd(places, '0')));
  if (!Number.isSafeInteger(result) || result > 9999999999 || result < (allowZero ? 0 : 1)) throw fail('Amount is outside the supported range.');
  return result;
}
function odometer(value) {
  return value === undefined || value === null || value === '' ? null : decimal(value, 1, true) / 10;
}
async function accessRun(connection, runId, actor, lock = false) {
  const [rows] = await connection.query(`SELECT r.*, d.user_id AS driver_user_id, u.fullname AS driver_name,
    v.registration, v.description AS vehicle_description, s.fullname AS supervisor_name
    FROM fleet_runs r JOIN drivers d ON d.id = r.driver_id JOIN users u ON u.id = d.user_id
    JOIN fleet_vehicles v ON v.id = r.vehicle_id JOIN users s ON s.id = r.supervisor_id WHERE r.id = ? ${lock ? 'FOR UPDATE' : ''}`, [id(runId)]);
  const run = rows[0];
  if (!run) throw fail('Route assignment not found.', 404);
  if (canDrive(actor) && Number(run.driver_user_id) !== actor.id) throw fail('This route assignment is not assigned to you.', 403);
  return run;
}
async function options(actor) {
  requireManager(actor);
  const [vehicles, drivers, routes, customers] = await Promise.all([
    query('SELECT v.*, r.id AS open_run_id FROM fleet_vehicles v LEFT JOIN fleet_runs r ON r.open_vehicle_id = v.id ORDER BY v.registration'),
    query("SELECT d.id, u.fullname AS name, d.status, r.id AS open_run_id FROM drivers d JOIN users u ON u.id = d.user_id LEFT JOIN fleet_runs r ON r.open_driver_id = d.id WHERE u.status = 1 AND u.work_title IN ('driver','supervisor') AND u.role IN ('Driver','Supervisor') ORDER BY u.fullname"),
    query('SELECT r.*, z.zone_code, z.name AS zone_name FROM collection_routes r JOIN zones z ON z.id = r.zone_id ORDER BY r.route_name'),
    query("SELECT c.id, c.customer_code, UPPER(c.full_name) AS name, c.zone_code, c.latitude, c.longitude, EXISTS(SELECT 1 FROM fleet_complaints f WHERE f.customer_id = c.id AND f.status = 'open') AS complaint FROM customers c WHERE c.status = 'active' ORDER BY c.full_name LIMIT 5001")
  ]);
  return { vehicles, drivers, routes, customers: customers.slice(0, 5000), customerLimitReached: customers.length > 5000,
    routeStops: await query('SELECT * FROM fleet_route_stops ORDER BY route_id, stop_order') };
}
async function saveVehicle(actor, input, vehicleId) {
  requireManager(actor);
  const registration = text(input.registration, 'Vehicle registration', 30).toUpperCase();
  const description = text(input.description, 'Vehicle description', 150);
  if (!['available', 'maintenance', 'inactive'].includes(input.status)) throw fail('Select a vehicle status.');
  const expected = input.expectedLitres === '' || input.expectedLitres == null ? null : decimal(input.expectedLitres) / 100;
  if (expected !== null && expected > 200) throw fail('Expected fuel consumption must not exceed 200 L/100 km.');
  return withTransaction(async (connection) => {
    if (vehicleId) {
      const [rows] = await connection.query('SELECT id FROM fleet_vehicles WHERE id = ? FOR UPDATE', [id(vehicleId)]);
      if (!rows.length) throw fail('Vehicle not found.', 404);
      const [runs] = await connection.query('SELECT id FROM fleet_runs WHERE open_vehicle_id = ?', [id(vehicleId)]);
      if (runs.length) throw fail('Finish/cancel the open assignment before editing this vehicle.', 409);
      await connection.query('UPDATE fleet_vehicles SET registration = ?, description = ?, status = ?, expected_l_per_100km = ? WHERE id = ?', [registration, description, input.status, expected, id(vehicleId)]);
    } else {
      const [created] = await connection.query('INSERT INTO fleet_vehicles (registration, description, status, expected_l_per_100km) VALUES (?, ?, ?, ?)', [registration, description, input.status, expected]);
      vehicleId = created.insertId;
    }
    await audit(connection, actor, 'SAVE_FLEET_VEHICLE', { vehicleId, registration, status: input.status });
    return { id: vehicleId };
  });
}
async function saveRouteStops(actor, routeId, input) {
  requireManager(actor);
  if (!Array.isArray(input.customerIds) || !input.customerIds.length || input.customerIds.length > 1000) throw fail('Select 1–1000 customer stops in route order.');
  const ids = input.customerIds.map(id);
  if (new Set(ids).size !== ids.length) throw fail('Each customer can appear only once in a route.');
  return withTransaction(async (connection) => {
    const [routes] = await connection.query('SELECT r.*, z.zone_code FROM collection_routes r JOIN zones z ON z.id = r.zone_id WHERE r.id = ? FOR UPDATE', [id(routeId)]);
    if (!routes.length) throw fail('Route not found.', 404);
    const [customers] = await connection.query(`SELECT id, latitude, longitude FROM customers WHERE id IN (${ids.map(() => '?')}) AND zone_code = ? AND status = 'active'`, [...ids, routes[0].zone_code]);
    if (customers.length !== ids.length || customers.some((row) => row.latitude === null || row.longitude === null || !geo.coordinate(Number(row.latitude), Number(row.longitude)))) throw fail('Choose active customers in the route zone with saved GPS coordinates.');
    await connection.query('DELETE FROM fleet_route_stops WHERE route_id = ?', [id(routeId)]);
    for (const [index, customerId] of ids.entries()) await connection.query('INSERT INTO fleet_route_stops (route_id, customer_id, stop_order) VALUES (?, ?, ?)', [id(routeId), customerId, index + 1]);
    await audit(connection, actor, 'SET_ROUTE_STOPS', { routeId: id(routeId), customerIds: ids });
  });
}
async function updateDriver(actor, driverId, input) {
  requireManager(actor);
  if (!/^\d{10}$/.test(String(input.phone)) || !['available', 'off-duty', 'inactive'].includes(input.status)) throw fail('Provide a ten-digit phone and available/off-duty/inactive status.');
  return withTransaction(async (connection) => {
    const [drivers] = await connection.query('SELECT id FROM drivers WHERE id = ? FOR UPDATE', [id(driverId)]);
    if (!drivers.length) throw fail('Driver not found.', 404);
    const [runs] = await connection.query('SELECT id FROM fleet_runs WHERE open_driver_id = ?', [id(driverId)]);
    if (runs.length) throw fail('Finish/cancel the open assignment before editing this driver.', 409);
    const [zones] = await connection.query('SELECT id FROM zones WHERE id = ?', [id(input.zoneId)]);
    if (!zones.length) throw fail('Choose a valid zone.');
    await connection.query('UPDATE drivers SET phone = ?, zone_id = ?, status = ? WHERE id = ?', [String(input.phone), id(input.zoneId), input.status, id(driverId)]);
    await audit(connection, actor, 'UPDATE_DRIVER_PROFILE', { driverId: id(driverId), status: input.status });
  });
}
async function updateRoute(actor, routeId, input) {
  requireManager(actor);
  let line; try { line = geo.routeLine(input.routeGeoJson); } catch (error) { throw fail(error.message); }
  const name = text(input.routeName, 'Route name', 150); const start = text(input.startPoint, 'Start point', 150); const end = text(input.endPoint, 'End point', 150);
  const duration = Number(input.estimatedDurationMins);
  if (!['active', 'inactive', 'draft'].includes(input.status) || !Number.isInteger(duration) || duration < 1 || duration > 1440 || String(input.notes || '').length > 1000) throw fail('Choose a valid status and duration (1–1440 minutes). Notes allow 1000 characters.');
  return withTransaction(async (connection) => {
    const [rows] = await connection.query('SELECT * FROM collection_routes WHERE id = ? FOR UPDATE', [id(routeId)]);
    if (!rows.length) throw fail('Route not found.', 404);
    const [zones] = await connection.query('SELECT id FROM zones WHERE id = ?', [id(input.zoneId)]);
    if (!zones.length || Number(rows[0].zone_id) !== id(input.zoneId)) throw fail('Existing routes retain their zone. Create a new route to move to another zone.');
    const first = line.coordinates[0]; const last = line.coordinates[line.coordinates.length - 1];
    await connection.query('UPDATE collection_routes SET route_name = ?, start_point = ?, end_point = ?, estimated_duration_mins = ?, status = ?, notes = ?, route_geojson = ?, start_lat = ?, start_lng = ?, end_lat = ?, end_lng = ? WHERE id = ?', [name, start, end, duration, input.status, String(input.notes || ''), JSON.stringify(line), first[1], first[0], last[1], last[0], id(routeId)]);
    await audit(connection, actor, 'EDIT_COLLECTION_ROUTE', { routeId: id(routeId) });
  });
}
async function updateZone(actor, zoneId, input) {
  requireManager(actor);
  const polygon = input.boundaryGeoJson; const ring = polygon?.coordinates?.[0];
  if (polygon?.type !== 'Polygon' || !Array.isArray(ring) || ring.length < 4 || ring.length > 2000 || ring.some((point) => !Array.isArray(point) || !geo.coordinate(point[1], point[0])) || JSON.stringify(ring[0]) !== JSON.stringify(ring[ring.length - 1]) || new Set(ring.slice(0, -1).map((point) => JSON.stringify(point))).size < 3) throw fail('Save a closed zone polygon with at least three distinct points.');
  if (!['active', 'inactive'].includes(input.status) || String(input.coverageArea || '').length > 255) throw fail('Choose a valid zone status and coverage area.');
  const center = ring.slice(0, -1).reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]).map((sum) => sum / (ring.length - 1));
  return withTransaction(async (connection) => {
    const [rows] = await connection.query('SELECT id FROM zones WHERE id = ? FOR UPDATE', [id(zoneId)]);
    if (!rows.length) throw fail('Zone not found.', 404);
    await connection.query('UPDATE zones SET name = ?, city = ?, coverage_area = ?, status = ?, boundary_geojson = ?, center_lat = ?, center_lng = ? WHERE id = ?', [text(input.name, 'Zone name', 150), text(input.city, 'City', 120), String(input.coverageArea || ''), input.status, JSON.stringify(polygon), center[1], center[0], id(zoneId)]);
    await audit(connection, actor, 'EDIT_SERVICE_ZONE', { zoneId: id(zoneId) });
  });
}
async function assignRoute(actor, input) {
  requireManager(actor);
  const data = { routeId: id(input.routeId), driverId: id(input.driverId), vehicleId: id(input.vehicleId), serviceDate: input.serviceDate, corridor: Number(input.corridor || 100) };
  if (typeof data.serviceDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.serviceDate) || !Number.isFinite(Date.parse(`${data.serviceDate}T00:00:00Z`)) || new Date(`${data.serviceDate}T00:00:00Z`).toISOString().slice(0, 10) !== data.serviceDate || data.serviceDate < today()) throw fail('Choose today or a future service date.');
  if (!Number.isInteger(data.corridor) || data.corridor < 30 || data.corridor > 1000) throw fail('Route corridor must be 30–1000 metres.');
  const requestKey = key(input.requestKey); const fingerprint = hash(data);
  return withTransaction(async (connection) => {
    const [vehicles] = await connection.query('SELECT * FROM fleet_vehicles WHERE id = ? FOR UPDATE', [data.vehicleId]);
    const [drivers] = await connection.query('SELECT d.*, u.status AS user_status, u.work_title, u.role AS user_role FROM drivers d JOIN users u ON u.id = d.user_id WHERE d.id = ? FOR UPDATE', [data.driverId]);
    const [existing] = await connection.query('SELECT id, fingerprint FROM fleet_runs WHERE request_key = ?', [requestKey]);
    if (existing.length) { if (existing[0].fingerprint !== fingerprint) throw fail('This request key was used for a different assignment.', 409); return { id: existing[0].id, repeated: true }; }
    if (vehicles[0]?.status !== 'available' || drivers[0]?.status !== 'available' || Number(drivers[0]?.user_status) !== 1 || !['driver', 'supervisor'].includes(drivers[0]?.work_title) || !['Driver', 'Supervisor'].includes(drivers[0]?.user_role)) throw fail('Choose an available vehicle and active available driver.');
    const [busy] = await connection.query('SELECT id FROM fleet_runs WHERE open_driver_id = ? OR open_vehicle_id = ?', [data.driverId, data.vehicleId]);
    if (busy.length) throw fail('The driver or vehicle already has an open route assignment.', 409);
    const [routes] = await connection.query("SELECT r.*, z.zone_code FROM collection_routes r JOIN zones z ON z.id = r.zone_id WHERE r.id = ? AND r.status = 'active' AND z.status = 'active' FOR UPDATE", [data.routeId]);
    if (!routes.length) throw fail('Choose an active route in an active zone.');
    let line; try { line = geo.routeLine(routes[0].route_geojson); } catch (error) { throw fail(error.message); }
    const [stops] = await connection.query(`SELECT c.*, rs.stop_order, EXISTS(SELECT 1 FROM fleet_complaints f WHERE f.customer_id = c.id AND f.status = 'open') AS complaint
      FROM fleet_route_stops rs JOIN customers c ON c.id = rs.customer_id WHERE rs.route_id = ? ORDER BY rs.stop_order`, [data.routeId]);
    if (!stops.length || stops.some((stop) => stop.status !== 'active' || stop.zone_code !== routes[0].zone_code || stop.latitude === null || stop.longitude === null || !geo.coordinate(Number(stop.latitude), Number(stop.longitude)))) throw fail('Configure this route with active, GPS-located customer stops first.');
    const [created] = await connection.query(`INSERT INTO fleet_runs (route_id, driver_id, vehicle_id, supervisor_id, service_date, route_name, route_geojson, corridor_m, expected_l_per_100km, open_driver_id, open_vehicle_id, request_key, fingerprint, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.routeId, data.driverId, data.vehicleId, drivers[0].user_id, data.serviceDate, routes[0].route_name, JSON.stringify(line), data.corridor, vehicles[0].expected_l_per_100km, data.driverId, data.vehicleId, requestKey, fingerprint, actor.id]);
    for (const stop of stops) await connection.query(`INSERT INTO fleet_stops (run_id, customer_id, stop_order, customer_name, customer_code, latitude, longitude, address, photo_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [created.insertId, stop.id, stop.stop_order, stop.full_name.toUpperCase(), stop.customer_code, stop.latitude, stop.longitude, stop.location_description || stop.location_address || stop.address || '', stop.complaint ? 1 : 0]);
    await audit(connection, actor, 'ASSIGN_COLLECTION_ROUTE', { runId: created.insertId, ...data, stops: stops.length });
    return { id: created.insertId, repeated: false };
  });
}
async function transition(actor, runId, input) {
  return withTransaction(async (connection) => {
    const run = await accessRun(connection, runId, actor, true);
    if (!canManage(actor) && (!canDrive(actor) || Number(run.driver_user_id) !== actor.id)) throw fail('Only the assigned driver or a manager can change route state.', 403);
    if (!['start', 'finish', 'cancel'].includes(input.action)) throw fail('Select a valid route action.');
    if (input.action === 'start') {
      if (run.status === 'started') return { repeated: true };
      if (run.status !== 'assigned' || String(run.service_date instanceof Date ? run.service_date.toISOString().slice(0, 10) : run.service_date).slice(0, 10) > today()) throw fail('Only due assigned routes can be started.');
      await connection.query("UPDATE fleet_runs SET status = 'started', started_at = UTC_TIMESTAMP(3), start_odometer = ? WHERE id = ?", [odometer(input.odometer), run.id]);
    } else {
      if (run.status === (input.action === 'finish' ? 'completed' : 'cancelled')) return { repeated: true };
      if (!['assigned', 'started'].includes(run.status)) throw fail('This route assignment is already closed.');
      const note = text(input.note, 'Closing reason');
      if (input.action === 'cancel' && !canManage(actor)) throw fail('Only a manager can cancel an assignment.', 403);
      if (input.action === 'finish' && run.status !== 'started') throw fail('Start the route before finishing.');
      const [pending] = await connection.query("SELECT COUNT(*) AS total FROM fleet_stops WHERE run_id = ? AND status IN ('pending','visited')", [run.id]);
      if (input.action === 'finish' && Number(pending[0].total) && input.acknowledgeOutstanding !== true) throw fail('There are unfinished stops. Explicitly acknowledge them before finishing.');
      const end = odometer(input.odometer);
      if (end !== null && run.start_odometer !== null && end < Number(run.start_odometer)) throw fail('End odometer cannot be lower than start odometer.');
      await connection.query('UPDATE fleet_runs SET status = ?, ended_at = UTC_TIMESTAMP(3), end_odometer = ?, open_driver_id = NULL, open_vehicle_id = NULL WHERE id = ?', [input.action === 'finish' ? 'completed' : 'cancelled', end, run.id]);
      await audit(connection, actor, 'CLOSE_COLLECTION_ROUTE', { runId: run.id, action: input.action, note, outstanding: Number(pending[0].total) });
    }
    await audit(connection, actor, 'ROUTE_STATE', { runId: run.id, action: input.action });
    return { repeated: false };
  });
}
function gpsInput(input) {
  const lat = input.latitude; const lng = input.longitude; const accuracy = input.accuracy;
  if (!geo.coordinate(lat, lng) || typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 10000) throw fail('Provide valid GPS coordinates and accuracy.');
  const time = typeof input.capturedAt === 'string' ? Date.parse(input.capturedAt) : NaN;
  if (!Number.isFinite(time) || time > Date.now() + 30000 || time < Date.now() - 86400000) throw fail('GPS timestamp is invalid, in the future or older than 24 hours.');
  return { lat, lng, accuracy, time };
}
async function recordLocation(actor, runId, input) {
  if (!canDrive(actor)) throw fail('Only the assigned driver can transmit GPS.', 403);
  const point = gpsInput(input); const requestKey = key(input.requestKey); const fingerprint = hash(point);
  return withTransaction(async (connection) => {
    const run = await accessRun(connection, runId, actor, true);
    const [existing] = await connection.query('SELECT * FROM fleet_locations WHERE run_id = ? AND request_key = ?', [run.id, requestKey]);
    if (existing.length) { if (existing[0].fingerprint !== fingerprint) throw fail('GPS request key was reused for different coordinates.', 409); return { accepted: Boolean(existing[0].accepted), reason: existing[0].reason, repeated: true }; }
    if (run.status !== 'started') throw fail('GPS can be recorded only while this route is started.');
    const [recent] = await connection.query('SELECT COUNT(*) AS total FROM fleet_locations WHERE run_id = ? AND received_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE)', [run.id]);
    if (Number(recent[0].total) >= 120) throw fail('GPS update limit reached. Wait one minute.', 429);
    let reason = ''; let distance = 0; let gap = 0;
    const lastTime = run.latest_at ? new Date(run.latest_at).getTime() : null;
    const elapsed = lastTime === null ? null : (point.time - lastTime) / 1000;
    const displacement = lastTime === null ? 0 : geo.metres({ lat: Number(run.latest_lat), lng: Number(run.latest_lng) }, point);
    if (point.accuracy > 50) reason = 'GPS accuracy exceeds 50 m';
    else if (point.time < new Date(run.started_at).getTime() - 5000) reason = 'Position predates route start';
    else if (elapsed !== null && elapsed <= 0) reason = 'Out-of-order position';
    else if (elapsed !== null && elapsed <= 120 && displacement / elapsed > 130 / 3.6) reason = 'Implausible GPS jump';
    else if (elapsed !== null && elapsed > 120) gap = 1;
    else if (elapsed !== null && displacement > Math.max(10, (point.accuracy + Number(run.latest_accuracy)) / 2)) distance = Math.round(displacement);
    const off = geo.deviation(point, geo.routeLine(run.route_geojson));
    await connection.query('INSERT INTO fleet_locations (run_id, request_key, fingerprint, latitude, longitude, accuracy, captured_at, accepted, reason, distance_m, deviation_m) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [run.id, requestKey, fingerprint, point.lat, point.lng, point.accuracy, new Date(point.time), reason ? 0 : 1, reason || null, distance, off]);
    if (!reason) {
      const offCount = off > Number(run.corridor_m) + point.accuracy ? Number(run.off_route_count) + 1 : 0;
      const speed = elapsed === null || gap ? null : distance === 0 ? 0 : Number((displacement / elapsed * 3.6).toFixed(2));
      await connection.query('UPDATE fleet_runs SET distance_m = distance_m + ?, tracking_gaps = tracking_gaps + ?, off_route_count = ?, latest_lat = ?, latest_lng = ?, latest_accuracy = ?, latest_at = ?, latest_received_at = UTC_TIMESTAMP(3), latest_deviation_m = ?, latest_speed_kmh = ? WHERE id = ?', [distance, gap, offCount, point.lat, point.lng, point.accuracy, new Date(point.time), off, speed, run.id]);
      const [stops] = await connection.query("SELECT id, latitude, longitude FROM fleet_stops WHERE run_id = ? AND status = 'pending'", [run.id]);
      for (const stop of stops) if (geo.metres(point, { lat: Number(stop.latitude), lng: Number(stop.longitude) }) <= 50) await connection.query("UPDATE fleet_stops SET status = 'visited', visited_at = ? WHERE id = ? AND status = 'pending'", [new Date(point.time), stop.id]);
    }
    return { accepted: !reason, reason: reason || null, distanceAdded: distance, repeated: false };
  });
}
async function confirmStop(actor, runId, stopId, input, file) {
  if (!canDrive(actor)) throw fail('Only the assigned driver can confirm a collection.', 403);
  if (['latitude', 'longitude', 'accuracy'].some((name) => !['string', 'number'].includes(typeof input[name]) || String(input[name]).trim() === '')) throw fail('Capture GPS coordinates and accuracy before confirming.');
  const point = gpsInput({ latitude: Number(input.latitude), longitude: Number(input.longitude), accuracy: Number(input.accuracy), capturedAt: input.capturedAt });
  if (point.accuracy > 50 || Date.now() - point.time > 120000) throw fail('Capture a fresh GPS position with accuracy within 50 m.');
  if (!['collected', 'not_collected'].includes(input.status)) throw fail('Choose collected or not collected.');
  const note = text(input.note, 'Pickup/evidence note', 1000); const requestKey = key(input.requestKey);
  const fingerprint = hash({ point, status: input.status, note, photo: file ? hash(file.buffer) : null });
  let photo;
  try {
    return await withTransaction(async (connection) => {
      const run = await accessRun(connection, runId, actor, true);
      const [stops] = await connection.query('SELECT s.*, EXISTS(SELECT 1 FROM fleet_complaints c WHERE c.customer_id = s.customer_id AND c.status = \'open\') AS complaint FROM fleet_stops s WHERE s.id = ? AND s.run_id = ? FOR UPDATE', [id(stopId), run.id]);
      const stop = stops[0];
      if (!stop) throw fail('Customer stop not found.', 404);
      if (stop.confirmation_key === requestKey) { if (stop.confirmation_fingerprint !== fingerprint) throw fail('This confirmation key was used for different evidence.', 409); return { repeated: true }; }
      if (run.status !== 'started' || !['pending', 'visited'].includes(stop.status)) throw fail('This stop is already confirmed or the route is not started.');
      if (point.time < new Date(run.started_at).getTime() - 5000) throw fail('Capture GPS after starting this route.');
      if (geo.metres(point, { lat: Number(stop.latitude), lng: Number(stop.longitude) }) > 150) throw fail('You must be within 150 m of this customer to confirm the visit.');
      if ((stop.photo_required || stop.complaint) && !file) throw fail('Photo evidence is required for this complaint-flagged customer.');
      if (file) photo = await evidence.store(file);
      await connection.query('UPDATE fleet_stops SET status = ?, note = ?, confirmed_at = UTC_TIMESTAMP(3), confirmed_by = ?, photo_key = ?, photo_mime = ?, confirmation_key = ?, confirmation_fingerprint = ?, confirmation_lat = ?, confirmation_lng = ?, confirmation_accuracy = ? WHERE id = ?', [input.status, note, actor.id, photo?.key || null, photo?.mime || null, requestKey, fingerprint, point.lat, point.lng, point.accuracy, stop.id]);
      await audit(connection, actor, 'CONFIRM_BIN_COLLECTION', { runId: run.id, stopId: stop.id, status: input.status, hasPhoto: Boolean(photo), note });
      return { repeated: false };
    });
  } catch (error) { if (photo) await evidence.remove(photo.key); throw error; }
}
function summary(run) {
  const stale = !run.latest_at || Date.now() - new Date(run.latest_at).getTime() > 120000;
  const odo = run.start_odometer !== null && run.end_odometer !== null ? Number(run.end_odometer) - Number(run.start_odometer) : null;
  return { ...run, route_geojson: json(run.route_geojson), distanceKm: Number(run.distance_m) / 1000, odometerKm: odo,
    movement: stale || run.status !== 'started' || run.latest_speed_kmh === null ? 'unknown / not tracking' : Number(run.latest_speed_kmh) >= 5 ? 'moving' : 'stopped / slow',
    tracking: run.status !== 'started' ? run.status : stale ? 'stale / no GPS' : Number(run.off_route_count) >= 3 ? 'off route' : Number(run.off_route_count) ? 'checking deviation' : 'on route' };
}
async function listRuns(actor) {
  const where = canDrive(actor) ? 'WHERE d.user_id = ?' : '';
  const runs = await query(`SELECT r.*, d.user_id AS driver_user_id, u.fullname AS driver_name, v.registration, s.fullname AS supervisor_name,
    (SELECT COUNT(*) FROM fleet_stops fs WHERE fs.run_id = r.id) AS total_stops,
    (SELECT COUNT(*) FROM fleet_stops fs WHERE fs.run_id = r.id AND fs.status = 'collected') AS collected_stops
    FROM fleet_runs r JOIN drivers d ON d.id = r.driver_id JOIN users u ON u.id = d.user_id JOIN fleet_vehicles v ON v.id = r.vehicle_id JOIN users s ON s.id = r.supervisor_id ${where} ORDER BY r.id DESC LIMIT 200`, where ? [actor.id] : []);
  return runs.map(summary);
}
async function runDetail(actor, runId) {
  const run = await accessRun(reader, runId, actor);
  const [stops, trail, fuel, counts] = await Promise.all([
    query(`SELECT s.*, EXISTS(SELECT 1 FROM fleet_complaints c WHERE c.customer_id = s.customer_id AND c.status = 'open') AS complaint,
      (SELECT GROUP_CONCAT(c.description SEPARATOR '; ') FROM fleet_complaints c WHERE c.customer_id = s.customer_id AND c.status = 'open') AS complaint_note
      FROM fleet_stops s WHERE s.run_id = ? ORDER BY s.stop_order`, [run.id]),
    query('SELECT latitude, longitude, captured_at FROM fleet_locations WHERE run_id = ? AND accepted = 1 ORDER BY captured_at DESC LIMIT 2000', [run.id]),
    query('SELECT f.*, u.fullname AS issued_by, EXISTS(SELECT 1 FROM fleet_fuel r WHERE r.reverses_id = f.id) AS reversed FROM fleet_fuel f JOIN users u ON u.id = f.created_by WHERE f.run_id = ? ORDER BY f.id', [run.id]),
    query('SELECT accepted, COUNT(*) AS total FROM fleet_locations WHERE run_id = ? GROUP BY accepted', [run.id])
  ]);
  const issued = fuel.reduce((sum, entry) => sum + (entry.entry_type === 'issue' ? 1 : -1) * Number(entry.litres_milli), 0) / 1000;
  const amount = fuel.reduce((sum, entry) => sum + (entry.entry_type === 'issue' ? 1 : -1) * Number(entry.amount_cents), 0);
  const data = summary(run); const comparisonKm = data.odometerKm === null ? data.distanceKm : data.odometerKm;
  return { ...data, stops: stops.map(({ photo_key, photo_mime, confirmation_fingerprint, ...stop }) => ({ ...stop, hasPhoto: Boolean(photo_key) })), trail: trail.reverse(), counts,
    fuel: canDrive(actor) ? [] : fuel, fuelLitres: issued, fuelAmountCents: canDrive(actor) ? null : amount,
    issuedLitresPer100Km: comparisonKm > 0 ? issued / comparisonKm * 100 : null,
    expectedLitres: run.expected_l_per_100km !== null ? comparisonKm * Number(run.expected_l_per_100km) / 100 : null };
}
async function complaints(actor) {
  if (!canManage(actor) && !canDrive(actor) && actor.role !== 'Support') throw fail('Complaint-management access is required.', 403);
  return query(`SELECT f.*, UPPER(c.full_name) AS customer_name, c.customer_code FROM fleet_complaints f JOIN customers c ON c.id = f.customer_id
    ${canDrive(actor) ? 'WHERE EXISTS(SELECT 1 FROM fleet_stops s JOIN fleet_runs r ON r.id = s.run_id JOIN drivers d ON d.id = r.driver_id WHERE s.customer_id = f.customer_id AND d.user_id = ?)' : ''}
    ORDER BY f.id DESC LIMIT 500`, canDrive(actor) ? [actor.id] : []);
}
async function saveComplaint(actor, input, complaintId) {
  if (!canManage(actor) && actor.role !== 'Support') throw fail('Manager or support access is required.', 403);
  return withTransaction(async (connection) => {
    if (complaintId) {
      const [rows] = await connection.query('SELECT id FROM fleet_complaints WHERE id = ? FOR UPDATE', [id(complaintId)]);
      if (!rows.length) throw fail('Complaint not found.', 404);
      await connection.query("UPDATE fleet_complaints SET status = 'resolved', resolved_by = ?, resolved_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'open'", [actor.id, id(complaintId)]);
    } else {
      const [customers] = await connection.query('SELECT id FROM customers WHERE id = ?', [id(input.customerId)]);
      if (!customers.length) throw fail('Customer not found.', 404);
      const [created] = await connection.query('INSERT INTO fleet_complaints (customer_id, description, created_by) VALUES (?, ?, ?)', [id(input.customerId), text(input.description, 'Complaint description', 1000), actor.id]);
      complaintId = created.insertId;
    }
    await audit(connection, actor, 'CUSTOMER_COLLECTION_COMPLAINT', { complaintId, resolved: Boolean(input.resolve) });
    return { id: complaintId };
  });
}
module.exports = { fail, id, query, reader, accessRun, canManage, canFinance, canDrive, options, saveVehicle, saveRouteStops, updateDriver, updateRoute, updateZone, assignRoute, transition, recordLocation, confirmStop, listRuns, runDetail, complaints, saveComplaint, decimal };
