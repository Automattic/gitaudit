import { handleMcp } from './_lib/mcp/handler.js';
import { redirect } from './_lib/http.js';

// Separate from functions/api so that only this route carries the MCP SDK

export async function POST(request, { env }) {
  return handleMcp(request, env);
}

// MCP has no use for GET. Someone who pastes the server's address into a browser gets
// the page about it instead of an error.
export async function GET(request) {
  if (request.headers.get('accept')?.includes('text/html')) {
    return redirect('/connect');
  }
  return new Response(null, { status: 405, headers: { allow: 'POST' } });
}
