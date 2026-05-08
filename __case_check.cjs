'use strict';
/* DEV-ONLY case-sensitivity audit. Walks the repo, lists files, and
 * checks every relative import for a casing mismatch against disk.
 * Linux/cPanel deployments fail hard on these but Windows does not.
 *
 * Run from the project root: `node __case_check.js`
 */
const fs = require('fs');
const path = require('path');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', 'uploads', 'logs'].includes(e.name)) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(f));
    else if (/\.(jsx?|tsx?|cjs|mjs)$/.test(e.name)) out.push(f);
  }
  return out;
}

const root = path.resolve(__dirname);
const files = walk(root).map((f) => f.replace(/\\/g, '/'));
console.log('Source files scanned:', files.length);

// 1) Look for two files differing only in case in the same dir.
const collisions = new Map();
for (const f of files) {
  const lo = f.toLowerCase();
  if (collisions.has(lo) && collisions.get(lo) !== f) {
    console.log('CASE COLLISION:', f, '<->', collisions.get(lo));
  }
  collisions.set(lo, f);
}

// 2) Walk every import and verify the resolved path matches disk casing.
const fileSet = new Set(files);
const fileLowerToReal = new Map();
for (const f of files) fileLowerToReal.set(f.toLowerCase(), f);

let mismatches = 0;
for (const f of files) {
  const code = fs.readFileSync(f, 'utf8');
  const dir = path.dirname(f).replace(/\\/g, '/');
  const re = /(?:from|require\()\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(code))) {
    let imp = m[1];
    if (!imp.startsWith('.')) continue; // skip bare/package imports
    const candidates = [imp, imp + '.js', imp + '.jsx', imp + '/index.js', imp + '/index.jsx'];
    let matched = false;
    for (const cand of candidates) {
      const abs = path.normalize(dir + '/' + cand).replace(/\\/g, '/');
      if (fileSet.has(abs)) { matched = true; break; }
      const real = fileLowerToReal.get(abs.toLowerCase());
      if (real && real !== abs) {
        console.log('CASE MISMATCH in', f.replace(root + '/', ''));
        console.log('  import "' + imp + '" resolves to', abs.replace(root + '/', ''));
        console.log('  but disk has',                   real.replace(root + '/', ''));
        mismatches++;
        matched = true;
        break;
      }
    }
    // Unmatched imports are usually package imports we skipped; ignore.
  }
}

console.log('Total case mismatches in imports:', mismatches);
if (mismatches > 0) process.exit(1);
process.exit(0);
