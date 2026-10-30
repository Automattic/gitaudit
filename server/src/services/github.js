import { graphql } from '@octokit/graphql';

// Create GitHub GraphQL client with user token
export function createGitHubClient(accessToken) {
  return graphql.defaults({
    headers: {
      authorization: `token ${accessToken}`,
    },
  });
}

// Exchange OAuth code for access token (and refresh token for GitHub Apps)
export async function exchangeCodeForToken(code) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresIn: data.expires_in || null,
  };
}

/**
 * Refresh an expired GitHub App user access token
 * @param {string} refreshToken - The refresh token from the initial OAuth flow
 * @returns {Promise<{accessToken: string, refreshToken: string, expiresIn: number}>}
 */
export async function refreshAccessToken(refreshToken) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Get a valid access token for a user, refreshing if expired.
 * For legacy users (no refresh_token), returns existing token as-is.
 * @param {object} user - User row from database (must have id, access_token, refresh_token, token_expires_at)
 * @returns {Promise<string>} A valid access token
 */
export async function getValidAccessToken(user) {
  // Legacy user without refresh token — return as-is
  if (!user.refresh_token) {
    return user.access_token;
  }

  // Check if token is still valid (with 5-minute buffer)
  if (user.token_expires_at) {
    const expiresAt = new Date(user.token_expires_at).getTime();
    const bufferMs = 5 * 60 * 1000;
    if (Date.now() < expiresAt - bufferMs) {
      return user.access_token;
    }
  }

  // Token expired or no expiry recorded — refresh it
  console.log(`[TokenRefresh] Refreshing expired token for user ${user.id} (${user.username})`);

  const { userQueries } = await import('../db/queries.js');
  const tokens = await refreshAccessToken(user.refresh_token);
  const newExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

  userQueries.updateTokens.run(
    tokens.accessToken,
    tokens.refreshToken,
    newExpiresAt,
    user.id
  );

  console.log(`[TokenRefresh] Token refreshed for user ${user.id}, expires at ${newExpiresAt}`);

  return tokens.accessToken;
}

// Get authenticated user info
export async function getAuthenticatedUser(accessToken) {
  const client = createGitHubClient(accessToken);

  const { viewer } = await client(`
    query {
      viewer {
        id
        databaseId
        login
        name
        email
      }
    }
  `);

  return viewer;
}

// Fetch user's accessible repositories (personal + organizations)
export async function fetchUserRepositories(accessToken, first = 100, after = null) {
  const client = createGitHubClient(accessToken);

  // Fetch repositories with all possible affiliations
  const query = `
    query($first: Int!, $after: String) {
      viewer {
        repositories(
          first: $first,
          after: $after,
          orderBy: {field: UPDATED_AT, direction: DESC},
          affiliations: [OWNER, ORGANIZATION_MEMBER, COLLABORATOR],
          ownerAffiliations: [OWNER, ORGANIZATION_MEMBER, COLLABORATOR]
        ) {
          pageInfo {
            hasNextPage
            endCursor
          }
          totalCount
          nodes {
            id
            databaseId
            name
            owner {
              login
            }
            description
            stargazerCount
            primaryLanguage {
              name
              color
            }
            updatedAt
            isPrivate
          }
        }
      }
    }
  `;

  const result = await client(query, { first, after });
  return result.viewer.repositories;
}

// Search GitHub repositories
export async function searchGitHubRepositories(accessToken, query, first = 20) {
  const client = createGitHubClient(accessToken);

  const searchQuery = `
    query($searchQuery: String!, $first: Int!) {
      search(query: $searchQuery, type: REPOSITORY, first: $first) {
        nodes {
          ... on Repository {
            id
            databaseId
            name
            owner {
              login
            }
            description
            stargazerCount
            primaryLanguage {
              name
              color
            }
            updatedAt
            isPrivate
          }
        }
      }
    }
  `;

  const result = await client(searchQuery, { searchQuery: query, first });
  return result.search.nodes;
}

/**
 * Check if the authenticated user has admin permission for a repository
 * @param {string} accessToken - GitHub access token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<boolean>} True if user has ADMIN permission
 */
export async function checkRepositoryAdminPermission(accessToken, owner, repo) {
  const client = createGitHubClient(accessToken);

  const query = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        viewerPermission
      }
    }
  `;

  try {
    const result = await client(query, { owner, repo });

    if (!result || !result.repository) {
      console.error(`[GitHub] Repository ${owner}/${repo} not found or inaccessible`);
      return false;
    }

    const permission = result.repository.viewerPermission;

    // Only ADMIN permission level grants access to settings
    return permission === 'ADMIN';
  } catch (error) {
    console.error(`[GitHub] Failed to check admin permission for ${owner}/${repo}:`, error.message);
    // Fail closed - deny access on error
    return false;
  }
}

/**
 * Check the user's permission level for a repository.
 * Returns the permission level ('ADMIN', 'MAINTAIN', 'WRITE', 'TRIAGE', 'READ') or null if no access.
 * Used for staleness refresh to detect when a user has lost all access.
 * @param {string} accessToken - GitHub access token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<string|null>} Permission level or null if no access
 */
export async function checkRepositoryPermission(accessToken, owner, repo) {
  const client = createGitHubClient(accessToken);

  const query = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        viewerPermission
      }
    }
  `;

  try {
    const result = await client(query, { owner, repo });

    if (!result || !result.repository) {
      // Repository not found or user has no access
      return null;
    }

    return result.repository.viewerPermission;
  } catch (error) {
    console.error(`[GitHub] Error checking permission for ${owner}/${repo}:`, error.message);
    // Fail closed - treat as no access on error
    return null;
  }
}
