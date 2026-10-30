// Session tokens, signed with HS256. A worker has WebCrypto rather than node:crypto.
const encoder = new TextEncoder();

const toBase64Url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromBase64Url = (text) =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const encodeJson = (value) => toBase64Url(encoder.encode(JSON.stringify(value)));

const hmacKey = (secret) =>
  crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);

export async function signToken(payload, secret, expiresInSeconds) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const body = `${encodeJson({ alg: 'HS256', typ: 'JWT' })}.${encodeJson({
    ...payload,
    iat: issuedAt,
    exp: issuedAt + expiresInSeconds,
  })}`;
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(body));
  return `${body}.${toBase64Url(signature)}`;
}

/** @returns {Promise<object>} The token's payload. Throws if it isn't valid. */
export async function verifyToken(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('jwt malformed');

  const [header, payload, signature] = parts;
  let claims;
  let algorithm;
  let signatureBytes;

  try {
    algorithm = JSON.parse(atob(header.replace(/-/g, '+').replace(/_/g, '/'))).alg;
    claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    signatureBytes = fromBase64Url(signature);
  } catch {
    throw new Error('jwt malformed');
  }

  if (algorithm !== 'HS256') throw new Error('invalid algorithm');

  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    signatureBytes,
    encoder.encode(`${header}.${payload}`)
  );
  if (!valid) throw new Error('invalid signature');

  if (claims.exp !== undefined && Date.now() / 1000 >= claims.exp) {
    throw new Error('jwt expired');
  }

  return claims;
}
