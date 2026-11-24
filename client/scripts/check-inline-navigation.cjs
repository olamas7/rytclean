// Focused in-memory render/navigation checks; no production build or API calls.
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
      export { default as InlineNavigation } from './src/ui-component/InlineNavigation';
      export { PageHeader } from './src/ui-component/PageLayout';
      export { inlineDestination, inlineParent, inlineView } from './src/utils/useInlineNavigation';
      export { default as Settings } from './src/views/Management/Admin/Settings';
      export { default as Customers } from './src/views/Management/Admin/CustomerManagement';
      export { default as Billing } from './src/views/Management/Accountant/BillingWorkspace';
      export { default as Account } from './src/views/Management/Accountant/CustomerAccount';
      export { default as Users } from './src/views/Management/Admin/UserManager';
      export { default as Configuration } from './src/views/Admin/Configuration';
      export { default as Zones } from './src/views/Management/Admin/ZonesRoutes';
      export { default as Drivers } from './src/views/Management/Admin/DriverAssignment';
      export { appMenuGroups } from './src/menu-items/admin';
    `, resolveDir: process.cwd(), loader: 'jsx' },
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
    define: { 'import.meta.env': '{}' },
    alias: Object.fromEntries(['constants', 'services', 'ui-component', 'utils'].map((name) => [name, path.resolve('src', name)]))
  });
  const compiled = new Module(path.resolve('inline-navigation-smoke.cjs'), module);
  compiled.filename = path.resolve('inline-navigation-smoke.cjs');
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  const ui = compiled.exports;
  const previousStorage = global.localStorage;
  global.localStorage = { getItem: (key) => key === 'admin_role' ? 'Admin' : null };
  const render = (Component, location = '/', props = {}) => renderToStaticMarkup(React.createElement(StaticRouter, { location }, React.createElement(Component, props)));
  try {
    const sections = { new: { label: 'New' }, account: { label: 'Account', contextKeys: ['customer'] }, payment: { label: 'Payment', parent: 'account' } };
    const configuration = { sections, parameter: 'view', contextKeys: ['customer'] };
    const root = { pathname: '/customers', search: '?status=active&tab=payments', hash: '#clients', state: { source: 'customers' } };
    const child = ui.inlineDestination(root, configuration, 'account', { customer: '12345' });
    assert.equal(child.pathname, root.pathname);
    assert.equal(child.hash, '#clients');
    assert.equal(new URLSearchParams(child.search).get('tab'), 'payments');
    assert.equal(new URLSearchParams(child.search).get('status'), 'active');
    assert.equal(new URLSearchParams(child.search).get('customer'), '12345');
    assert.equal(ui.inlineView(child.search, 'view', sections), 'account');
    assert.equal(ui.inlineView('?view=invalid', 'view', sections), '');
    assert.throws(() => ui.inlineDestination(root, configuration, 'invalid'));
    const noOrigin = ui.inlineParent(child, configuration);
    assert.equal(noOrigin.fromInline, false);
    assert.equal(new URLSearchParams(noOrigin.target.search).has('customer'), false);
    assert.equal(noOrigin.target.pathname, root.pathname);
    const tracked = { ...child, state: { rytcleanInlineOrigin: { ...root, parameter: 'view', view: '' } } };
    const parent = ui.inlineParent(tracked, configuration);
    assert.equal(parent.fromInline, true);
    assert.equal(parent.target.search, root.search);
    assert.equal(parent.state.source, 'customers');
    assert.equal(ui.inlineParent({ ...tracked, pathname: '/elsewhere' }, configuration).fromInline, false);
    const nested = ui.inlineDestination(child, configuration, 'payment', { customer: '12345' });
    assert.equal(new URLSearchParams(ui.inlineParent(nested, configuration).target.search).get('view'), 'account');
    assert.equal(new URLSearchParams(ui.inlineParent(nested, configuration).target.search).get('customer'), '12345');
    assert.equal(render(ui.InlineNavigation, '/', { active: false, onBack() {} }), '');
    assert.equal(render(ui.InlineNavigation, '/', { active: true }), '');
    const back = render(ui.InlineNavigation, '/', { active: true, parentLabel: 'Customers', onBack() {}, disabled: true });
    assert.match(back, /Back to Customers/);
    assert.match(back, /disabled/);
    assert.match(back, /aria-label="Inline section navigation"/);
    assert.doesNotMatch(render(ui.PageHeader, '/', { title: 'Root Page' }), /Inline section navigation/);
    const settingsRoot = render(ui.Settings, '/settings');
    assert.doesNotMatch(settingsRoot, /Inline section navigation/);
    assert.match(render(ui.Settings, '/settings?section=plans'), /Back to Settings/);
    assert.match(render(ui.Settings, '/settings?section=billing'), /Back to Settings/);
    assert.match(render(ui.Settings, '/settings?section=new-plan'), /Back to Plan Settings/);
    assert.match(render(ui.Settings, '/settings?section=edit-plan&plan=1'), /Back to Plan Settings/);
    assert.match(render(ui.Customers, '/customers?view=new'), /Back to Customers/);
    assert.match(render(ui.Customers, '/customers?view=edit&customer=12345'), /Back to Customers/);
    assert.match(render(ui.Customers, '/customers?view=account&customer=12345'), /Back to Customers/);
    assert.doesNotMatch(render(ui.Billing, '/billing'), /Inline section navigation/);
    assert.match(render(ui.Billing, '/billing?view=account&customer=12345'), /Back to Client Billing/);
    assert.match(render(ui.Account, '/billing?view=account&customer=12345&action=payment', { customerId: '12345' }), /Back to Customer Account/);
    assert.match(render(ui.Users, '/users?view=new'), /Back to User Manager/);
    assert.match(render(ui.Configuration, '/configuration?view=new-category'), /Back to Client Categories/);
    assert.match(render(ui.Zones, '/zones?view=new-zone'), /Back to Zones &amp; Routes/);
    assert.match(render(ui.Drivers, '/drivers?view=new-driver'), /Back to Driver Assignment/);
    assert.match(render(ui.Drivers, '/drivers?fleetView=assignment'), /Back to Route Assignments &amp; Vehicles/);
    const manager = ui.appMenuGroups.flatMap((group) => group.children).find((item) => item.id === 'management-manager');
    assert.equal(manager.children.at(-1).id, 'admin-settings');
    assert.equal(manager.children.some((item) => item.id === 'admin-dashboard'), false);
    console.log('Inline navigation checks passed: hidden root controls, shared/disabled Back, parent fallbacks, preserved query/hash, nested/direct links, form/detail rendering and Settings last in Manager. No API calls.');
  } finally {
    if (previousStorage === undefined) delete global.localStorage;
    else global.localStorage = previousStorage;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
