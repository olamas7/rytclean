// Lightweight render checks using existing dependencies; no test framework required.
// Run from client/: node scripts/check-shared-ui.cjs
const { build } = require('esbuild');
const Module = require('module');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const assert = require('assert/strict');

async function checkSharedUi() {
  const result = await build({
    stdin: {
      contents: "export * from './src/utils/controls/Tables.jsx'; export * from './src/ui-component/PageLayout.jsx'; export * from './src/utils/myButtons.jsx'; export * from './src/utils/formatters.js';",
      resolveDir: process.cwd(),
      loader: 'jsx'
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    jsx: 'automatic',
    alias: { 'ui-component': path.resolve('src/ui-component'), utils: path.resolve('src/utils') }
  });
  const compiled = new Module(path.resolve('shared-smoke.cjs'), module);
  compiled.filename = path.resolve('shared-smoke.cjs');
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  const { AppTable, TableFilter, PageHeader, FormActions, LdButton, formatCurrency, formatDate } = compiled.exports;
  const props = { columns: [{ id: 'name', label: 'Customer', sortable: true }], rows: [{ id: 1, name: 'Ama' }], ariaLabel: 'Customers' };
  const render = (Component, values) => renderToStaticMarkup(React.createElement(Component, values));

  const table = render(AppTable, props);
  assert.match(table, /<table/);
  assert.match(table, /Ama/);
  assert.doesNotMatch(table, /MuiDataGrid/);
  assert.match(render(AppTable, { ...props, rows: [] }), /No records yet/);
  assert.match(render(AppTable, { ...props, error: 'Unable to load', onRetry() {} }), /Try again/);
  assert.match(render(AppTable, { ...props, loading: true }), /aria-busy="true"/);
  const many = render(AppTable, { ...props, rows: Array.from({ length: 12 }, (_, index) => ({ id: index, name: `Customer-${index}` })) });
  assert.match(many, /Customer-9/);
  assert.doesNotMatch(many, />Customer-10</);
  assert.match(render(LdButton, { loading: true, children: 'Save' }), /disabled/);
  assert.match(render(TableFilter, { label: 'Zones', value: 'all', options: [], onChange() {}, disabled: true }), /aria-disabled="true"/);
  assert.match(render(LdButton, { children: 'Cancel' }), /type="button"/);
  assert.match(render(FormActions, { loading: true, onCancel() {} }), /type="submit"/);
  assert.match(render(PageHeader, { title: 'Customers' }), /<h1/);
  assert.equal(formatCurrency(null), '—');
  assert.match(formatCurrency(125), /125\.00/);
  assert.equal(formatDate('invalid'), '—');
  assert.match(formatDate('2026-11-03'), /03 Nov 2026/);
  console.log('Shared UI checks passed: table rendering, initial pagination, loading/empty/error states, buttons, header and formatters.');
}

checkSharedUi().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
