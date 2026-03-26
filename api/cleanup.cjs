// Post-bundle cleanup: keep only @azure/functions + its deps (everything else is bundled)
const fs = require('fs');
const path = require('path');

const NM = 'node_modules';

function rm(d) {
  if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
}

// Build a set of packages to keep: @azure/functions and all its transitive deps
function collectDeps(pkgName, keep = new Set()) {
  if (keep.has(pkgName)) return keep;
  keep.add(pkgName);
  
  // Try to read package.json for this dep
  const pkgJsonPath = path.join(NM, ...pkgName.split('/'), 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    for (const dep of Object.keys(pkg.dependencies || {})) {
      collectDeps(dep, keep);
    }
  }
  return keep;
}

const KEEP = collectDeps('@azure/functions');
console.log('Keeping packages:', [...KEEP].join(', '));

// Remove everything not in KEEP
if (fs.existsSync(NM)) {
  for (const entry of fs.readdirSync(NM)) {
    if (entry.startsWith('.')) { rm(path.join(NM, entry)); continue; }
    if (entry.startsWith('@')) {
      const scopeDir = path.join(NM, entry);
      for (const sub of fs.readdirSync(scopeDir)) {
        const full = `${entry}/${sub}`;
        if (!KEEP.has(full)) rm(path.join(scopeDir, sub));
      }
      if (fs.readdirSync(scopeDir).length === 0) rm(scopeDir);
    } else if (!KEEP.has(entry)) {
      rm(path.join(NM, entry));
    }
  }
}

// Remove source maps from dist
const funcDir = path.join('dist', 'src', 'functions');
if (fs.existsSync(funcDir)) {
  for (const f of fs.readdirSync(funcDir)) {
    if (f.endsWith('.map')) rm(path.join(funcDir, f));
  }
}
rm(path.join('dist', 'src', 'cosmosClient.js'));
rm(path.join('dist', 'src', 'cosmosClient.js.map'));

const remaining = fs.existsSync(NM)
  ? fs.readdirSync(NM, { recursive: true }).length
  : 0;
console.log(`Post-bundle cleanup done (${remaining} items in node_modules)`);
