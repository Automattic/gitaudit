/** An error a route can throw to answer with a specific status. */
export class HttpError extends Error {
  constructor(status, error, extra = {}) {
    super(error);
    this.status = status;
    this.body = { error, ...extra };
  }
}

export const json = (body, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export const noContent = () => new Response(null, { status: 204 });

export const redirect = (url) =>
  new Response(null, { status: 302, headers: { location: url } });

/** A request's JSON body, or an empty object when it has none. */
export async function readJson(request) {
  const text = await request.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}
