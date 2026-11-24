// In-memory component compilation/render checks, not a production build.
const { build } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { StaticRouter } = require('react-router-dom/server');

async function main() {
  const result = await build({
    stdin: { contents: "export { default as SmsNotifications } from './src/views/Management/Admin/SmsNotifications'; export { default as SmsSettings } from './src/views/Admin/SmsSettings'; export { appRoutes } from './src/constants/appRoutes'; export { allAppPages } from './src/constants/appPages';", resolveDir: process.cwd(), loader: 'jsx' },
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
    alias: Object.fromEntries(['constants', 'services', 'ui-component', 'utils'].map((name) => [name, path.resolve('src', name)]))
  });
  const compiled = new Module(path.resolve('sms-smoke.cjs'), module);
  compiled.filename = path.resolve('sms-smoke.cjs');
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  const { SmsNotifications, SmsSettings, appRoutes, allAppPages } = compiled.exports;
  const previousStorage = global.localStorage;
  let role = 'Manager';
  global.localStorage = { getItem: (key) => key === 'admin_role' ? role : null };
  const render = (Component, location) => renderToStaticMarkup(React.createElement(StaticRouter, { location }, React.createElement(Component)));
  try {
    assert.ok(allAppPages.some((page) => page.path === appRoutes.management.admin.sms));
    const bulk = render(SmsNotifications, appRoutes.management.admin.sms);
    assert.match(bulk, /Bulk SMS/);
    assert.match(bulk, /Notification History/);
    assert.match(bulk, /Loading SMS options/);
    const history = render(SmsNotifications, `${appRoutes.management.admin.sms}?tab=history`);
    assert.match(history, /SMS notification history/);
    assert.match(history, /<table/);
    assert.doesNotMatch(history, /MuiDataGrid/);
    role = 'Driver';
    assert.match(render(SmsNotifications, appRoutes.management.admin.sms), /Manager or administrator access is required/);
    assert.doesNotMatch(render(SmsNotifications, appRoutes.management.admin.sms), /SMS API Host/);
    role = 'Admin';
    const configuration = render(SmsSettings, appRoutes.admin.configuration);
    assert.match(configuration, /View Notification History/);
    assert.doesNotMatch(configuration, /<table/);
    assert.doesNotMatch(configuration, /Latest 100 SMS/);
    console.log('SMS UI checks passed: registered route, tabs, loading/history table, role guard and history removed from settings. No API calls or SMS sends.');
  } finally {
    if (previousStorage === undefined) delete global.localStorage;
    else global.localStorage = previousStorage;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
