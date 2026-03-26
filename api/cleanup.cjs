// Post-bundle cleanup: keep only @azure/functions (everything else is bundled)
const fs = require('fs');
const path = require('path');

const NM = 'node_modules';

// Whitelist: only keep @azure/functions and its direct dependencies
const KEEP = new Set([
  '@azure/functions',
  '@azure/functions-extensions-base',
]);

function rm(d) {
  if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
}

// Remove everything not in KEEP
if (fs.existsSync(NM)) {
  for (const entry of fs.readdirSync(NM)) {
    if (entry.startsWith('.')) { rm(path.join(NM, entry)); continue; }
    if (entry.startsWith('@')) {
      // Scoped package directory
      const scopeDir = path.join(NM, entry);
      for (const sub of fs.readdirSync(scopeDir)) {
        const full = `${entry}/${sub}`;
        if (!KEEP.has(full)) rm(path.join(scopeDir, sub));
      }
      // Remove empty scope dirs
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

console.log('Post-bundle cleanup done');
