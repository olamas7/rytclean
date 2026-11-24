const express = require('express');
const fleet = require('../services/fleetOperations');
const evidence = require('../utils/pickupEvidence');
const fuel = require('../services/fuelRegister');
const router = express.Router();
const handle = (work) => async (req, res, next) => {
  try { await work(req, res, next); }
  catch (error) { res.status(error.code === 'ER_DUP_ENTRY' ? 409 : error.status || 500).json({ code: 2, message: error.code === 'ER_DUP_ENTRY' ? 'This resource, request or payment reference is already in use. Refresh before retrying.' : error.status ? error.message : 'Unable to process fleet operation. Your unsaved input has been kept.' }); }
};
router.use(handle(async (req, res, next) => {
  const [user] = await fleet.query('SELECT id, role, status FROM users WHERE id = ?', [req.user.user_id]);
  if (!user || Number(user.status) !== 1 || !['Admin', 'Super Admin', 'Manager', 'Driver', 'Supervisor', 'Accountant', 'Support'].includes(user.role)) return res.status(403).json({ code: 2, message: 'Active fleet staff access is required.' });
  req.fleetActor = { id: Number(user.id), role: user.role };
  next();
}));
const reply = (res, data, message) => res.json({ code: 1, data, ...(message ? { message } : {}) });
const operations = (req) => { if (req.fleetActor.role === 'Support') throw fleet.fail('Operational fleet access is required.', 403); };
router.get('/options', handle(async (req, res) => reply(res, await fleet.options(req.fleetActor))));
router.get('/fuel/options', handle(async (req, res) => reply(res, await fuel.fuelOptions(req.fleetActor, req.query.runId))));
router.get('/fuel', handle(async (req, res) => reply(res, await fuel.fuelReport(req.fleetActor, req.query))));
router.get('/fuel/:id', handle(async (req, res) => reply(res, await fuel.fuelDetail(req.fleetActor, req.params.id))));
router.post('/fuel', handle(async (req, res) => reply(res, await fuel.issueFuel(req.fleetActor, req.body), 'Fuel issue saved with calculated total.')));
router.post('/fuel/:id/reverse', handle(async (req, res) => reply(res, await fuel.reverseFuel(req.fleetActor, req.params.id, req.body), 'Fuel issue reversed; original entry retained.')));
router.post('/vehicles', handle(async (req, res) => reply(res, await fleet.saveVehicle(req.fleetActor, req.body), 'Vehicle saved.')));
router.patch('/drivers/:id', handle(async (req, res) => reply(res, await fleet.updateDriver(req.fleetActor, req.params.id, req.body), 'Driver profile updated.')));
router.patch('/vehicles/:id', handle(async (req, res) => reply(res, await fleet.saveVehicle(req.fleetActor, req.body, req.params.id), 'Vehicle updated.')));
router.put('/routes/:id/stops', handle(async (req, res) => reply(res, await fleet.saveRouteStops(req.fleetActor, req.params.id, req.body), 'Route stops saved. Existing assignments retain their snapshots.')));
router.patch('/routes/:id', handle(async (req, res) => reply(res, await fleet.updateRoute(req.fleetActor, req.params.id, req.body), 'Route updated. Existing assignments retain their snapshots.')));
router.patch('/zones/:id', handle(async (req, res) => reply(res, await fleet.updateZone(req.fleetActor, req.params.id, req.body), 'Zone updated.')));
router.post('/runs', handle(async (req, res) => reply(res, await fleet.assignRoute(req.fleetActor, req.body), 'Route assigned. Driver and vehicle are reserved until it is finished/cancelled.')));
router.get('/runs', handle(async (req, res) => { operations(req); reply(res, await fleet.listRuns(req.fleetActor)); }));
router.get('/runs/:id', handle(async (req, res) => { operations(req); reply(res, await fleet.runDetail(req.fleetActor, req.params.id)); }));
router.post('/runs/:id/state', handle(async (req, res) => reply(res, await fleet.transition(req.fleetActor, req.params.id, req.body), 'Route state saved.')));
router.post('/runs/:id/locations', handle(async (req, res) => reply(res, await fleet.recordLocation(req.fleetActor, req.params.id, req.body))));
router.post('/runs/:id/stops/:stop/confirm', evidence.receive, handle(async (req, res) => reply(res, await fleet.confirmStop(req.fleetActor, req.params.id, req.params.stop, req.body, req.file), 'Pickup evidence/confirmation saved.')));
router.get('/runs/:id/stops/:stop/photo', handle(async (req, res) => {
  operations(req);
  await fleet.accessRun(fleet.reader, req.params.id, req.fleetActor);
  const [stop] = await fleet.query('SELECT photo_key, photo_mime FROM fleet_stops WHERE id = ? AND run_id = ?', [fleet.id(req.params.stop), fleet.id(req.params.id)]);
  const file = stop && evidence.filename(stop.photo_key);
  if (!file) throw fleet.fail('No photo evidence is saved for this stop.', 404);
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  res.type(stop.photo_mime).sendFile(file, (error) => { if (error && !res.headersSent) res.status(404).json({ code: 2, message: 'Evidence file is unavailable.' }); });
}));
router.post('/runs/:id/fuel', handle(async (req, res) => {
  throw fleet.fail('Record vehicle/driver fuel issues and reversals from the Fuel & Cheques register, with issue date and price per litre.');
}));
router.get('/complaints', handle(async (req, res) => reply(res, await fleet.complaints(req.fleetActor))));
router.get('/complaint-customers', handle(async (req, res) => {
  if (!fleet.canManage(req.fleetActor) && req.fleetActor.role !== 'Support') throw fleet.fail('Manager or support access is required.', 403);
  reply(res, await fleet.query('SELECT id, UPPER(full_name) AS name, customer_code FROM customers ORDER BY full_name LIMIT 5000'));
}));
router.post('/complaints', handle(async (req, res) => reply(res, await fleet.saveComplaint(req.fleetActor, req.body), 'Complaint recorded; assigned stops will be flagged.')));
router.post('/complaints/:id/resolve', handle(async (req, res) => reply(res, await fleet.saveComplaint(req.fleetActor, { resolve: true }, req.params.id), 'Complaint resolved. Existing evidence requirements are retained.')));
module.exports = router;
