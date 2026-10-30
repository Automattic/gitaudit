#!/usr/bin/env node
// Runs the Functions app locally on port 3001, against the MariaDB from `npm run db:start`.
// `sf dev` can't run workers, and this lets the Vite dev server proxy to it as usual.
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import dotenv from 'dotenv';
import handler from '../functions/_lib/app.js';
import * as mcp from '../functions/mcp.js';
import { createLocalDb } from './local-db.mjs';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

const port = 3001;
const env = {
  ...process.env,
  DB: createLocalDb(process.env.LOCAL_DB_URL ?? 'mysql://root:codevitals@127.0.0.1:3307/codevitals'),
};

createServer(async (incoming, outgoing) => {
  const hasBody = !['GET', 'HEAD'].includes(incoming.method);
  const request = new Request(`http://${incoming.headers.host}${incoming.url}`, {
    method: incoming.method,
    headers: incoming.headers,
    body: hasBody ? Readable.toWeb(incoming) : undefined,
    duplex: hasBody ? 'half' : undefined,
  });

  // On Spacefast the file router picks the route, and answers 405 for the rest
  const isMcp = new URL(request.url).pathname === '/mcp';
  const route = isMcp ? mcp[request.method] ?? (() => new Response(null, { status: 405 })) : handler;

  const response = await route(request, { env, params: {} });
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`Functions running on http://localhost:${port}`));
