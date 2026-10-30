// Assemble what Spacefast publishes: the built client at the root, and each worker
// route bundled into one file, so nothing else has to ship beside it.
import { build } from 'esbuild';
import { cpSync, globSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'dist-spacefast');

// Assistants look here for a sign-in server before connecting to an MCP server. These
// paths would otherwise get the app's page and a 200, which reads as a broken sign-in
// server rather than as there not being one. Spacefast ignores `.well-known` under
// functions/, so these can't be a route. Other `.well-known` paths are left alone.
const NO_SIGN_IN_SERVER = [
  '/.well-known/oauth-protected-resource',
  '/.well-known/oauth-protected-resource/*',
  '/.well-known/oauth-authorization-server',
  '/.well-known/oauth-authorization-server/*',
  '/.well-known/openid-configuration',
  '/.well-known/openid-configuration/*',
];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

cpSync(path.join(root, 'client/dist'), out, { recursive: true });
cpSync(path.join(root, 'sf.jsonc'), path.join(out, 'sf.jsonc'));

writeFileSync(path.join(out, 'not-found.json'), '{"error":"Not found"}\n');
writeFileSync(
  path.join(out, '_redirects'),
  NO_SIGN_IN_SERVER.map((source) => `${source} /not-found.json 404\n`).join('')
);

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
  // Without this, the MCP SDK resolves to its Node build
  conditions: ['workerd'],
  // Spacefast doesn't detect a route's exports if a comment follows them
  legalComments: 'none',
  target: 'es2022',
  logLevel: 'warning',
});

console.log(`Assembled ${out} with ${routes.length} routes`);
