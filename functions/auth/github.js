import handler from '../_lib/app.js';

export async function GET(request, context) {
  return handler(request, context);
}
