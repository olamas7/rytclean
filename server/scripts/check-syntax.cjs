// Parse server source without starting the app or connecting to the database.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const excluded = new Set(['node_modules', 'images', 'uploads', '.git']);
let checked = 0;
let failed = 0;

function check(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory() && !excluded.has(entry.name)) check(filename);
    else if (entry.isFile() && /\.(js|cjs)$/.test(entry.name)) {
      checked += 1;
      try { new vm.Script(fs.readFileSync(filename, 'utf8'), { filename }); }
      catch (error) { failed += 1; console.error(`${path.relative(root, filename)}: ${error.message}`); }
    }
  }
}

check(root);
console.log(`Server syntax: ${checked} files checked, ${failed} errors.`);
process.exitCode = failed ? 1 : 0;
