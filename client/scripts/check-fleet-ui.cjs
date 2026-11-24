// In-memory fleet render checks; no browser GPS, API requests or production build.
const { build } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { StaticRouter } = require('react-router-dom/server');

async function main() {
  const result = await build({
    stdin: { contents: `
      export { default as Driver } from './src/views/Management/Driver/DriverDashboard';
      export { default as Monitoring } from './src/views/Management/Supervisor/DriverMonitoring';
      export { default as Assignments } from './src/views/Management/Admin/DriverAssignment';
      export { default as Fuel } from './src/views/Management/Accountant/RouteFuel';
      export { default as FuelForm } from './src/views/Management/Accountant/FuelIssueForm';
      export { fuelTotalCents } from './src/utils/fuelAmounts';
      export { appMenuGroups } from './src/menu-items/admin';
      export { default as Complaints } from './src/views/Management/Admin/ComplaintsOverview';
      export { default as Form } from './src/views/Management/Fleet/FleetForm';
      export { default as Map } from './src/views/Management/Fleet/FleetMap';
      export { appRoutes } from './src/constants/appRoutes';
      export { allAppPages } from './src/constants/appPages';
    `, resolveDir: process.cwd(), loader: 'jsx' },
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', define: { 'import.meta.env': '{}' },
    alias: Object.fromEntries(['constants', 'services', 'ui-component', 'utils'].map((name) => [name, path.resolve('src', name)]))
  });
  const compiled = new Module(path.resolve('fleet-smoke.cjs'), module);
  compiled.filename = path.resolve('fleet-smoke.cjs'); compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  const ui = compiled.exports;
  let role = 'Admin'; const previous = global.localStorage;
  global.localStorage = { getItem: (key) => key === 'admin_role' ? role : key === 'userMID' ? 'test-user' : null };
  const render = (Component, location = '/', props = {}) => renderToStaticMarkup(React.createElement(StaticRouter, { location }, React.createElement(Component, props)));
  try {
    assert.ok(ui.allAppPages.some((page) => page.path === ui.appRoutes.management.accountant.fuel));
    const assignments = render(ui.Assignments, '/drivers');
    assert.match(assignments, /Route Assignments &amp; Vehicles/);
    assert.match(assignments, /Assign Route/);
    assert.match(assignments, /<table/);
    assert.match(render(ui.Assignments, '/drivers?fleetView=assignment'), /Back to Route Assignments &amp; Vehicles/);
    role = 'Driver';
    const driver = render(ui.Driver, '/driver');
    assert.match(driver, /Driver Dashboard/);
    assert.doesNotMatch(driver, /DRV-001|Start Route<|Placeholder|MuiDataGrid/);
    assert.match(driver, /Locations become stale/);
    role = 'Supervisor';
    assert.match(render(ui.Monitoring, '/monitor'), /Driver &amp; Vehicle Monitoring/);
    role = 'Accountant';
    assert.match(render(ui.Fuel, '/fuel'), /Fuel &amp; Cheques/);
    assert.match(render(ui.Fuel, '/fuel'), /Fuel \/ Route Analysis/);
    assert.match(render(ui.Fuel, '/fuel?view=new'), /Back to Fuel &amp; Cheques/);
    const fuelForm = render(ui.FuelForm, '/fuel', { options: { vehicles: [], drivers: [], runs: [] }, params: new URLSearchParams(), onSave() {}, onCancel() {}, saving: false });
    assert.match(fuelForm, /Fuel Given \(Litres\)/);
    assert.match(fuelForm, /Price per Litre \(GHS\)/);
    assert.match(fuelForm, /Cheque Number/);
    assert.match(fuelForm, /Fuel Issue Date/);
    assert.match(fuelForm, /Calculated Total \(GHS\)/);
    assert.match(fuelForm, /Route Assignment \(Optional\)/);
    assert.equal(ui.fuelTotalCents('50', '15.25'), 76250);
    assert.equal(ui.fuelTotalCents('1', '10.1250'), 1013);
    assert.equal(ui.fuelTotalCents('2.5', '12.3456'), 3086);
    assert.equal(ui.fuelTotalCents('-1', '10'), null);
    const management = ui.appMenuGroups.find((group) => group.id === 'management-portal-group');
    assert.equal(management.children.some((item) => item.id === 'management-supervisor'), false);
    assert.ok(management.children.find((item) => item.id === 'management-driver').children.some((item) => item.id === 'driver-monitoring'));
    const assignmentForm = render(ui.Form, '/drivers', { view: 'assignment', params: new URLSearchParams(), options: { vehicles: [], drivers: [], routes: [], routeStops: [] }, onSave() {}, onCancel() {}, saving: false });
    assert.doesNotMatch(assignmentForm, /Assigned Supervisor/);
    role = 'Admin';
    assert.match(render(ui.Complaints, '/complaints'), /No collection complaints recorded|Loading records/);
    const vehicle = render(ui.Form, '/', { view: 'vehicle', params: new URLSearchParams(), options: { vehicles: [] }, onSave() {}, onCancel() {}, saving: false });
    assert.match(vehicle, /Registration Number/);
    assert.match(vehicle, /Expected Litres per 100 km/);
    const map = render(ui.Map, '/', { run: { route_geojson: { type: 'LineString', coordinates: [[-0.188, 5.6037], [-0.18, 5.6037]] }, stops: [] } });
    assert.match(map, /red = open complaint/);
    assert.match(map, /Proximity never confirms collection/);
    console.log('Fleet UI checks passed: operational/driver/supervisor/accountant pages, inline assignment, vehicles, complaint loading, real-data empty states and map legend. No API/GPS calls.');
  } finally { if (previous === undefined) delete global.localStorage; else global.localStorage = previous; }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
