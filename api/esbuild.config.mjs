import * as esbuild from 'esbuild';
import { readdirSync } from 'fs';
import { join } from 'path';

// Bundle each compiled function into a single file with all deps inlined
const functionsDir = join('dist', 'src', 'functions');
const entries = readdirSync(functionsDir)
  .filter(f => f.endsWith('.js'))
  .map(f => join(functionsDir, f));

await esbuild.build({
  entryPoints: entries,
  bundle: true,
  platform: 'node',
  target: 'node20',
  outdir: join('dist', 'src', 'functions'),
  allowOverwrite: true,
  format: 'cjs',
  external: ['@azure/functions'],
  minify: true,
});

console.log('API functions bundled successfully');
