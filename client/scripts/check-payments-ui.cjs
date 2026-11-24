// In-memory render/receipt checks. No application API or payment-provider calls.
const { build } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { StaticRouter } = require('react-router-dom/server');
async function main() {
    const result = await build({
        stdin: { contents: `
            export { default as Checkout } from './src/views/Customer/CustomerPaymentCheckout';
            export { default as Payments } from './src/views/Customer/CustomerPayments';
            export { default as Billing } from './src/views/Management/Accountant/BillingWorkspace';
            export { printPaymentReceipt, printSubscriptionBill } from './src/utils/accountPrinting';
            export { paymentMethods, paymentMethodLabel, paymentSourceLabel } from './src/utils/paymentMethods';
        `, resolveDir: process.cwd(), loader: 'jsx' },
        bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', define: { 'import.meta.env': '{}' },
        alias: Object.fromEntries(['constants', 'services', 'ui-component', 'utils', 'views'].map((name) => [name, path.resolve('src', name)]))
    });
    const compiled = new Module(path.resolve('payments-smoke.cjs'), module);
    compiled.filename = path.resolve('payments-smoke.cjs'); compiled.paths = module.paths;
    compiled._compile(result.outputFiles[0].text, compiled.filename);
    const ui = compiled.exports;
    const previous = { localStorage: global.localStorage, sessionStorage: global.sessionStorage, window: global.window };
    global.localStorage = { getItem: () => 'Admin' }; global.sessionStorage = { getItem: () => null };
    let document = ''; let printed = false;
    const render = (Component, location, props) => renderToStaticMarkup(React.createElement(StaticRouter, { location }, React.createElement(Component, props)));
    try {
        const root = render(ui.Checkout, '/pay');
        assert.match(root, /Customer Payment/); assert.match(root, /\*412\*99#/); assert.match(root, /not yet automatically received or reconciled/);
        assert.match(root, /Loading payment options/); assert.doesNotMatch(root, /Inline section navigation/);
        assert.match(render(ui.Checkout, '/pay?view=pay'), /Back to Customer Payment/);
        assert.match(render(ui.Checkout, '/pay?view=status&reference=ryt_test'), /Back to Pay Customer/);
        assert.match(render(ui.Payments, '/customer/payments'), /\*412\*99#/);
        const billing = render(ui.Billing, '/billing', { initialTab: 'payments' });
        assert.match(billing, /Paystack Transactions/); assert.match(billing, /Payments \/ Receipts/);
        assert.match(billing, /staff-recorded/);
        assert.deepEqual(ui.paymentMethods.map((item) => item.value).sort(), ['bank_transfer', 'bank_wire', 'cash', 'cheque', 'mobile_money', 'other']);
        assert.equal(ui.paymentMethodLabel('paystack'), 'Paystack (Online)');
        assert.match(ui.paymentSourceLabel({ source: 'staff', collectorName: 'ACCOUNTANT' }), /ACCOUNTANT/);
        global.window = { open: () => ({ document: { write: (value) => { document = value; }, close() {} }, focus() {}, print: () => { printed = true; } }) };
        const customer = { id: '12345', fullName: 'AMA <script>BOATENG</script>' };
        const entry = { id: '42', date: '2026-11-04', creditCents: 5025, method: 'cheque', reference: 'CHQ-1', source: 'staff', collectorName: 'ACCOUNTANT', description: 'Payment received' };
        ui.printPaymentReceipt(customer, entry);
        assert.equal(printed, true); assert.match(document, /RCPT-42/); assert.match(document, /ACCOUNTANT/); assert.match(document, /Cheque/); assert.match(document, /\*412\*99#/); assert.doesNotMatch(document, /<script>/);
        ui.printPaymentReceipt(customer, { ...entry, source: 'paystack', method: 'paystack', collectorName: null });
        assert.match(document, /Client online/); assert.doesNotMatch(document, /ACCOUNTANT/);
        ui.printPaymentReceipt(customer, { ...entry, testPayment: true }); assert.match(document, /TEST ONLY — NOT A PAYMENT RECEIPT/);
        ui.printPaymentReceipt(customer, { ...entry, reversed: true }); assert.match(document, /REVERSED/);
        ui.printSubscriptionBill(customer, { reference: 'INV-202611-12345', plan_name: 'Home', issuedOn: '2026-12-01', dueOn: '2026-12-05', serviceStart: '2026-11-01', periodEnd: '2026-11-30', first_month_policy: 'full_month', amountCents: 12000, settledCents: 0, outstandingCents: 12000, status: 'unpaid' });
        assert.match(document, /INV-202611-12345/);
        assert.match(fs.readFileSync('src/routes/index.jsx', 'utf8'), /path: '\/pay'/);
        const source = fs.readFileSync('src/views/Customer/CustomerPaymentCheckout.jsx', 'utf8');
        for (const field of ['Five-digit Customer ID', 'Amount (GHS)', 'Payment Phone Number', 'Mobile Money Network', 'Payment Contact Email', 'One-time Password (OTP)', 'Print / Save Receipt']) assert.ok(source.includes(field), field);
        assert.doesNotMatch(source, /liveConfirmed|LIVE PAYMENTS|I understand this is|Names are masked/);
        assert.match(source, /\{access\.displayName\} · \{access\.customerId\}/);
        assert.doesNotMatch(source, /sk_live_|sk_test_/);
        console.log('Payment UI checks passed: public/portal loading, USSD notice, inline parents, staff/Paystack tabs, methods, escaped receipts, collector/source, test/reversal labels and invoice printing. No API or provider calls.');
    } finally { Object.assign(global, previous); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
