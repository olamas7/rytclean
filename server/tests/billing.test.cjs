// Real MySQL integration tests in a uniquely named, disposable database.
// No application data or live HTTP server is used. Requires CREATE/DROP DATABASE.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { randomBytes, randomUUID, createHmac } = require('node:crypto');
const mysql = require('mysql2/promise');
const express = require('express');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const env = { ...(fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {}), ...process.env };
const database = `rytclean_billing_test_${process.pid}_${randomBytes(5).toString('hex')}`;
const evidenceDirectory = path.join(env.LOCALAPPDATA || require('node:os').tmpdir(), 'Temp', 'opencode', `fleet_test_${process.pid}_${randomBytes(5).toString('hex')}`);
const secret = 'isolated-billing-test-key-not-for-production';
const clock = { now: '2026-11-03T10:00:00Z' };
let admin;
let pool;
let server;
let origin;
let createdDatabase = false;
let billing;
let databaseModule;
let sms;
let smsMode = 'ok';
const smsRequests = [];
const gatewayRequests = [];
const gatewayTransactions = new Map();
let gatewayMode = 'pending';
let gatewayOverride = {};
let gatewaySecret = 'sk_live_mock_never_real';
const cache = new Map();

class ClockDate extends Date {
  constructor(...args) { super(...(args.length ? args : [clock.now])); }
  static now() { return Date.parse(clock.now); }
  // mysql2 returns native Date instances from outside this VM realm.
  static [Symbol.hasInstance](value) { return value instanceof Date; }
}

async function connection() {
  const con = await pool.getConnection();
  await con.query('SET timestamp = ?', [Math.floor(Date.parse(clock.now) / 1000)]);
  return con;
}

const isolatedPool = {
  async query(sql, params) { const con = await connection(); try { return await con.query(sql, params); } finally { con.release(); } },
  getConnection: connection
};

// Load the production implementation with only DB, JWT secret and clock isolated.
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const nativeRequire = createRequire(filename);
  const isolatedRequire = (name) => {
    if (name === 'axios') return { request: async (request) => {
      if (request.url?.startsWith('https://api.paystack.co/')) {
        gatewayRequests.push(request);
        assert.equal(request.headers.Authorization, `Bearer ${gatewaySecret}`);
        if (gatewayMode === 'timeout') throw new Error('mock gateway timeout');
        if (request.url.endsWith('/charge')) {
          gatewayTransactions.set(request.data.reference, { ...request.data, domain: gatewaySecret.startsWith('sk_live_') ? 'live' : 'test', paid_at: clock.now });
          return { status: 200, data: { status: true, data: { reference: request.data.reference, status: gatewayMode } } };
        }
        if (request.url.endsWith('/charge/submit_otp')) return { status: 200, data: { status: true, data: { reference: request.data.reference, status: 'pending' } } };
        const reference = request.url.split('/').at(-1);
        return { status: 200, data: { status: true, data: { ...gatewayTransactions.get(reference), status: gatewayMode === 'send_otp' ? 'pending' : gatewayMode, ...gatewayOverride } } };
      }
      smsRequests.push(request);
      if (smsMode === 'timeout') throw new Error('mock timeout');
      return { status: smsMode === 'reject' ? 403 : 200, data: { mock: true } };
    } };
    if (name === 'mysql2/promise' && filename === path.join(root, 'db.js')) return { createPool: () => isolatedPool };
    const resolved = nativeRequire.resolve(name);
    const local = ['db.js', 'services/customerPayments.js', 'Routes/customerPayments.js', 'services/fuelRegister.js', 'services/fleetOperations.js', 'services/fleetGeometry.js', 'utils/pickupEvidence.js', 'Routes/fleet.js', 'services/billingAccounts.js', 'services/planPricing.js', 'services/smsNotifications.js', 'services/smsCampaigns.js', 'services/smsTemplates.js', 'Routes/smsNotifications.js', 'Routes/smsSettings.js', 'Routes/adminSetup.js', 'Routes/clientCategories.js', 'Routes/billing.js', 'Routes/customers.js', 'Routes/plans.js', 'Routes/billingSettings.js', 'middleware/verifyJWT.js'].map((file) => path.join(root, file));
    return local.includes(resolved) ? load(path.relative(root, resolved)) : nativeRequire(name);
  };
  let source = fs.readFileSync(filename, 'utf8');
  if (filename === path.join(root, 'services/billingAccounts.js')) source += '\nmodule.exports.__testing = { billCustomer };';
  const context = vm.createContext({
    require: isolatedRequire, module, exports: module.exports, Buffer, Date: ClockDate, __dirname: path.dirname(filename), __filename: filename,
    process: { env: { ...env, get PAYSTACK_SECRET_KEY() { return gatewaySecret; }, NODE_ENV: 'test', FLEET_TEST_EVIDENCE_DIR: evidenceDirectory, DB_DATABASE: database, JWT_SECRET: secret, SMS_API_HOST: 'api.smsonlinegh.com', SMS_API_KEY: 'mock-key-never-real', SMS_SENDER_ID: 'RytClean', SMS_API_PROTOCOL: 'https' } },
    console: { ...console, error: () => {} }, setInterval, clearInterval
  });
  new vm.Script(source, { filename }).runInContext(context);
  return module.exports;
}

async function rows(sql, params = []) { return (await isolatedPool.query(sql, params))[0]; }
const count = async (table) => Number((await rows(`SELECT COUNT(*) AS total FROM ${table}`))[0].total);
const advance = (value) => { clock.now = `${value}T10:00:00Z`; };

async function plan(code, amount, cycle = 'monthly') {
  const result = await rows('INSERT INTO plans (plan_code, name, billing_cycle, amount, pickup_frequency, grace_days, status) VALUES (?, ?, ?, ?, 1, 5, ?)', [code, `${code} Plan`, cycle, amount, 'active']);
  await rows('INSERT INTO plan_prices (plan_id, amount, effective_from) VALUES (?, ?, ?)', [result.insertId, amount, '2026-11-01']);
  return result.insertId;
}

async function customer({ code = '12345', joined = '2026-11-03', planCode = 'HOME', status = 'active', enrol = true } = {}) {
  return databaseModule.withTransaction(async (con) => {
    const [result] = await con.query(`INSERT INTO customers (customer_code, full_name, phone, email, zone_code, plan_code, category_id, joined_date, latitude, longitude, status)
      VALUES (?, 'AMA BOATENG', '0241234567', '', 'ZONE1', ?, 2, ?, 5.6037, -0.187, ?)`, [code, planCode, joined, status]);
    const [data] = await con.query('SELECT * FROM customers WHERE id = ?', [result.insertId]);
    if (enrol) await billing.enrolCustomer(con, data[0], 1);
    return data[0];
  });
}

async function http(url, { method = 'GET', body, role = 'Admin', userId = 1, authenticated = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated) headers['x-access-token'] = jwt.sign({ user_id: userId, role }, secret, { expiresIn: '1h' });
  const response = await fetch(`${origin}${url}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}

const account = async (code = '12345') => {
  const result = await http(`/billing/customers/${code}/account`);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.data;
};
const payment = (amount, overrides = {}) => ({ type: 'payment', amount, date: clock.now.slice(0, 10), method: 'cash', reference: '', note: 'Payment received', requestKey: randomUUID(), ...overrides });
const editBody = (planCode = 'HOME') => ({ fullName: 'AMA BOATENG', phone: '0241234567', email: '', zoneId: 'ZONE1', planId: planCode, categoryId: 2, joinedDate: '2026-11-03', latitude: 5.6037, longitude: -0.187, status: 'active' });

before(async () => {
  assert.match(database, /^rytclean_billing_test_\d+_[a-f0-9]+$/);
  admin = await mysql.createConnection({ host: env.DB_HOST, user: env.DB_USER, password: env.DB_PASSWORD, timezone: 'Z' });
  await admin.query(`CREATE DATABASE \`${database}\``);
  createdDatabase = true;
  pool = mysql.createPool({ host: env.DB_HOST, user: env.DB_USER, password: env.DB_PASSWORD, database, timezone: 'Z', multipleStatements: true, connectionLimit: 4 });
  await rows(`CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, fullname VARCHAR(150), username VARCHAR(80), password VARCHAR(255) DEFAULT '', role VARCHAR(80), status INT NOT NULL DEFAULT 1, work_title VARCHAR(80) NOT NULL DEFAULT 'admin', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE activity_logs (id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id INT NULL, action VARCHAR(120), details TEXT, ip_address VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE zones (id INT AUTO_INCREMENT PRIMARY KEY, zone_code VARCHAR(40) UNIQUE, name VARCHAR(150), city VARCHAR(120), coverage_area VARCHAR(255), boundary_geojson JSON, center_lat DECIMAL(10,7), center_lng DECIMAL(10,7), status VARCHAR(20));
    CREATE TABLE drivers (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT UNIQUE, driver_code VARCHAR(40) UNIQUE, full_name VARCHAR(150), phone VARCHAR(40), vehicle_number VARCHAR(40), zone_id INT, status VARCHAR(20));
    CREATE TABLE collection_routes (id INT AUTO_INCREMENT PRIMARY KEY, route_code VARCHAR(40) UNIQUE, route_name VARCHAR(150), zone_id INT, start_point VARCHAR(150), end_point VARCHAR(150), estimated_duration_mins INT, status VARCHAR(20), notes TEXT, route_geojson JSON, start_lat DECIMAL(10,7), start_lng DECIMAL(10,7), end_lat DECIMAL(10,7), end_lng DECIMAL(10,7));
    CREATE TABLE plans (id INT AUTO_INCREMENT PRIMARY KEY, plan_code VARCHAR(60) UNIQUE NOT NULL, name VARCHAR(150) NOT NULL, billing_cycle ENUM('monthly','quarterly','yearly') NOT NULL, amount DECIMAL(10,2), pickup_frequency INT, grace_days INT, status VARCHAR(20), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    CREATE TABLE customers (id INT AUTO_INCREMENT PRIMARY KEY, customer_code VARCHAR(40) NOT NULL UNIQUE, full_name VARCHAR(150), phone VARCHAR(40), email VARCHAR(150), address VARCHAR(255), zone_code VARCHAR(40), plan_code VARCHAR(60), latitude DECIMAL(10,7), longitude DECIMAL(10,7), location_address VARCHAR(255), status VARCHAR(20), next_pickup_date DATE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);`);
  const con = await connection();
  try {
    for (const file of ['customerDetails', 'customerHousePhoto', 'subscriptionPricing', 'billingAccounts', 'smsNotifications', 'smsCampaigns', 'fleetOperations', 'fuelRegister', 'customerPayments']) await require(`../migrations/${file}`)(con);
  } finally { con.release(); }
  databaseModule = load('db.js');
  billing = load('services/billingAccounts.js');
  sms = load('services/smsNotifications.js');
  const app = express();
  app.post('/customer-payments/webhook', express.raw({ type: 'application/json' }), load('Routes/customerPayments.js').webhook);
  app.use(express.json());
  const verify = load('middleware/verifyJWT.js');
  app.use('/billing', verify, load('Routes/billing.js'));
  app.use('/admin', load('Routes/adminSetup.js'));
  app.use('/sms', verify, load('Routes/smsNotifications.js'));
  app.use('/fleet', verify, load('Routes/fleet.js'));
  app.use('/customer-payments', load('Routes/customerPayments.js'));
  server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  origin = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  advance('2026-11-03');
  smsRequests.length = 0;
  smsMode = 'ok';
  gatewayRequests.length = 0; gatewayTransactions.clear(); gatewayMode = 'pending'; gatewayOverride = {}; gatewaySecret = 'sk_live_mock_never_real';
  const con = await connection();
  try {
    await con.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of ['gateway_payments', 'payment_sessions', 'fleet_fuel', 'fleet_locations', 'fleet_stops', 'fleet_runs', 'fleet_route_stops', 'fleet_complaints', 'fleet_vehicles', 'drivers', 'collection_routes', 'sms_campaigns', 'sms_outbox', 'account_ledger', 'billing_invoices', 'billing_subscriptions', 'customer_plan_history', 'plan_prices', 'customers', 'plans', 'activity_logs', 'users', 'zones']) await con.query(`TRUNCATE TABLE ${table}`);
  } finally { await con.query('SET FOREIGN_KEY_CHECKS = 1'); con.release(); }
  await rows("UPDATE billing_settings SET first_month_policy = 'full_month', automatic_billing = 0 WHERE id = 1");
  await rows("UPDATE sms_settings SET enabled = 0, sender = '' WHERE id = 1");
  for (const [key, event] of Object.entries(require('../services/smsTemplates').events)) await rows('UPDATE sms_events SET enabled = 0, message = ? WHERE event_key = ?', [event.message, key]);
  await rows("INSERT INTO users (id, fullname, username, role) VALUES (1, 'Test Admin', 'test-admin', 'Admin')");
  await rows("INSERT INTO zones (zone_code, name, status) VALUES ('ZONE1', 'Test Zone', 'active')");
  await plan('HOME', '120.00');
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
  // Only remove the exact scratch database successfully created by this test run.
  if (admin && createdDatabase && /^rytclean_billing_test_\d+_[a-f0-9]+$/.test(database)) await admin.query(`DROP DATABASE \`${database}\``);
  if (admin) await admin.end();
  assert.match(path.basename(evidenceDirectory), /^fleet_test_\d+_[a-f0-9]+$/);
  fs.rmSync(evidenceDirectory, { recursive: true, force: true });
});

test('money uses exact pesewas and rejects invalid precision / negative amounts', () => {
  assert.equal(billing.moneyCents('0'), 0);
  assert.equal(billing.moneyCents('0.01'), 1);
  assert.equal(billing.moneyCents('120.50'), 12050);
  assert.equal(billing.moneyCents('99999999.99'), 9999999999);
  for (const value of ['', '-1', '1.001', 'Infinity', '1e3', true]) assert.throws(() => billing.moneyCents(value));
});

test('date helpers handle leap years and calendar-month boundaries', () => {
  assert.equal(billing.validDate('2028-02-29'), true);
  assert.equal(billing.validDate('2026-02-29'), false);
  assert.equal(billing.nextMonth('2026-12-31'), '2027-01-01');
  assert.equal(billing.nextMonth('2028-02-29'), '2028-03-01');
  assert.equal(billing.dateText(new Date('2026-11-03T00:00:00Z')), '2026-11-03');
});

test('new monthly customer is enrolled with a snapshot, without an immediate bill', async () => {
  await customer();
  const data = await account();
  assert.equal(data.subscription.status, 'active');
  assert.equal(data.subscription.cycleAmountCents, 12000);
  assert.equal(data.subscription.billEligibleFrom, '2026-12-01');
  assert.equal(data.statement.length, 0);
  assert.equal((await billing.runBilling(1)).created, 0);
});

test('advance payments, idempotent retry, overpayment and credit carry-forward', async () => {
  await customer();
  const first = payment('100');
  await billing.postEntry('12345', first, 1);
  assert.equal((await billing.postEntry('12345', first, 1)).repeated, true);
  await billing.postEntry('12345', payment('70'), 1);
  assert.equal((await account()).summary.balanceCents, -17000);
  advance('2026-12-01');
  assert.equal((await billing.runBilling(1)).created, 1);
  let data = await account();
  assert.equal(data.summary.creditCents, 5000);
  assert.equal(data.summary.totalPaidCents, 17000);
  assert.equal(data.invoices[0].settledCents, 12000);
  assert.equal(data.invoices[0].status, 'paid');
  advance('2027-01-01');
  assert.equal((await billing.runBilling(1)).created, 1);
  data = await account();
  assert.equal(data.summary.owingCents, 7000);
  assert.equal(data.invoices[0].settledCents, 5000);
  assert.equal(data.invoices[0].outstandingCents, 7000);
});

test('first-month proration includes the service start day and snapshots policy', async () => {
  advance('2026-11-16');
  await rows("UPDATE billing_settings SET first_month_policy = 'prorated'");
  await customer({ joined: '2026-11-16' });
  await rows("UPDATE billing_settings SET first_month_policy = 'full_month'");
  advance('2026-12-01');
  await billing.runBilling(1);
  const data = await account();
  assert.equal(data.invoices[0].amountCents, 6000);
  assert.equal(data.invoices[0].service_days, 15);
  assert.equal(data.invoices[0].month_days, 30);
  assert.equal(data.invoices[0].first_month_policy, 'prorated');
});

test('plan price update affects the next cycle, never the in-progress cycle', async () => {
  await customer();
  advance('2026-11-15');
  const response = await http('/admin/plans/1', { method: 'PATCH', body: { planCode: 'HOME', name: 'HOME Plan', billingCycle: 'monthly', amount: '200', pickupFrequency: 1, graceDays: 5, status: 'active' } });
  assert.equal(response.body.code, 1, JSON.stringify(response.body));
  const plans = (await http('/admin/plans')).body.data;
  assert.equal(Number(plans[0].amount), 120);
  assert.equal(Number(plans[0].nextAmount), 200);
  advance('2026-12-01');
  await billing.runBilling(1);
  assert.equal((await account()).invoices[0].amountCents, 12000);
  assert.equal((await account()).subscription.cycleAmountCents, 20000);
  advance('2027-01-01');
  await billing.runBilling(1);
  assert.equal((await account()).invoices[0].amountCents, 20000);
});

test('customer plan change is scheduled; current and next cycle use the correct plans', async () => {
  await plan('BUSINESS', '200');
  await customer();
  const response = await http('/admin/customers/12345', { method: 'PATCH', body: editBody('BUSINESS') });
  assert.equal(response.body.code, 1, JSON.stringify(response.body));
  assert.equal(response.body.data.planEffectiveDate, '2026-12-01');
  const customers = (await http('/admin/customers')).body.data;
  assert.equal(customers[0].planId, 'HOME');
  assert.equal(customers[0].pendingPlanId, 'BUSINESS');
  advance('2026-12-01');
  await billing.runBilling(1);
  let data = await account();
  assert.equal(data.invoices[0].plan_code, 'HOME');
  assert.equal(data.invoices[0].amountCents, 12000);
  assert.equal(data.customer.planId, 'BUSINESS');
  advance('2027-01-01');
  await billing.runBilling(1);
  data = await account();
  assert.equal(data.invoices[0].plan_code, 'BUSINESS');
  assert.equal(data.invoices[0].amountCents, 20000);
});

test('choosing current plan cancels its pending switch', async () => {
  await plan('BUSINESS', '200'); await customer();
  await http('/admin/customers/12345', { method: 'PATCH', body: editBody('BUSINESS') });
  const cancelled = await http('/admin/customers/12345', { method: 'PATCH', body: editBody('HOME') });
  assert.equal(cancelled.body.code, 1);
  assert.equal((await account()).pendingPlan, null);
});

test('payment reversal restores amount owing and excludes reversed money from total paid', async () => {
  await customer(); advance('2026-12-01'); await billing.runBilling(1);
  const paid = await billing.postEntry('12345', payment('150', { method: 'mobile_money', reference: 'MM-TEST-1' }), 1);
  assert.equal((await account()).summary.balanceCents, -3000);
  await billing.postEntry('12345', { type: 'reversal', entryId: paid.id, date: '2026-12-01', note: 'Payment recorded against wrong client', requestKey: randomUUID() }, 1);
  const data = await account();
  assert.equal(data.summary.owingCents, 12000);
  assert.equal(data.summary.totalPaidCents, 0);
  assert.equal(data.invoices[0].outstandingCents, 12000);
});

test('voided invoice remains in history and cannot be regenerated by retrying billing', async () => {
  await customer(); advance('2026-12-01'); await billing.runBilling(1);
  const entry = (await account()).statement[0];
  await billing.postEntry('12345', { type: 'reversal', entryId: entry.id, date: '2026-12-01', note: 'Service not provided', requestKey: randomUUID() }, 1);
  assert.equal((await account()).invoices[0].status, 'voided');
  assert.equal((await account()).summary.balanceCents, 0);
  assert.equal((await billing.runBilling(1)).created, 0);
  assert.equal(await count('billing_invoices'), 1);
});

test('unlinked roles and missing JWT cannot access financial accounts', async () => {
  await customer();
  assert.equal((await http('/billing/accounts', { authenticated: false })).status, 401);
  assert.equal((await http('/billing/accounts', { role: 'Driver' })).status, 403);
  assert.equal((await http('/billing/accounts', { role: 'Accountant' })).status, 200);
  assert.equal((await http('/admin/customers/12345', { role: 'Driver', method: 'PATCH', body: editBody() })).body.code, 1);
  await plan('BUSINESS', '200');
  assert.equal((await http('/admin/customers/12345', { role: 'Driver', method: 'PATCH', body: editBody('BUSINESS') })).status, 403);
});

test('legacy accounts require activation; migration does not generate arrears', async () => {
  await customer({ joined: '2026-04-01', enrol: false });
  const con = await connection(); try { await require('../migrations/billingAccounts')(con); } finally { con.release(); }
  assert.equal((await account()).subscription.status, 'needs_review');
  assert.equal((await billing.runBilling(1)).created, 0);
  assert.equal(await count('account_ledger'), 0);
  const activated = await http('/billing/customers/12345/activate', { method: 'POST', body: { serviceStart: '2026-11-03' } });
  assert.equal(activated.body.code, 1, JSON.stringify(activated.body));
  assert.equal(await count('billing_invoices'), 0);
});

test('quarterly plan is held and cannot create an accidental monthly invoice', async () => {
  await plan('QUARTER', '300', 'quarterly');
  await customer({ planCode: 'QUARTER' });
  assert.equal((await account()).subscription.status, 'needs_review');
  const result = await http('/billing/customers/12345/activate', { method: 'POST', body: { serviceStart: '2026-11-03' } });
  assert.equal(result.status, 400);
  assert.equal(await count('billing_invoices'), 0);
});

test('unsupported next plan does not roll back the completed valid monthly bill', async () => {
  await plan('QUARTER', '300', 'quarterly'); await customer();
  await http('/admin/customers/12345', { method: 'PATCH', body: editBody('QUARTER') });
  advance('2026-12-01');
  const result = await billing.runBilling(1);
  assert.equal(result.created, 1);
  assert.equal(result.skipped.length, 1);
  const data = await account();
  assert.equal(data.subscription.status, 'needs_review');
  assert.equal(data.invoices[0].amountCents, 12000);
});

test('idempotency mismatch and duplicate non-cash references are rejected', async () => {
  await customer();
  const entry = payment('50', { method: 'bank_transfer', reference: 'BANK-TEST-1' });
  await billing.postEntry('12345', entry, 1);
  await assert.rejects(() => billing.postEntry('12345', { ...entry, amount: '51' }, 1), /different details/);
  await assert.rejects(() => billing.postEntry('12345', { ...entry, requestKey: randomUUID() }, 1), /already been recorded/);
  await assert.rejects(() => billing.postEntry('12345', payment('10', { method: 'mobile_money' }), 1), /reference is required/);
  assert.equal(await count('account_ledger'), 1);
});

test('automatic billing stays off until explicitly enabled', async () => {
  await customer(); advance('2026-12-01');
  assert.equal((await billing.runBilling(null, null, true)).created, 0);
  assert.equal(await count('billing_invoices'), 0);
  const settings = await http('/admin/billing-settings', { method: 'PATCH', body: { firstMonthPolicy: 'full_month', automaticBilling: true } });
  assert.equal(settings.body.code, 1);
  assert.equal((await billing.runBilling(null, null, true)).created, 1);
  assert.equal((await billing.runBilling(null, null, true)).created, 0);
});

test('concurrent workers create exactly one invoice and one invoice ledger entry', async () => {
  await customer(); advance('2026-12-01');
  const results = await Promise.all([billing.__testing.billCustomer('12345', 1), billing.__testing.billCustomer('12345', 1)]);
  assert.equal(results.reduce((sum, result) => sum + result.created, 0), 1);
  assert.equal(await count('billing_invoices'), 1);
  assert.equal(await count('account_ledger'), 1);
});

test('concurrent payment retries post only one payment', async () => {
  await customer();
  const entry = payment('50');
  const results = await Promise.all([billing.postEntry('12345', entry, 1), billing.postEntry('12345', entry, 1)]);
  assert.equal(results.filter((result) => result.repeated).length, 1);
  assert.equal(await count('account_ledger'), 1);
  assert.equal((await account()).summary.creditCents, 5000);
});

test('discount credits settle oldest invoice without inflating total paid', async () => {
  await customer(); advance('2027-01-01'); await billing.runBilling(1);
  await billing.postEntry('12345', { type: 'credit_adjustment', amount: '50', date: '2027-01-01', note: 'Service discount', requestKey: randomUUID() }, 1);
  const data = await account();
  assert.equal(data.summary.totalPaidCents, 0);
  assert.equal(data.summary.owingCents, 19000);
  assert.equal(data.invoices.find((invoice) => invoice.periodStart === '2026-11-01').settledCents, 5000);
  assert.equal(data.invoices.find((invoice) => invoice.periodStart === '2026-12-01').settledCents, 0);
});

test('failed enrollment rolls back the new customer and subscription', async () => {
  await rows('DELETE FROM plan_prices');
  await assert.rejects(() => customer(), /No recorded plan price/);
  assert.equal(await count('customers'), 0);
  assert.equal(await count('billing_subscriptions'), 0);
});

test('inactive future customer is not billed for a cycle that never started', async () => {
  await customer({ joined: '2026-12-15' });
  await rows("UPDATE customers SET status = 'inactive'");
  advance('2026-12-15'); await billing.runBilling(1);
  assert.equal((await account()).subscription.status, 'paused');
  advance('2027-01-01'); await billing.runBilling(1);
  assert.equal(await count('billing_invoices'), 0);
});

async function enableSms(...keys) {
  await rows("UPDATE sms_settings SET enabled = 1, sender = 'RytClean'");
  for (const key of keys) await rows('UPDATE sms_events SET enabled = 1 WHERE event_key = ?', [key]);
}

test('SMS configuration defaults off, is admin-only and never returns credentials', async () => {
  const response = await http('/admin/sms/settings');
  assert.equal(response.body.data.enabled, false);
  assert.equal(response.body.data.events.length, 6);
  assert.equal(response.body.data.events.some((event) => event.enabled), false);
  assert.equal(JSON.stringify(response.body).includes('mock-key-never-real'), false);
  assert.equal((await http('/admin/sms/settings', { role: 'Accountant' })).status, 403);
  assert.equal((await http('/admin/sms/logs', { role: 'Driver' })).status, 403);
  assert.equal((await http('/admin/sms/test', { role: 'Driver', method: 'POST', body: {} })).status, 403);
  assert.equal((await http('/admin/sms/settings', { authenticated: false })).status, 401);
});

test('SMS host and sender come only from environment, ignoring legacy settings and UI overrides', async () => {
  await rows("UPDATE sms_settings SET sender = 'OLD-SENDER'");
  const settings = (await http('/admin/sms/settings')).body.data;
  assert.equal(settings.sender, 'RytClean');
  assert.equal(settings.host, 'api.smsonlinegh.com');
  const response = await http('/admin/sms/settings', { method: 'PATCH', body: { ...settings, sender: 'UI-OVERRIDE', host: 'other.example.com' } });
  assert.equal(response.body.code, 1);
  assert.equal(response.body.data.sender, 'RytClean');
  assert.equal(response.body.data.host, 'api.smsonlinegh.com');
  assert.equal((await rows('SELECT sender FROM sms_settings'))[0].sender, 'OLD-SENDER');
  const defaults = sms.providerConfiguration({ SMS_API_HOST: '', SMS_SENDER_ID: ' EnvSender ', SMS_API_KEY: 'hidden' });
  assert.equal(defaults.host, 'api.smsonlinegh.com');
  assert.equal(defaults.sender, 'EnvSender');
  assert.equal(JSON.stringify(defaults).includes('hidden'), false);
  assert.equal(sms.providerConfiguration({ SMS_API_HOST: 'gateway.example.com' }).host, 'gateway.example.com');
  for (const host of ['http://api.smsonlinegh.com', 'user:password@host.example', 'host.example/path', 'host.example:80']) assert.throws(() => sms.providerConfiguration({ SMS_API_HOST: host }));
});

test('SMS templates and settings validate and persist with an audit record', async () => {
  const settings = (await http('/admin/sms/settings')).body.data;
  settings.enabled = true;
  settings.sender = 'RytClean';
  settings.events[0].enabled = true;
  assert.equal((await http('/admin/sms/settings', { method: 'PATCH', body: settings })).body.code, 1);
  assert.equal((await sms.configuration()).enabled, true);
  assert.equal((await rows("SELECT id FROM activity_logs WHERE action = 'UPDATE_SMS_SETTINGS'")).length, 1);
  settings.events[0].message = 'Hello {password}';
  assert.equal((await http('/admin/sms/settings', { method: 'PATCH', body: settings })).status, 400);
  settings.events[0].message = 'Hello {name}';
  settings.events[0].enabled = 'yes';
  assert.equal((await http('/admin/sms/settings', { method: 'PATCH', body: settings })).status, 400);
});

test('SMS phone normalisation preserves Ghana leading-zero identity and rejects invalid input', () => {
  const { phone, render, validateTemplate } = require('../services/smsTemplates');
  assert.equal(phone('0241234567'), '233241234567');
  for (const value of ['241234567', '+233241234567', '024 1234567', '02412345678']) assert.throws(() => phone(value));
  assert.equal(render('Hello {name}, {amount}', { name: 'AMA', amount: '10.00' }), 'Hello AMA, 10.00');
  assert.throws(() => validateTemplate('Unknown {bad}'));
});

test('payments queue once after commit, use the receipt ID and submit only once across workers', async () => {
  await enableSms('payment');
  await customer();
  const entry = payment('50');
  const result = await billing.postEntry('12345', entry, 1);
  await billing.postEntry('12345', entry, 1);
  assert.equal(await count('sms_outbox'), 1);
  assert.equal(smsRequests.length, 0);
  const [row] = await rows('SELECT * FROM sms_outbox');
  assert.match(row.message, /GHS 50.00/);
  assert.match(row.message, new RegExp(`RCPT-${result.id}`));
  await Promise.all([sms.processQueue(), sms.processQueue()]);
  assert.equal(smsRequests.length, 1);
  assert.equal(smsRequests[0].url, 'https://api.smsonlinegh.com/v5/message/sms/send');
  assert.equal(smsRequests[0].data.destinations[0], '233241234567');
  assert.equal(smsRequests[0].headers.Authorization, 'key mock-key-never-real');
  assert.equal((await rows('SELECT status FROM sms_outbox'))[0].status, 'submitted_unverified');
});

test('disabled SMS does not queue historical payments when later enabled', async () => {
  await customer();
  await billing.postEntry('12345', payment('50'), 1);
  await enableSms('payment');
  await sms.processQueue();
  assert.equal(await count('sms_outbox'), 0);
  assert.equal(smsRequests.length, 0);
});

test('notification queue failure does not roll back a valid payment', async () => {
  await enableSms('payment'); await customer();
  await rows('RENAME TABLE sms_events TO sms_events_unavailable');
  try {
    await billing.postEntry('12345', payment('10'), 1);
    assert.equal(await count('account_ledger'), 1);
    assert.equal((await account()).summary.totalPaidCents, 1000);
  } finally { await rows('RENAME TABLE sms_events_unavailable TO sms_events'); }
});

test('rolled-back transactions cannot leave a registration SMS queued', async () => {
  await enableSms('registration');
  const client = await customer();
  await assert.rejects(() => databaseModule.withTransaction(async (connection) => {
    await sms.enqueue(connection, 'registration', client, 'rollback-test');
    throw new Error('rollback deliberately');
  }));
  assert.equal(await count('sms_outbox'), 0);
});

test('customer registration and scheduled-plan change queue personalised messages', async () => {
  await enableSms('registration', 'plan_change');
  const created = await http('/admin/customers', { method: 'POST', body: { ...editBody(), fullName: 'ama boateng' } });
  assert.equal(created.body.code, 1, JSON.stringify(created.body));
  const [registered] = await rows("SELECT * FROM sms_outbox WHERE event_key = 'registration'");
  assert.match(registered.message, /AMA BOATENG/);
  await plan('BUSINESS', '200');
  await http(`/admin/customers/${created.body.data.id}`, { method: 'PATCH', body: editBody('BUSINESS') });
  const [scheduled] = await rows("SELECT * FROM sms_outbox WHERE event_key = 'plan_change'");
  assert.match(scheduled.message, /BUSINESS Plan/);
  assert.match(scheduled.message, /2026-12-01/);
});

test('bill notifications are unique, and reminders recheck outstanding balances', async () => {
  await enableSms('bill', 'due', 'overdue'); await customer();
  advance('2026-12-01'); await billing.runBilling(1); await billing.runBilling(1);
  assert.equal((await rows("SELECT id FROM sms_outbox WHERE event_key = 'bill'")).length, 1);
  await sms.processQueue();
  assert.equal(smsRequests.length, 1);
  advance('2026-12-06');
  await billing.postEntry('12345', payment('20'), 1);
  await sms.processQueue(); await sms.processQueue();
  assert.equal(smsRequests.length, 2);
  const [due] = await rows("SELECT * FROM sms_outbox WHERE event_key = 'due'");
  assert.match(due.message, /100.00/);
  advance('2026-12-13');
  await billing.postEntry('12345', payment('100'), 1);
  await sms.processQueue();
  assert.equal(smsRequests.length, 2);
  assert.equal((await rows("SELECT id FROM sms_outbox WHERE event_key = 'overdue'")).length, 0);
});

test('overdue reminders send only once for each outstanding invoice', async () => {
  await enableSms('overdue'); await customer();
  advance('2026-12-01'); await billing.runBilling(1);
  advance('2026-12-13'); await sms.processQueue();
  advance('2026-12-14'); await sms.processQueue();
  assert.equal(smsRequests.length, 1);
  assert.equal((await rows("SELECT id FROM sms_outbox WHERE event_key = 'overdue'")).length, 1);
});

test('provider rejections/timeouts never retry or undo payments; HTTP 200 does not claim delivery', async () => {
  await enableSms('payment'); await customer();
  await billing.postEntry('12345', payment('10'), 1);
  smsMode = 'reject'; await sms.processQueue();
  assert.equal((await rows('SELECT status FROM sms_outbox ORDER BY id'))[0].status, 'failed');
  await billing.postEntry('12345', payment('20'), 1);
  smsMode = 'timeout'; await sms.processQueue(); await sms.processQueue();
  assert.equal((await rows('SELECT status FROM sms_outbox ORDER BY id'))[1].status, 'unknown');
  assert.equal(smsRequests.length, 2);
  assert.equal((await account()).summary.totalPaidCents, 3000);
});

test('switching an event off cancels queued notifications before dispatch', async () => {
  await enableSms('payment'); await customer();
  await billing.postEntry('12345', payment('10'), 1);
  await rows("UPDATE sms_events SET enabled = 0 WHERE event_key = 'payment'");
  await sms.processQueue();
  assert.equal(smsRequests.length, 0);
  assert.equal((await rows('SELECT status FROM sms_outbox'))[0].status, 'cancelled');
});

test('deliberate test SMS works with automation off, is idempotent and validates phones', async () => {
  const body = { phone: '0241234567', message: 'Mock test', requestKey: randomUUID() };
  const response = await http('/admin/sms/test', { method: 'POST', body });
  assert.equal(response.body.code, 1, JSON.stringify(response.body));
  await http('/admin/sms/test', { method: 'POST', body });
  assert.equal(smsRequests.length, 1);
  assert.equal((await http('/admin/sms/test', { method: 'POST', body: { ...body, phone: '123' } })).status, 400);
  assert.equal(JSON.stringify((await http('/admin/sms/logs')).body).includes('mock-key-never-real'), false);
});

test('voided bills and reversed payments are cancelled before sending', async () => {
  await enableSms('payment', 'bill'); await customer();
  const paid = await billing.postEntry('12345', payment('10'), 1);
  await billing.postEntry('12345', { type: 'reversal', entryId: paid.id, date: '2026-11-03', note: 'Incorrect receipt', requestKey: randomUUID() }, 1);
  advance('2026-12-01'); await billing.runBilling(1);
  const [invoice] = await rows("SELECT id FROM account_ledger WHERE entry_type = 'invoice'");
  await billing.postEntry('12345', { type: 'reversal', entryId: invoice.id, date: '2026-12-01', note: 'Incorrect service charge', requestKey: randomUUID() }, 1);
  await sms.processQueue();
  assert.equal(smsRequests.length, 0);
  assert.equal((await rows("SELECT id FROM sms_outbox WHERE status = 'cancelled'")).length, 2);
});

test('cancelled plan changes do not send a stale queued notification', async () => {
  await enableSms('plan_change'); await customer(); await plan('BUSINESS', '200');
  await http('/admin/customers/12345', { method: 'PATCH', body: editBody('BUSINESS') });
  await http('/admin/customers/12345', { method: 'PATCH', body: editBody('HOME') });
  await sms.processQueue();
  assert.equal(smsRequests.length, 0);
  assert.equal((await rows('SELECT status FROM sms_outbox'))[0].status, 'cancelled');
});

test('queued reminders are cancelled if a bill is settled before dispatch', async () => {
  await enableSms('due'); const client = await customer();
  advance('2026-12-01'); await billing.runBilling(1);
  const [invoice] = await rows('SELECT * FROM billing_invoices');
  advance('2026-12-06');
  await databaseModule.withTransaction((connection) => sms.enqueue(connection, 'due', client, `reminder:${invoice.id}:due`, { amount: '120.00', reference: invoice.reference, dueDate: '2026-12-06' }, invoice.id));
  await billing.postEntry('12345', payment('120'), 1);
  await sms.processQueue();
  assert.equal(smsRequests.length, 0);
  assert.equal((await rows('SELECT status FROM sms_outbox'))[0].status, 'cancelled');
});

test('test sends are rate limited and event-specific unavailable placeholders are rejected', async () => {
  for (let index = 0; index < 5; index += 1) {
    assert.equal((await http('/admin/sms/test', { method: 'POST', body: { phone: '0241234567', message: `Test ${index}`, requestKey: randomUUID() } })).body.code, 1);
  }
  assert.equal((await http('/admin/sms/test', { method: 'POST', body: { phone: '0241234567', message: 'Sixth test', requestKey: randomUUID() } })).status, 429);
  assert.equal(smsRequests.length, 5);
  const settings = (await http('/admin/sms/settings')).body.data;
  settings.events.find((event) => event.key === 'registration').message = 'Your payment {amount}';
  assert.equal((await http('/admin/sms/settings', { method: 'PATCH', body: settings })).status, 400);
});

const campaignInput = (patch = {}) => ({ title: 'Service update', message: 'Hello {name}, your customer ID is {customerId}. Collection resumes tomorrow.', filters: { status: 'active' }, ...patch });
async function campaignPreview(input = campaignInput()) {
  const response = await http('/sms/campaigns/preview', { method: 'POST', role: 'Manager', body: input });
  assert.equal(response.body.code, 1, JSON.stringify(response.body));
  return response.body.data;
}
const queuePreview = (preview, patch = {}, options = {}) => http(`/sms/campaigns/${preview.id}/send`, { method: 'POST', role: 'Manager', body: { confirmed: true, recipientIds: preview.recipients.map((row) => row.id), ...patch }, ...options });

test('SMS workspace is manager/admin-only, while configuration remains administrator-only', async () => {
  assert.equal((await http('/sms/options', { role: 'Manager' })).body.code, 1);
  assert.equal((await http('/sms/history', { role: 'Manager' })).status, 200);
  assert.equal((await http('/admin/sms/settings', { role: 'Manager' })).status, 403);
  for (const role of ['Customer', 'Driver', 'Accountant', 'Support']) {
    assert.equal((await http('/sms/options', { role })).status, 403);
    assert.equal((await http('/sms/history', { role })).status, 403);
    assert.equal((await http('/sms/campaigns/preview', { method: 'POST', role, body: campaignInput() })).status, 403);
    assert.equal((await http(`/sms/campaigns/${randomUUID()}/send`, { method: 'POST', role, body: {} })).status, 403);
  }
  assert.equal((await http('/sms/history', { authenticated: false })).status, 401);
  assert.equal(JSON.stringify((await http('/sms/options')).body).includes('mock-key-never-real'), false);
});

test('bulk previews personalise uppercase names, skip invalid/duplicate phones and do not send', async () => {
  await customer(); await customer({ code: '23456' }); await customer({ code: '34567' });
  await rows("UPDATE customers SET phone = 'bad-number' WHERE customer_code = '34567'");
  const preview = await campaignPreview();
  assert.equal(preview.matched, 3);
  assert.equal(preview.duplicates, 1);
  assert.equal(preview.invalid, 1);
  assert.equal(preview.recipients.length, 1);
  assert.match(preview.recipients[0].message, /AMA BOATENG/);
  assert.match(preview.recipients[0].message, /12345/);
  assert.equal(preview.recipients[0].phone, '233241234567');
  assert.equal(await count('sms_outbox'), 0);
  assert.equal(smsRequests.length, 0);
});

test('bulk recipient filters use category, zone, status, search and effective plan', async () => {
  await customer(); await customer({ code: '23456', status: 'inactive' });
  const preview = await campaignPreview(campaignInput({ filters: { status: 'active', zone: 'ZONE1', category: '2', plan: 'HOME', search: 'boateng' } }));
  assert.equal(preview.matched, 1);
  assert.equal(preview.recipients[0].customerId, '12345');
  await plan('BUSINESS', '200');
  await http('/admin/customers/12345', { method: 'PATCH', body: editBody('BUSINESS') });
  assert.equal((await campaignPreview(campaignInput({ filters: { status: 'active', plan: 'HOME' } }))).matched, 1);
  const noMatch = await http('/sms/campaigns/preview', { method: 'POST', body: campaignInput({ filters: { plan: 'BUSINESS' } }) });
  assert.equal(noMatch.status, 400);
  assert.equal((await campaignPreview(campaignInput({ filters: { status: 'inactive', zone: 'all', plan: 'all', category: 'all' } }))).recipients[0].customerId, '23456');
});

test('bulk SMS includes active and inactive customers by default, with optional status filtering', async () => {
  await customer();
  await customer({ code: '23456', status: 'inactive' });
  await rows("UPDATE customers SET phone = '0247654321' WHERE customer_code = '23456'");
  const defaults = await campaignPreview(campaignInput({ filters: {} }));
  assert.equal(defaults.matched, 2);
  assert.equal(defaults.recipients.length, 2);
  const activeOnly = await campaignPreview(campaignInput({ filters: { status: 'active' } }));
  assert.equal(activeOnly.recipients.length, 1);
  assert.equal(activeOnly.recipients[0].customerId, '12345');
  const inactiveOnly = await campaignPreview(campaignInput({ filters: { status: 'inactive' } }));
  assert.equal(inactiveOnly.recipients[0].customerId, '23456');
  assert.equal((await queuePreview(defaults)).body.data.count, 2);
  await sms.processQueue();
  assert.equal(smsRequests.length, 2);
});

test('bulk sending queues only selected recipients and retries/concurrent confirmations do not duplicate', async () => {
  await customer(); await customer({ code: '23456' });
  await rows("UPDATE customers SET phone = '0247654321' WHERE customer_code = '23456'");
  const preview = await campaignPreview();
  const body = { recipientIds: [preview.recipients[1].id] };
  const responses = await Promise.all([queuePreview(preview, body), queuePreview(preview, body)]);
  assert.equal(responses.every((response) => response.body.code === 1), true, JSON.stringify(responses));
  assert.equal(responses.filter((response) => response.body.data.repeated).length, 1);
  assert.equal(await count('sms_outbox'), 1);
  const [row] = await rows('SELECT * FROM sms_outbox');
  assert.equal(row.phone, '233247654321');
  assert.equal(row.campaign_id, preview.id);
  assert.equal(smsRequests.length, 0);
  assert.equal((await queuePreview(preview)).status, 409);
});

test('deliberate bulk sends work when automation is off without dispatching queued automatic messages', async () => {
  await enableSms('payment'); await customer();
  await billing.postEntry('12345', payment('10'), 1);
  await rows('UPDATE sms_settings SET enabled = 0');
  const preview = await campaignPreview(); await queuePreview(preview);
  await sms.processQueue(); await sms.processQueue();
  assert.equal(smsRequests.length, 1);
  assert.match(smsRequests[0].data.text, /Collection resumes/);
  assert.equal((await rows("SELECT status FROM sms_outbox WHERE event_key = 'payment'"))[0].status, 'queued');
  assert.equal((await rows("SELECT status FROM sms_outbox WHERE event_key = 'bulk'"))[0].status, 'submitted_unverified');
});

test('bulk confirmation rejects expired/changed previews, foreign recipients and unconfirmed sends', async () => {
  await customer(); const preview = await campaignPreview();
  assert.equal((await queuePreview(preview, { confirmed: false })).status, 400);
  assert.equal((await queuePreview(preview, { recipientIds: [99999] })).status, 400);
  await rows("UPDATE customers SET phone = '0247654321'");
  assert.equal((await queuePreview(preview)).status, 409);
  const fresh = await campaignPreview();
  await rows('UPDATE sms_campaigns SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE id = ?', [fresh.id]);
  assert.equal((await queuePreview(fresh)).status, 409);
  assert.equal(await count('sms_outbox'), 0);
});

test('one manager cannot confirm another manager\'s draft', async () => {
  await customer(); const preview = await campaignPreview();
  await rows("INSERT INTO users (id, fullname, username, role) VALUES (2, 'Other Manager', 'other-manager', 'Manager')");
  assert.equal((await queuePreview(preview, {}, { userId: 2 })).status, 404);
  assert.equal(await count('sms_outbox'), 0);
});

test('history searches and paginates bulk, automatic and test records without exposing keys', async () => {
  await customer(); const preview = await campaignPreview(); await queuePreview(preview);
  await sms.processQueue();
  const history = await http('/sms/history?event=bulk&status=submitted_unverified&search=Service%20update&limit=10&page=0', { role: 'Manager' });
  assert.equal(history.body.data.total, 1);
  assert.equal(history.body.data.rows[0].campaignTitle, 'Service update');
  assert.equal(history.body.data.rows[0].customerName, 'AMA BOATENG');
  assert.equal(JSON.stringify(history.body).includes('mock-key-never-real'), false);
  assert.equal((await http('/sms/history?page=1&limit=10')).body.data.rows.length, 0);
  assert.equal((await http('/sms/history?event=all&status=all')).body.data.total, 1);
});

test('bulk SMS validates templates, enforces recipient cap and estimates GSM/Unicode segments', async () => {
  await customer();
  for (const message of ['', '  ', '{amount}', 'x'.repeat(1001)]) {
    assert.equal((await http('/sms/campaigns/preview', { method: 'POST', body: campaignInput({ message }) })).status, 400);
  }
  const { estimateSegments } = load('services/smsCampaigns.js');
  assert.equal(estimateSegments('A'.repeat(160)).segments, 1);
  assert.equal(estimateSegments('A'.repeat(161)).segments, 2);
  assert.equal(estimateSegments('^'.repeat(81)).segments, 2);
  assert.equal(estimateSegments('中'.repeat(70)).segments, 1);
  assert.equal(estimateSegments('中'.repeat(71)).segments, 2);
  await rows(`INSERT INTO customers (customer_code, full_name, phone, status) VALUES ${Array.from({ length: 1000 }, () => '(?, ?, ?, ?)').join(',')}`,
    Array.from({ length: 1000 }, (_, index) => [String(50000 + index), 'TEST CUSTOMER', '0241234567', 'active']).flat());
  assert.equal((await http('/sms/campaigns/preview', { method: 'POST', body: campaignInput() })).status, 400);
  assert.equal(await count('sms_outbox'), 0);
});

test('bulk phone changes before dispatch cancel instead of messaging an obsolete number', async () => {
  await customer(); const preview = await campaignPreview(); await queuePreview(preview);
  await rows("UPDATE customers SET phone = 'invalid'");
  await sms.processQueue();
  assert.equal(smsRequests.length, 0);
  assert.equal((await rows('SELECT status FROM sms_outbox'))[0].status, 'cancelled');
});

test('bulk campaign confirms are rate limited without extra queue entries', async () => {
  await customer();
  for (let index = 0; index < 5; index += 1) {
    const preview = await campaignPreview(campaignInput({ title: `Campaign ${index}` }));
    assert.equal((await queuePreview(preview)).body.code, 1);
  }
  const sixth = await campaignPreview();
  assert.equal((await queuePreview(sixth)).status, 429);
  assert.equal(await count('sms_outbox'), 5);
  assert.equal(smsRequests.length, 0);
});

test('independent SMS workers claim each bulk message only once', async () => {
  await customer(); const preview = await campaignPreview(); await queuePreview(preview);
  const filename = path.join(root, 'services/smsNotifications.js');
  const original = cache.get(filename);
  cache.delete(filename);
  const secondWorker = load('services/smsNotifications.js');
  cache.set(filename, original);
  await Promise.all([sms.processQueue(), secondWorker.processQueue()]);
  assert.equal(smsRequests.length, 1);
  assert.equal((await rows('SELECT status FROM sms_outbox'))[0].status, 'submitted_unverified');
});

test('bulk queue insert failure rolls back the whole campaign instead of leaving partial recipients', async () => {
  await customer(); await customer({ code: '23456' });
  await rows("UPDATE customers SET phone = '0247654321' WHERE customer_code = '23456'");
  const preview = await campaignPreview();
  await rows("INSERT INTO sms_outbox (dedupe_key, event_key, phone, message) VALUES (?, 'test', '233247654321', 'Existing collision')", [`bulk:${preview.id}:${preview.recipients[1].phone}`]);
  assert.equal((await queuePreview(preview)).status, 500);
  assert.equal(await count('sms_outbox'), 1);
  assert.equal((await rows('SELECT status FROM sms_campaigns WHERE id = ?', [preview.id]))[0].status, 'draft');
  assert.equal((await rows("SELECT id FROM activity_logs WHERE action = 'QUEUE_BULK_SMS'")).length, 0);
});

const fleetHttp = (url, options = {}) => http(`/fleet${url}`, options);
const asDriver = { userId: 3, role: 'Driver' };
const asSupervisor = { userId: 4, role: 'Supervisor' };
const asAccountant = { userId: 5, role: 'Accountant' };
const tick = (seconds) => { clock.now = new Date(Date.parse(clock.now) + seconds * 1000).toISOString(); };
async function fleetFixture() {
  const client = await customer();
  await rows(`INSERT INTO users (id, fullname, username, role, work_title) VALUES
    (3, 'Assigned Driver', 'driver-a', 'Driver', 'driver'), (4, 'Assigned Supervisor', 'super-a', 'Supervisor', 'supervisor'),
    (5, 'Test Accountant', 'accountant-a', 'Accountant', 'accountant'), (6, 'Other Driver', 'driver-b', 'Driver', 'driver'),
    (7, 'Other Supervisor', 'super-b', 'Supervisor', 'supervisor'), (8, 'Manager', 'manager-a', 'Manager', 'other'),
    (9, 'Customer', 'customer-a', 'Customer', 'other')`);
  await rows("INSERT INTO drivers (user_id, driver_code, full_name, phone, vehicle_number, zone_id, status) VALUES (3, 'DRV-A', 'Assigned Driver', '0241234567', 'LEGACY', 1, 'available'), (6, 'DRV-B', 'Other Driver', '0247654321', 'LEGACY-2', 1, 'available')");
  const line = { type: 'LineString', coordinates: [[-0.188, 5.6037], [-0.18, 5.6037]] };
  await rows("INSERT INTO collection_routes (route_code, route_name, zone_id, start_point, end_point, estimated_duration_mins, status, route_geojson) VALUES ('ROUTE-A', 'Collection A', 1, 'Start', 'End', 60, 'active', ?)", [JSON.stringify(line)]);
  const vehicle = await fleetHttp('/vehicles', { method: 'POST', body: { registration: 'GT-TEST-1', description: 'Collection truck', status: 'available', expectedLitres: '20' } });
  assert.equal(vehicle.body.code, 1, JSON.stringify(vehicle.body));
  const stops = await fleetHttp('/routes/1/stops', { method: 'PUT', body: { customerIds: [client.id] } });
  assert.equal(stops.body.code, 1, JSON.stringify(stops.body));
  return { client, line, input: { routeId: 1, driverId: 1, vehicleId: vehicle.body.data.id, serviceDate: '2026-11-03', corridor: 100, requestKey: randomUUID() } };
}
async function fleetAssigned() {
  const fixture = await fleetFixture();
  const response = await fleetHttp('/runs', { method: 'POST', body: fixture.input });
  assert.equal(response.body.code, 1, JSON.stringify(response.body));
  return { ...fixture, runId: response.body.data.id };
}
async function fleetStart(runId) {
  const response = await fleetHttp(`/runs/${runId}/state`, { ...asDriver, method: 'POST', body: { action: 'start', odometer: '1000' } });
  assert.equal(response.body.code, 1, JSON.stringify(response.body));
}
const gpsPoint = (patch = {}) => ({ requestKey: randomUUID(), latitude: 5.6037, longitude: -0.187, accuracy: 5, capturedAt: clock.now, ...patch });

test('fleet: authenticated current staff roles and assignment scopes are enforced', async () => {
  const { runId } = await fleetAssigned();
  assert.equal((await fleetHttp('/runs', { authenticated: false })).status, 401);
  assert.equal((await fleetHttp('/runs', { userId: 9, role: 'Admin' })).status, 403);
  assert.equal((await fleetHttp('/runs', asDriver)).body.data.length, 1);
  assert.equal((await fleetHttp('/runs', { userId: 6, role: 'Driver' })).body.data.length, 0);
  assert.equal((await fleetHttp(`/runs/${runId}`, { userId: 6, role: 'Driver' })).status, 403);
  assert.equal((await fleetHttp(`/runs/${runId}`, { userId: 7, role: 'Supervisor' })).status, 403);
  assert.equal((await fleetHttp(`/runs/${runId}`, asSupervisor)).status, 403);
  assert.equal((await fleetHttp('/options', asDriver)).status, 403);
  await rows('UPDATE users SET status = 0 WHERE id = 3');
  assert.equal((await fleetHttp('/runs', asDriver)).status, 403);
  assert.equal((await http('/admin/assignments', { ...asDriver, method: 'POST', body: {} })).status, 403);
});

test('fleet: route assignment snapshots, customer order and retry keys preserve history', async () => {
  const { input, runId } = await fleetAssigned();
  const repeated = await fleetHttp('/runs', { method: 'POST', body: input });
  assert.equal(repeated.body.data.repeated, true);
  assert.equal(await count('fleet_runs'), 1);
  assert.equal((await fleetHttp('/runs', { method: 'POST', body: { ...input, corridor: 200 } })).status, 409);
  await rows("UPDATE collection_routes SET route_name = 'Renamed Route', route_geojson = ? WHERE id = 1", [JSON.stringify({ type: 'LineString', coordinates: [[0, 0], [1, 1]] })]);
  const data = (await fleetHttp(`/runs/${runId}`)).body.data;
  assert.equal(data.route_name, 'Collection A');
  assert.equal(data.route_geojson.coordinates[0][0], -0.188);
  assert.equal(data.stops[0].customer_name, 'AMA BOATENG');
  assert.equal(data.stops[0].stop_order, 1);
});

test('fleet: concurrent assignments cannot reserve the same driver or vehicle twice', async () => {
  const { input } = await fleetFixture();
  const responses = await Promise.all([fleetHttp('/runs', { method: 'POST', body: input }), fleetHttp('/runs', { method: 'POST', body: { ...input, driverId: 2, requestKey: randomUUID() } })]);
  assert.equal(responses.filter((response) => response.body.code === 1).length, 1, JSON.stringify(responses));
  assert.equal(await count('fleet_runs'), 1);
  assert.equal(await count('fleet_stops'), 1);
});

test('fleet: invalid routes, maintenance vehicles and wrong-zone customer stops are rejected', async () => {
  const { client, input } = await fleetFixture();
  await rows("UPDATE fleet_vehicles SET status = 'maintenance'");
  assert.equal((await fleetHttp('/runs', { method: 'POST', body: input })).status, 400);
  await rows("UPDATE fleet_vehicles SET status = 'available'");
  await rows('UPDATE collection_routes SET route_geojson = NULL');
  assert.equal((await fleetHttp('/runs', { method: 'POST', body: input })).status, 400);
  assert.equal((await fleetHttp('/routes/1/stops', { method: 'PUT', body: { customerIds: [client.id, client.id] } })).status, 400);
  await rows("UPDATE customers SET zone_code = 'OTHER'");
  assert.equal((await fleetHttp('/routes/1/stops', { method: 'PUT', body: { customerIds: [client.id] } })).status, 400);
  assert.equal(await count('fleet_runs'), 0);
});

test('fleet: route lifecycle releases reservations but never marks pending stops collected', async () => {
  const { runId, input } = await fleetAssigned();
  await fleetStart(runId);
  assert.equal((await fleetHttp(`/runs/${runId}/state`, { ...asSupervisor, method: 'POST', body: { action: 'finish', note: 'Attempt' } })).status, 403);
  assert.equal((await fleetHttp(`/runs/${runId}/state`, { ...asDriver, method: 'POST', body: { action: 'finish', odometer: '999', note: 'Finished', acknowledgeOutstanding: true } })).status, 400);
  assert.equal((await fleetHttp(`/runs/${runId}/state`, { ...asDriver, method: 'POST', body: { action: 'finish', odometer: '1010', note: 'One stop inaccessible' } })).status, 400);
  assert.equal((await fleetHttp(`/runs/${runId}/state`, { ...asDriver, method: 'POST', body: { action: 'finish', odometer: '1010', note: 'One stop inaccessible', acknowledgeOutstanding: true } })).body.code, 1);
  const data = (await fleetHttp(`/runs/${runId}`)).body.data;
  assert.equal(data.status, 'completed');
  assert.equal(data.odometerKm, 10);
  assert.equal(data.stops[0].status, 'pending');
  assert.equal((await fleetHttp('/runs', { method: 'POST', body: { ...input, requestKey: randomUUID() } })).body.code, 1);
});

test('fleet: GPS proximity records visited, not collected, and calculates filtered distance once', async () => {
  const { runId } = await fleetAssigned(); await fleetStart(runId);
  const first = gpsPoint();
  assert.equal((await fleetHttp(`/runs/${runId}/locations`, { ...asDriver, method: 'POST', body: first })).body.data.accepted, true);
  tick(10);
  const next = gpsPoint({ longitude: -0.1865 });
  await fleetHttp(`/runs/${runId}/locations`, { ...asDriver, method: 'POST', body: next });
  await fleetHttp(`/runs/${runId}/locations`, { ...asDriver, method: 'POST', body: next });
  const data = (await fleetHttp(`/runs/${runId}`)).body.data;
  assert.equal(data.stops[0].status, 'visited');
  assert.ok(data.distanceKm > 0.04 && data.distanceKm < 0.07);
  assert.equal(await count('fleet_locations'), 2);
  assert.equal((await fleetHttp(`/runs/${runId}/locations`, { ...asSupervisor, method: 'POST', body: gpsPoint() })).status, 403);
});

test('fleet: poor GPS, jumps, stale data and tracking gaps do not fabricate distance', async () => {
  const { runId } = await fleetAssigned(); await fleetStart(runId);
  await fleetHttp(`/runs/${runId}/locations`, { ...asDriver, method: 'POST', body: gpsPoint() });
  tick(10);
  assert.equal((await fleetHttp(`/runs/${runId}/locations`, { ...asDriver, method: 'POST', body: gpsPoint({ accuracy: 100 }) })).body.data.accepted, false);
  assert.equal((await fleetHttp(`/runs/${runId}/locations`, { ...asDriver, method: 'POST', body: gpsPoint({ latitude: 6.5 }) })).body.data.accepted, false);
  tick(180);
  assert.equal((await fleetHttp(`/runs/${runId}`)).body.data.tracking, 'stale / no GPS');
  await fleetHttp(`/runs/${runId}/locations`, { ...asDriver, method: 'POST', body: gpsPoint({ longitude: -0.18 }) });
  const data = (await fleetHttp(`/runs/${runId}`)).body.data;
  assert.equal(data.distanceKm, 0);
  assert.equal(data.tracking_gaps, 1);
});

test('fleet: sustained off-route positions raise deviation only after three accepted points', async () => {
  const { runId } = await fleetAssigned(); await fleetStart(runId);
  for (let index = 0; index < 3; index += 1) {
    tick(10);
    await fleetHttp(`/runs/${runId}/locations`, { ...asDriver, method: 'POST', body: gpsPoint({ latitude: 5.607 }) });
    assert.equal((await fleetHttp(`/runs/${runId}`)).body.data.tracking, index < 2 ? 'checking deviation' : 'off route');
  }
});

test('fleet: open complaints require photo evidence, including complaints recorded after assignment', async () => {
  const { runId, client } = await fleetAssigned(); await fleetStart(runId);
  const complaint = await fleetHttp('/complaints', { method: 'POST', body: { customerId: client.id, description: 'Bin repeatedly left full' } });
  assert.equal(complaint.body.code, 1);
  const data = (await fleetHttp(`/runs/${runId}`, asDriver)).body.data;
  assert.equal(data.stops[0].complaint, 1);
  const response = await fleetHttp(`/runs/${runId}/stops/${data.stops[0].id}/confirm`, { ...asDriver, method: 'POST', body: { ...gpsPoint(), status: 'collected', note: 'Bin emptied' } });
  assert.equal(response.status, 400);
  assert.match(response.body.message, /Photo evidence is required/);
  assert.equal((await fleetHttp(`/complaints/${complaint.body.data.id}/resolve`, { ...asDriver, method: 'POST', body: {} })).status, 403);
});

test('fleet: pickup confirmation is explicit, GPS-validated, idempotent and evidence is private', async () => {
  const { runId } = await fleetAssigned(); await fleetStart(runId);
  const stop = (await fleetHttp(`/runs/${runId}`, asDriver)).body.data.stops[0];
  const payload = { ...gpsPoint(), status: 'collected', note: 'Empty bin verified' };
  const url = `/runs/${runId}/stops/${stop.id}/confirm`;
  assert.equal((await fleetHttp(url, { ...asDriver, method: 'POST', body: { ...payload, latitude: 6.0 } })).status, 400);
  assert.equal((await fleetHttp(url, { ...asDriver, method: 'POST', body: payload })).body.code, 1);
  assert.equal((await fleetHttp(url, { ...asDriver, method: 'POST', body: payload })).body.data.repeated, true);
  assert.equal((await fleetHttp(`/runs/${runId}`, asDriver)).body.data.stops[0].status, 'collected');
  assert.equal((await fleetHttp(`/runs/${runId}/stops/${stop.id}/photo`, { userId: 6, role: 'Driver' })).status, 403);
});

test('fleet: valid photo upload is stored privately and read only by authorised assignment staff', async () => {
  const { runId, client } = await fleetAssigned(); await fleetStart(runId);
  await fleetHttp('/complaints', { method: 'POST', body: { customerId: client.id, description: 'Evidence requested' } });
  const stop = (await fleetHttp(`/runs/${runId}`, asDriver)).body.data.stops[0];
  const form = new FormData();
  Object.entries({ ...gpsPoint(), status: 'collected', note: 'Photo shows empty bin' }).forEach(([name, value]) => form.append(name, String(value)));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64');
  form.append('photo', new Blob([png], { type: 'image/png' }), 'evidence.png');
  const token = jwt.sign({ user_id: 3, role: 'Driver' }, secret);
  const response = await fetch(`${origin}/fleet/runs/${runId}/stops/${stop.id}/confirm`, { method: 'POST', headers: { 'x-access-token': token }, body: form });
  const body = await response.json();
  assert.equal(body.code, 1, JSON.stringify(body));
  const detail = (await fleetHttp(`/runs/${runId}`, asDriver)).body.data;
  assert.equal(detail.stops[0].hasPhoto, true);
  assert.equal('photo_key' in detail.stops[0], false);
  const image = await fetch(`${origin}/fleet/runs/${runId}/stops/${stop.id}/photo`, { headers: { 'x-access-token': token } });
  assert.equal(image.status, 200);
  assert.match(image.headers.get('cache-control'), /no-store/);
  assert.equal((await image.arrayBuffer()).byteLength, png.length);
  assert.equal(fs.readdirSync(evidenceDirectory).length >= 1, true);
});

test('fleet: fuel issues use integer amounts, duplicate cheque references and retries are protected', async () => {
  const { runId } = await fleetAssigned();
  const payload = { vehicleId: 1, driverId: 1, runId, issueDate: '2026-11-03', litres: '10.125', pricePerLitre: '15', chequeNumber: 'CHQ-100', note: 'Route fuel authorisation', requestKey: randomUUID() };
  assert.equal((await fleetHttp('/fuel', { ...asDriver, method: 'POST', body: payload })).status, 403);
  const response = await fleetHttp('/fuel', { ...asAccountant, method: 'POST', body: payload });
  assert.equal(response.body.code, 1, JSON.stringify(response.body));
  assert.equal((await fleetHttp('/fuel', { ...asAccountant, method: 'POST', body: payload })).body.data.repeated, true);
  assert.equal((await fleetHttp('/fuel', { ...asAccountant, method: 'POST', body: { ...payload, requestKey: randomUUID() } })).status, 409);
  const detail = (await fleetHttp(`/runs/${runId}`, asAccountant)).body.data;
  assert.equal(detail.fuelLitres, 10.125);
  assert.equal(detail.fuelAmountCents, 15188);
  assert.equal(await count('account_ledger'), 0);
  assert.equal(detail.issuedLitresPer100Km, null);
});

test('fleet: immutable fuel reversals reduce issued totals without deleting original issues', async () => {
  const { runId } = await fleetAssigned();
  const entry = await fleetHttp('/fuel', { ...asAccountant, method: 'POST', body: { vehicleId: 1, driverId: 1, runId, issueDate: '2026-11-03', litres: '5', pricePerLitre: '20', chequeNumber: 'CHQ-REV-1', note: 'Fuel issued', requestKey: randomUUID() } });
  const body = { note: 'Issue entered for wrong route', requestKey: randomUUID() };
  assert.equal((await fleetHttp(`/fuel/${entry.body.data.id}/reverse`, { ...asAccountant, method: 'POST', body })).body.code, 1);
  assert.equal((await fleetHttp(`/fuel/${entry.body.data.id}/reverse`, { ...asAccountant, method: 'POST', body: { ...body, requestKey: randomUUID() } })).status, 400);
  const detail = (await fleetHttp(`/runs/${runId}`, asAccountant)).body.data;
  assert.equal(detail.fuelLitres, 0);
  assert.equal(detail.fuelAmountCents, 0);
  assert.equal(detail.fuel.length, 2);
});

test('fleet: geometry and money reject malformed inputs and route edit preserves assigned snapshots', async () => {
  const geo = load('services/fleetGeometry.js');
  assert.equal(Math.round(geo.metres({ lat: 0, lng: 0 }, { lat: 0, lng: 0.001 })), 111);
  assert.throws(() => geo.routeLine({ type: 'LineString', coordinates: [[null, 5], [0, 5]] }));
  const fleet = load('services/fleetOperations.js');
  for (const value of ['-1', '1.001', '', null]) assert.throws(() => fleet.decimal(value));
  const { runId, line } = await fleetAssigned();
  const edited = await fleetHttp('/routes/1', { method: 'PATCH', body: { routeName: 'Updated collection', startPoint: 'New start', endPoint: 'End', estimatedDurationMins: 45, status: 'active', zoneId: 1, routeGeoJson: line } });
  assert.equal(edited.body.code, 1, JSON.stringify(edited.body));
  assert.equal((await fleetHttp(`/runs/${runId}`)).body.data.route_name, 'Collection A');
  assert.equal((await fleetHttp('/vehicles/1', { method: 'PATCH', body: { registration: 'NEW', description: 'Changed', status: 'inactive' } })).status, 409);
});

test('fleet: movement and issued-fuel comparisons use recorded distance without claiming consumption', async () => {
  const { runId } = await fleetAssigned(); await fleetStart(runId);
  await fleetHttp(`/runs/${runId}/locations`, { ...asDriver, method: 'POST', body: gpsPoint() });
  tick(10);
  await fleetHttp(`/runs/${runId}/locations`, { ...asDriver, method: 'POST', body: gpsPoint({ longitude: -0.1865 }) });
  let detail = (await fleetHttp(`/runs/${runId}`)).body.data;
  assert.equal(detail.movement, 'moving');
  assert.ok(Number(detail.latest_speed_kmh) > 5);
  await fleetHttp('/fuel', { ...asAccountant, method: 'POST', body: { vehicleId: 1, driverId: 1, runId, issueDate: '2026-11-03', litres: '5', pricePerLitre: '20', chequeNumber: 'CHQ-TEST-2', note: 'Fuel for route', requestKey: randomUUID() } });
  await fleetHttp(`/runs/${runId}/state`, { ...asDriver, method: 'POST', body: { action: 'finish', odometer: '1025', note: 'Returned with unserved stop', acknowledgeOutstanding: true } });
  detail = (await fleetHttp(`/runs/${runId}`, asAccountant)).body.data;
  assert.equal(detail.odometerKm, 25);
  assert.equal(detail.issuedLitresPer100Km, 20);
  assert.equal(detail.expectedLitres, 5);
  assert.equal((await fleetHttp(`/runs/${runId}/locations`, { ...asDriver, method: 'POST', body: gpsPoint() })).status, 400);
});

test('fleet: assigned complaint evidence requirements survive later complaint resolution', async () => {
  const fixture = await fleetFixture();
  const complaint = await fleetHttp('/complaints', { method: 'POST', body: { customerId: fixture.client.id, description: 'Document every visit' } });
  const created = await fleetHttp('/runs', { method: 'POST', body: fixture.input });
  const runId = created.body.data.id; await fleetStart(runId);
  await fleetHttp(`/complaints/${complaint.body.data.id}/resolve`, { method: 'POST', body: {} });
  const stop = (await fleetHttp(`/runs/${runId}`, asDriver)).body.data.stops[0];
  assert.equal(stop.complaint, 0); assert.equal(stop.photo_required, 1);
  assert.equal((await fleetHttp(`/runs/${runId}/stops/${stop.id}/confirm`, { ...asDriver, method: 'POST', body: { ...gpsPoint(), status: 'collected', note: 'Emptied' } })).status, 400);
});

test('fleet: arbitrary file uploads are rejected before creating evidence or changing a stop', async () => {
  const { runId } = await fleetAssigned(); await fleetStart(runId);
  const stop = (await fleetHttp(`/runs/${runId}`, asDriver)).body.data.stops[0];
  const form = new FormData();
  Object.entries({ ...gpsPoint(), status: 'collected', note: 'Invalid image attempt' }).forEach(([name, value]) => form.append(name, String(value)));
  form.append('photo', new Blob(['<script>alert(1)</script>'], { type: 'image/png' }), 'fake.png');
  const token = jwt.sign({ user_id: 3, role: 'Driver' }, secret);
  const response = await fetch(`${origin}/fleet/runs/${runId}/stops/${stop.id}/confirm`, { method: 'POST', headers: { 'x-access-token': token }, body: form });
  assert.equal(response.status, 400);
  assert.equal((await fleetHttp(`/runs/${runId}`, asDriver)).body.data.stops[0].status, 'pending');
});

test('fleet: driver availability edits and cancellation cannot bypass active reservations', async () => {
  const { runId } = await fleetAssigned();
  assert.equal((await fleetHttp('/drivers/1', { method: 'PATCH', body: { phone: '0241234567', zoneId: 1, status: 'inactive' } })).status, 409);
  assert.equal((await fleetHttp(`/runs/${runId}/state`, { ...asDriver, method: 'POST', body: { action: 'cancel', note: 'Attempt' } })).status, 403);
  assert.equal((await fleetHttp(`/runs/${runId}/state`, { method: 'POST', body: { action: 'cancel', note: 'Vehicle unavailable' } })).body.code, 1);
  assert.equal((await fleetHttp('/drivers/1', { method: 'PATCH', body: { phone: '0241234567', zoneId: 1, status: 'off-duty' } })).body.code, 1);
  assert.equal((await rows('SELECT open_driver_id, open_vehicle_id FROM fleet_runs WHERE id = ?', [runId]))[0].open_driver_id, null);
});

const fuelVoucher = (patch = {}) => ({ vehicleId: 1, driverId: 1, issueDate: '2026-11-03', litres: '50', pricePerLitre: '15.25', chequeNumber: 'CHQ-VOUCHER-1', requestKey: randomUUID(), ...patch });

test('fleet: standalone fuel vouchers need no route and calculate litres times unit price server-side', async () => {
  await fleetFixture();
  const response = await fleetHttp('/fuel', { ...asAccountant, method: 'POST', body: fuelVoucher({ amount: '1' }) });
  assert.equal(response.body.code, 1, JSON.stringify(response.body));
  assert.equal(response.body.data.amountCents, 76250);
  const [entry] = await rows('SELECT * FROM fleet_fuel');
  assert.equal(entry.run_id, null);
  assert.equal(Number(entry.unit_price_units), 152500);
  assert.equal(Number(entry.litres_milli), 50000);
  assert.equal(Number(entry.amount_cents), 76250);
  assert.equal(entry.reference, 'CHQ-VOUCHER-1');
  assert.equal(entry.driver_name, 'Assigned Driver');
  assert.equal(entry.vehicle_registration, 'GT-TEST-1');
  assert.equal(await count('fleet_runs'), 0);
  assert.equal(await count('account_ledger'), 0);
});

test('fleet: fuel pricing uses exact half-up pesewa rounding and validates price/date/cheque inputs', async () => {
  await fleetFixture();
  const fuel = load('services/fuelRegister.js');
  assert.equal(fuel.calculateFuel('1', '10.1250').cents, 1013);
  assert.equal(fuel.calculateFuel('2.5', '12.3456').cents, 3086);
  assert.equal(fuel.calculateFuel('0.001', '5').cents, 1);
  for (const patch of [{ pricePerLitre: '-1' }, { pricePerLitre: '1.23456' }, { litres: '0' }, { chequeNumber: ' ' }, { issueDate: '2026-02-29' }, { issueDate: '2026-11-04' }]) {
    assert.equal((await fleetHttp('/fuel', { ...asAccountant, method: 'POST', body: fuelVoucher(patch) })).status, 400, JSON.stringify(patch));
  }
  assert.equal((await fleetHttp('/fuel/options', asDriver)).status, 403);
  assert.equal((await fleetHttp('/fuel', { userId: 8, role: 'Manager', method: 'POST', body: fuelVoucher() })).status, 403);
  assert.equal((await fleetHttp('/fuel?from=2026-11-01&to=2026-11-03', { userId: 8, role: 'Manager' })).status, 200);
});

test('fleet: concurrent voucher retries and duplicate cheque references cannot double-post', async () => {
  await fleetFixture();
  const body = fuelVoucher();
  const results = await Promise.all([fleetHttp('/fuel', { ...asAccountant, method: 'POST', body }), fleetHttp('/fuel', { ...asAccountant, method: 'POST', body })]);
  assert.equal(results.every((response) => response.body.code === 1), true, JSON.stringify(results));
  assert.equal(results.filter((response) => response.body.data.repeated).length, 1);
  assert.equal((await fleetHttp('/fuel', { ...asAccountant, method: 'POST', body: { ...body, pricePerLitre: '16' } })).status, 409);
  assert.equal((await fleetHttp('/fuel', { ...asAccountant, method: 'POST', body: { ...body, requestKey: randomUUID() } })).status, 409);
  assert.equal(await count('fleet_fuel'), 1);
});

test('fleet: fuel reports match vehicle/driver/date cohorts without multiplying distance per fuel issue', async () => {
  const { runId, input } = await fleetAssigned(); await fleetStart(runId);
  await fleetHttp(`/runs/${runId}/state`, { ...asDriver, method: 'POST', body: { action: 'finish', odometer: '1010', note: 'Finished', acknowledgeOutstanding: true } });
  const second = await fleetHttp('/runs', { method: 'POST', body: { ...input, requestKey: randomUUID() } });
  const secondId = second.body.data.id; await fleetStart(secondId);
  await fleetHttp(`/runs/${secondId}/state`, { ...asDriver, method: 'POST', body: { action: 'finish', odometer: '1010', note: 'Finished', acknowledgeOutstanding: true } });
  const firstFuel = await fleetHttp('/fuel', { ...asAccountant, method: 'POST', body: fuelVoucher({ litres: '5', pricePerLitre: '20', runId }) });
  await fleetHttp('/fuel', { ...asAccountant, method: 'POST', body: fuelVoucher({ litres: '5', pricePerLitre: '20', chequeNumber: 'CHQ-VOUCHER-2' }) });
  let report = (await fleetHttp('/fuel?from=2026-11-03&to=2026-11-03&vehicleId=1&driverId=1', asAccountant)).body.data;
  assert.equal(report.total, 2); assert.equal(report.runTotal, 2);
  assert.equal(report.summary.litresMilli, 10000); assert.equal(report.summary.amountCents, 20000);
  assert.equal(report.summary.unlinkedLitresMilli, 5000);
  assert.equal(report.groups.length, 1); assert.equal(Number(report.groups[0].runCount), 2);
  assert.equal(Number(report.groups[0].comparisonKm), 20);
  assert.equal(report.groups[0].issuedLitresPer100Km, 50);
  assert.equal((await fleetHttp(`/runs/${runId}`, asAccountant)).body.data.fuelLitres, 5);
  await fleetHttp(`/fuel/${firstFuel.body.data.id}/reverse`, { ...asAccountant, method: 'POST', body: { note: 'Wrong fuel record', requestKey: randomUUID() } });
  report = (await fleetHttp('/fuel?from=2026-11-03&to=2026-11-03', asAccountant)).body.data;
  assert.equal(report.summary.litresMilli, 5000); assert.equal(report.summary.amountCents, 10000);
  assert.equal(report.total, 3); assert.equal(Number(report.groups[0].comparisonKm), 20);
  assert.equal((await fleetHttp('/fuel?from=2026-11-03&to=2026-11-03&page=1&limit=10', asAccountant)).body.data.entries.length, 0);
  assert.equal((await fleetHttp('/fuel?from=2026-11-02&to=2026-11-02', asAccountant)).body.data.total, 0);
});

test('fleet: optional route linking validates driver/vehicle membership and does not silently infer a route', async () => {
  const { runId } = await fleetAssigned();
  assert.equal((await fleetHttp('/fuel', { ...asAccountant, method: 'POST', body: fuelVoucher({ driverId: 2, runId }) })).status, 400);
  const response = await fleetHttp('/fuel', { ...asAccountant, method: 'POST', body: fuelVoucher() });
  assert.equal(response.body.code, 1);
  assert.equal((await rows('SELECT run_id FROM fleet_fuel'))[0].run_id, null);
});

test('fleet: legacy fuel amounts are retained without inventing old unit prices or issue dates', async () => {
  const { runId } = await fleetAssigned();
  const [created] = await isolatedPool.query("INSERT INTO fleet_fuel (run_id, entry_type, litres_milli, amount_cents, method, reference, note, request_key, fingerprint, created_by) VALUES (?, 'issue', 5555, 12345, 'cash', NULL, 'Legacy entry', ?, 'legacy', 5)", [runId, randomUUID()]);
  const connection = await pool.getConnection();
  try { await require('../migrations/fuelRegister')(connection); } finally { connection.release(); }
  const detail = (await fleetHttp(`/fuel/${created.insertId}`, asAccountant)).body.data;
  assert.equal(detail.legacyDate, 1); assert.equal(detail.legacyPrice, 1);
  assert.equal(detail.unit_price_units, null); assert.equal(Number(detail.amount_cents), 12345);
  await fleetHttp(`/fuel/${detail.id}/reverse`, { ...asAccountant, method: 'POST', body: { note: 'Correction of legacy record', requestKey: randomUUID() } });
  const report = (await fleetHttp('/fuel?from=2026-11-03&to=2026-11-03', asAccountant)).body.data;
  assert.equal(report.summary.amountCents, 0); assert.equal(report.summary.litresMilli, 0);
  assert.equal((await rows('SELECT unit_price_units FROM fleet_fuel WHERE id = ?', [detail.id]))[0].unit_price_units, null);
});

test('fleet: supervisor is merged into the assigned driver without a separate supervisor selection', async () => {
  const fixture = await fleetFixture();
  await rows("UPDATE users SET role = 'Supervisor', work_title = 'supervisor' WHERE id = 3");
  const response = await fleetHttp('/runs', { method: 'POST', body: { ...fixture.input, supervisorId: 99999 } });
  assert.equal(response.body.code, 1, JSON.stringify(response.body));
  const runId = response.body.data.id;
  assert.equal(Number((await rows('SELECT supervisor_id FROM fleet_runs WHERE id = ?', [runId]))[0].supervisor_id), 3);
  const alias = { userId: 3, role: 'Supervisor' };
  assert.equal((await fleetHttp('/runs', alias)).body.data.length, 1);
  assert.equal((await fleetHttp(`/runs/${runId}/state`, { ...alias, method: 'POST', body: { action: 'start', odometer: '100' } })).body.code, 1);
  assert.equal((await fleetHttp(`/runs/${runId}/locations`, { ...alias, method: 'POST', body: gpsPoint() })).body.data.accepted, true);
  assert.equal((await fleetHttp(`/runs/${runId}`, { userId: 4, role: 'Supervisor' })).status, 403);
  assert.equal((await fleetHttp(`/runs/${runId}`, alias)).body.data.fuelAmountCents, null);
});

const checkout = () => load('services/customerPayments.js');
const checkoutInput = (patch = {}) => ({ amount: '50.25', phone: '0241234567', email: 'payer@example.test', provider: 'mtn', confirmed: true, requestKey: randomUUID(), ...patch });
async function checkoutFixture() { await customer(); return checkout().lookup('12345'); }
async function signedPaymentWebhook(reference, signatureOverride) {
  const body = JSON.stringify({ event: 'charge.success', data: { reference } });
  return fetch(`${origin}/customer-payments/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signatureOverride || createHmac('sha512', gatewaySecret).update(body).digest('hex') }, body });
}

test('payments: public ID lookup is strictly five digits and exposes no financial history or private contact details', async () => {
  await customer();
  const config = await http('/customer-payments/config', { authenticated: false });
  assert.equal(config.body.data.environment, 'live'); assert.equal(config.body.data.shortcode, '*412*99#');
  assert.equal(JSON.stringify(config.body).includes('sk_live'), false);
  const response = await http('/customer-payments/lookup', { authenticated: false, method: 'POST', body: { customerId: '12345' } });
  assert.equal(response.body.code, 1);
  assert.equal(response.body.data.displayName, 'AMA BOATENG');
  assert.equal(response.body.data.customerId, '12345');
  assert.equal(JSON.stringify(response.body).includes('0241234567'), false);
  assert.equal(JSON.stringify(response.body).includes('AMA BOATENG'), true);
  assert.deepEqual(Object.keys(response.body.data).sort(), ['customerId', 'displayName', 'token']);
  for (const value of ['1234', '123456', '01234', 'HOME1', 12345]) await assert.rejects(() => checkout().lookup(value), /five-digit/);
  assert.equal((await http('/billing/payments', { authenticated: false })).status, 401);
});

test('payments: direct MoMo charge persists first, uses exact pesewas and never trusts client-supplied success', async () => {
  const access = await checkoutFixture();
  const result = await checkout().initiate(access.token, checkoutInput({ status: 'success', customerId: '99999' }));
  assert.equal(result.status, 'pending'); assert.equal(result.amountCents, 5025); assert.equal(result.receipt, undefined);
  assert.equal(await count('gateway_payments'), 1); assert.equal(await count('account_ledger'), 0);
  const request = gatewayRequests[0];
  assert.equal(request.data.amount, 5025); assert.equal(request.data.currency, 'GHS'); assert.equal(request.data.mobile_money.provider, 'mtn');
  assert.equal(request.timeout, 15000); assert.equal(request.maxRedirects, 0);
  assert.equal((await rows('SELECT customer_id FROM gateway_payments'))[0].customer_id, (await rows('SELECT id FROM customers'))[0].id);
});

test('payments: confirmations, phone, amount, network and email validation run before a charge', async () => {
  const access = await checkoutFixture();
  for (const patch of [{ confirmed: false }, { amount: '1.001' }, { amount: '0.5' }, { phone: '+233241234567' }, { phone: '024123456' }, { provider: 'bad' }, { email: '' }]) {
    await assert.rejects(() => checkout().initiate(access.token, checkoutInput(patch)));
  }
  assert.equal(gatewayRequests.length, 0); assert.equal(await count('gateway_payments'), 0);
});

test('payments: concurrent retries charge once and changed request details conflict', async () => {
  const access = await checkoutFixture(); const input = checkoutInput();
  const results = await Promise.all([checkout().initiate(access.token, input), checkout().initiate(access.token, input)]);
  assert.equal(results[0].reference, results[1].reference);
  assert.equal(gatewayRequests.filter((request) => request.url.endsWith('/charge')).length, 1);
  await assert.rejects(() => checkout().initiate(access.token, { ...input, amount: '99' }), /another payment/);
  await assert.rejects(() => checkout().initiate(access.token, checkoutInput()), /still awaiting confirmation/);
});

test('payments: uncertain charge submissions are recoverable and never automatically submitted again', async () => {
  const access = await checkoutFixture(); const input = checkoutInput(); gatewayMode = 'timeout';
  const first = await checkout().initiate(access.token, input);
  assert.equal(first.status, 'unknown');
  await checkout().initiate(access.token, input);
  assert.equal(gatewayRequests.filter((request) => request.url.endsWith('/charge')).length, 1);
  assert.equal((await checkout().current(access.token)).reference, first.reference);
  assert.equal(await count('account_ledger'), 0);
});

test('payments: OTP and receipt/status access are bound to the private payment session', async () => {
  const access = await checkoutFixture(); gatewayMode = 'send_otp';
  const first = await checkout().initiate(access.token, checkoutInput()); assert.equal(first.status, 'send_otp');
  const stranger = await checkout().lookup('12345');
  await assert.rejects(() => checkout().status(stranger.token, first.reference), /not found/);
  await assert.rejects(() => checkout().submitOtp(stranger.token, first.reference, '123456'), /not found/);
  await assert.rejects(() => checkout().submitOtp(access.token, first.reference, 'invalid'), /numeric OTP/);
  const updated = await checkout().submitOtp(access.token, first.reference, '123456');
  assert.equal(updated.status, 'pending'); assert.equal(await count('account_ledger'), 0);
  await rows('UPDATE payment_sessions SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND)');
  await assert.rejects(() => checkout().status(access.token, first.reference), /expired/);
});

test('payments: verified success posts once across webhook, polling and worker, creates a real receipt and one SMS outbox event', async () => {
  await enableSms('payment'); const access = await checkoutFixture();
  const first = await checkout().initiate(access.token, checkoutInput()); gatewayMode = 'success';
  await Promise.all([signedPaymentWebhook(first.reference), signedPaymentWebhook(first.reference), checkout().status(access.token, first.reference), checkout().reconcile()]);
  assert.equal(await count('account_ledger'), 1); assert.equal(await count('sms_outbox'), 1);
  const receipt = await checkout().status(access.token, first.reference);
  assert.equal(receipt.status, 'success'); assert.equal(receipt.receipt.id, '1'); assert.equal(receipt.customer.fullName, 'AMA BOATENG');
  const data = await account(); assert.equal(data.summary.totalPaidCents, 5025); assert.equal(data.summary.creditCents, 5025);
  assert.equal(data.statement[0].source, 'paystack'); assert.equal(data.statement[0].collectorName, null);
  assert.equal((await rows('SELECT created_by_user_id FROM account_ledger'))[0].created_by_user_id, null);
  const records = (await http('/billing/payments')).body.data; assert.equal(records[0].source, 'paystack');
  await assert.rejects(() => billing.postEntry('12345', payment('50.25', { method: 'mobile_money', reference: first.reference }), 1), /online Paystack reference/);
  assert.equal((await http('/billing/gateway-payments')).body.data[0].receipt, 'RCPT-1');
  await billing.postEntry('12345', payment('0', { type: 'reversal', entryId: 1, note: 'Office correction; no provider refund' }), 1);
  assert.equal((await checkout().status(access.token, first.reference)).receipt.reversed, true);
  assert.equal(gatewayRequests.filter((request) => /refund/.test(request.url)).length, 0);
});

test('payments: mismatched gateway amount, currency, environment, metadata or reference cannot credit an account', async () => {
  const access = await checkoutFixture(); const first = await checkout().initiate(access.token, checkoutInput()); gatewayMode = 'success';
  for (const override of [{ amount: 1 }, { currency: 'USD' }, { domain: 'test' }, { metadata: { application: 'another-app' } }, { reference: 'another-reference' }, { paid_at: 'invalid' }]) {
    gatewayOverride = override;
    assert.equal((await signedPaymentWebhook(first.reference)).status, 200);
    assert.equal((await rows('SELECT status FROM gateway_payments'))[0].status, 'review');
    assert.equal(await count('account_ledger'), 0);
  }
});

test('payments: webhook requires exact-body HMAC and independently verifies instead of trusting callback success', async () => {
  const access = await checkoutFixture(); const first = await checkout().initiate(access.token, checkoutInput());
  assert.equal((await signedPaymentWebhook(first.reference, 'a'.repeat(128))).status, 401);
  assert.equal(await count('account_ledger'), 0);
  assert.equal((await signedPaymentWebhook(first.reference)).status, 200);
  assert.equal(await count('account_ledger'), 0);
  assert.equal(gatewayRequests.some((request) => request.url.includes('/transaction/verify/')), true);
});

test('payments: test-mode successes stay out of real balances and SMS and are clearly marked', async () => {
  gatewaySecret = 'sk_test_mock_never_real'; await enableSms('payment'); const access = await checkoutFixture();
  const first = await checkout().initiate(access.token, checkoutInput()); gatewayMode = 'success';
  assert.equal((await signedPaymentWebhook(first.reference)).status, 200);
  const result = await checkout().status(access.token, first.reference);
  assert.equal(result.status, 'success'); assert.equal(result.receipt.testPayment, true);
  assert.equal(await count('account_ledger'), 0); assert.equal(await count('sms_outbox'), 0);
  assert.equal((await account()).summary.totalPaidCents, 0);
});

test('payments: late reconciliation preserves actual payment date and settles existing invoices', async () => {
  const access = await checkoutFixture(); const first = await checkout().initiate(access.token, checkoutInput({ amount: '120' }));
  advance('2026-12-01'); await billing.__testing.billCustomer('12345', 1);
  gatewayMode = 'success'; await checkout().reconcile();
  const data = await account(); assert.equal(data.summary.owingCents, 0); assert.equal(data.invoices[0].status, 'paid');
  assert.equal(data.statement.find((entry) => entry.type === 'payment').date, '2026-11-03');
});

test('payments: all staff methods retain collector identity, reject fake gateway sources and print-compatible receipt records', async () => {
  await customer();
  for (const method of ['cash', 'mobile_money', 'cheque', 'bank_wire', 'bank_transfer', 'other']) {
    const response = await http('/billing/customers/12345/entries', { method: 'POST', body: payment('10', { method, reference: `REF-${method}`, payment_source: 'paystack', collector_name: 'Fake collector' }) });
    assert.equal(response.body.code, 1, JSON.stringify(response.body));
  }
  await assert.rejects(() => billing.postEntry('12345', payment('10', { method: 'paystack', reference: 'FAKE' }), 1), /valid payment method/);
  const payments = (await http('/billing/payments')).body.data;
  assert.equal(payments.length, 6);
  assert.equal(payments.every((entry) => entry.source === 'staff' && entry.collectorName === 'Test Admin' && entry.receipt.startsWith('RCPT-')), true);
  assert.equal((await http('/billing/gateway-payments', { role: 'Customer' })).status, 403);
});

test('payments: ledger and gateway success commit atomically and a failed posting can be safely reconciled', async () => {
  const access = await checkoutFixture(); const first = await checkout().initiate(access.token, checkoutInput());
  // Deliberately invalid scratch-account total forces rebalance to fail after INSERT.
  const bad = await rows("INSERT INTO account_ledger (customer_id, entry_type, debit_cents, occurred_on, description, request_key) SELECT id, 'debit_adjustment', 9007199254740992, '2026-11-03', 'Test precision failure', ? FROM customers", [randomUUID()]);
  gatewayMode = 'success'; assert.equal((await signedPaymentWebhook(first.reference)).status, 400);
  assert.equal((await rows("SELECT COUNT(*) AS total FROM account_ledger WHERE entry_type = 'payment'"))[0].total, 0);
  assert.equal((await rows('SELECT status FROM gateway_payments'))[0].status, 'pending');
  await rows('DELETE FROM account_ledger WHERE id = ?', [bad.insertId]);
  assert.equal((await signedPaymentWebhook(first.reference)).status, 200);
  assert.equal((await account()).summary.totalPaidCents, 5025);
});

test('payments: staff verification is authorised, does not charge again and rejects stale financial roles', async () => {
  const access = await checkoutFixture(); const first = await checkout().initiate(access.token, checkoutInput()); gatewayMode = 'success';
  const [row] = await rows('SELECT id FROM gateway_payments WHERE reference = ?', [first.reference]);
  assert.equal((await http(`/billing/gateway-payments/${row.id}/verify`, { role: 'Customer', method: 'POST', body: {} })).status, 403);
  assert.equal((await http(`/billing/gateway-payments/${row.id}/verify`, { method: 'POST', body: {} })).body.code, 1);
  assert.equal(gatewayRequests.filter((request) => request.url.endsWith('/charge')).length, 1);
  assert.equal((await account()).summary.totalPaidCents, 5025);
  await rows("UPDATE users SET role = 'Driver' WHERE id = 1");
  assert.equal((await http('/billing/payments')).status, 403);
});

test('payments: declined and unconfigured payments never produce a payment receipt or credit', async () => {
  const access = await checkoutFixture(); gatewayMode = 'failed';
  const result = await checkout().initiate(access.token, checkoutInput());
  assert.equal(result.status, 'failed'); assert.equal(result.receipt, undefined); assert.equal(await count('account_ledger'), 0);
  gatewaySecret = '';
  const calls = gatewayRequests.length;
  await assert.rejects(() => checkout().initiate(access.token, checkoutInput()), /not configured/);
  assert.equal(gatewayRequests.length, calls);
});
