import express from 'express';
import jwt from 'jsonwebtoken';
import { exchangeCodeForToken, getAuthenticatedUser } from '../services/github.js';
import { userQueries } from '../db/queries.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GitHub App OAuth login - redirect to GitHub
// Note: Permissions are defined in the GitHub App settings, not via scope parameter
router.get('/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${req.protocol}://${req.get('host')}/auth/github/callback`;
  const state = req.query.state || ''; // Preserve the intended redirect destination

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

  res.redirect(githubAuthUrl);
});

// GitHub OAuth callback
router.get('/github/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=no_code`);
  }

  try {
    // Exchange code for access token
    const accessToken = await exchangeCodeForToken(code);

    // Get user info from GitHub
    const githubUser = await getAuthenticatedUser(accessToken);

    // Check if user exists in database
    let user = userQueries.findByGithubId.get(githubUser.databaseId);

    if (user) {
      // Update access token
      userQueries.updateAccessToken.run(accessToken, githubUser.databaseId);
      user = userQueries.findByGithubId.get(githubUser.databaseId);
    } else {
      // Create new user
      user = userQueries.create.get(
        githubUser.databaseId,
        githubUser.login,
        accessToken
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      { githubId: user.github_id, username: user.username },
      process.env.SESSION_SECRET,
      { expiresIn: '30d' }
    );

    // Redirect to client with token, preserving the intended destination
    const stateParam = state ? `&from=${encodeURIComponent(state)}` : '';
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}${stateParam}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
  }
});

// Verify token endpoint
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      githubId: req.user.githubId,
      username: req.user.username,
    },
  });
});

export default router;
