import { HttpError, json } from './http.js';

function compile(pattern) {
  const keys = [];
  const source = pattern.replace(/:([a-zA-Z]+)/g, (_, key) => {
    keys.push(key);
    return '([^/]+)';
  });
  return { regex: new RegExp(`^${source}$`), keys };
}

/**
 * Routes are tried in the order they're added, so a static path has to come before
 * a dynamic one that would also match it. A handler ends the request by returning
 * a Response, or passes it to the next handler by returning nothing.
 */
export function createRouter() {
  const routes = [];
  const add = (method) => (pattern, ...handlers) => {
    routes.push({ method, ...compile(pattern), handlers });
  };

  async function handle(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const route = routes.find((r) => r.method === request.method && r.regex.test(path));

    if (!route) {
      return json({ error: 'Not found' }, 404);
    }

    const values = route.regex.exec(path).slice(1).map(decodeURIComponent);
    const context = {
      request,
      env,
      db: env.DB,
      url,
      query: url.searchParams,
      params: Object.fromEntries(route.keys.map((key, index) => [key, values[index]])),
    };

    try {
      for (const handler of route.handlers) {
        const response = await handler(context);
        if (response) return response;
      }
      throw new Error(`${request.method} ${url.pathname} returned no response`);
    } catch (error) {
      if (error instanceof HttpError) {
        return json(error.body, error.status);
      }
      console.error(`[API] ${request.method} ${url.pathname} failed:`, error);
      return json({ error: 'Internal server error' }, 500);
    }
  }

  return {
    get: add('GET'),
    post: add('POST'),
    put: add('PUT'),
    patch: add('PATCH'),
    delete: add('DELETE'),
    handle,
  };
}
