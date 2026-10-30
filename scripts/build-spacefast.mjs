// Assemble what Spacefast publishes: the built client at the root, and each worker
// route bundled into one file, so nothing else has to ship beside it.
import { build } from 'esbuild';
import { cpSync, globSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'dist-spacefast');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

cpSync(path.join(root, 'client/dist'), out, { recursive: true });
cpSync(path.join(root, 'sf.jsonc'), path.join(out, 'sf.jsonc'));

// Routes only: anything under `_lib` is a helper, and gets inlined into the routes
const routes = globSync('functions/**/*.js', { cwd: root }).filter(
  (file) => !file.split(path.sep).includes('_lib')
);

await build({
  entryPoints: routes.map((file) => path.join(root, file)),
  outdir: path.join(out, 'functions'),
  outbase: path.join(root, 'functions'),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  logLevel: 'warning',
});

console.log(`Assembled ${out} with ${routes.length} routes`);
