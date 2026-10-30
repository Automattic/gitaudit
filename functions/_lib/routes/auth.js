import { createSessionToken, authenticate } from '../auth.js';
import { exchangeCodeForToken, getAuthenticatedUser } from '../github.js';
import { json, redirect } from '../http.js';
import { saveUser } from '../queries.js';

// Only local development has its client on a different origin
const clientUrl = ({ env, url }) => env.CLIENT_URL || url.origin;

export function authRoutes(router) {
  // GitHub App OAuth login - redirect to GitHub
  // Note: Permissions are defined in the GitHub App settings, not via scope parameter
  router.get('/auth/github', ({ env, url, query }) => {
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: `${url.origin}/auth/github/callback`,
      state: query.get('state') ?? '', // Preserve the intended redirect destination
    });
    return redirect(`https://github.com/login/oauth/authorize?${params}`);
  });

  router.get('/auth/github/callback', async (context) => {
    const { env, db, query } = context;
    const client = clientUrl(context);
    const code = query.get('code');
    const state = query.get('state');

    if (!code) {
      return redirect(`${client}/login?error=no_code`);
    }

    try {
      const { accessToken, refreshToken, expiresIn } = await exchangeCodeForToken(env, code);
      const githubUser = await getAuthenticatedUser(accessToken);

      const user = await saveUser(db, {
        githubId: githubUser.databaseId,
        username: githubUser.login,
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
      });

      const token = await createSessionToken(user, env.SESSION_SECRET);

      // Redirect to client with token, preserving the intended destination
      const from = state ? `&from=${encodeURIComponent(state)}` : '';
      return redirect(`${client}/auth/callback?token=${token}${from}`);
    } catch (error) {
      console.error('OAuth callback error:', error);
      return redirect(`${client}/login?error=auth_failed`);
    }
  });

  router.get('/auth/verify', authenticate, ({ user }) =>
    json({
      user: { id: user.id, githubId: Number(user.github_id), username: user.username },
    })
  );
}
