import { HttpError } from './http.js';
import { updateUserTokens } from './queries.js';

// GitHub rejects API requests without a User-Agent, and a worker doesn't send one
const USER_AGENT = 'CodeVitals';

async function graphql(accessToken, query, variables = {}) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      authorization: `token ${accessToken}`,
      'content-type': 'application/json',
      'user-agent': USER_AGENT,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}`);
  }

  return response.json();
}

/** Run a query, treating any GraphQL error as a failure. */
async function query(accessToken, text, variables) {
  const { data, errors } = await graphql(accessToken, text, variables);
  if (errors?.length) {
    throw new Error(`GitHub API error: ${errors[0].message}`);
  }
  return data;
}

async function requestToken(env, params) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'user-agent': USER_AGENT,
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      ...params,
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

// Exchange OAuth code for access token (and refresh token for GitHub Apps)
export const exchangeCodeForToken = (env, code) => requestToken(env, { code });

/**
 * Get a valid access token for a user, refreshing it if it has expired.
 * Users without a refresh token have a token that doesn't expire.
 */
export async function getValidAccessToken(env, user) {
  if (!user.refresh_token) {
    return user.access_token;
  }

  // Treat a token as expired 5 minutes early, so it can't run out mid-request
  const bufferMs = 5 * 60 * 1000;
  if (user.token_expires_at && Date.now() < Number(user.token_expires_at) - bufferMs) {
    return user.access_token;
  }

  let tokens;
  try {
    tokens = await requestToken(env, {
      grant_type: 'refresh_token',
      refresh_token: user.refresh_token,
    });
  } catch (error) {
    console.error('[Auth] Token refresh failed for user', user.id, ':', error.message);
    throw new HttpError(401, 'GitHub token expired. Please log in again.');
  }

  await updateUserTokens(
    env.DB,
    user.id,
    tokens.accessToken,
    tokens.refreshToken,
    Date.now() + tokens.expiresIn * 1000
  );

  return tokens.accessToken;
}

export async function getAuthenticatedUser(accessToken) {
  const { viewer } = await query(accessToken, 'query { viewer { databaseId login } }');
  return viewer;
}

const REPOSITORY_FIELDS = `
  databaseId
  name
  owner { login }
  description
  stargazerCount
  primaryLanguage { name color }
  updatedAt
  isPrivate
`;

// Fetch user's accessible repositories (personal + organizations)
export async function fetchUserRepositories(accessToken, first) {
  const { viewer } = await query(
    accessToken,
    `query($first: Int!) {
      viewer {
        repositories(
          first: $first,
          orderBy: {field: UPDATED_AT, direction: DESC},
          affiliations: [OWNER, ORGANIZATION_MEMBER, COLLABORATOR],
          ownerAffiliations: [OWNER, ORGANIZATION_MEMBER, COLLABORATOR]
        ) {
          nodes { ${REPOSITORY_FIELDS} }
        }
      }
    }`,
    { first }
  );
  return viewer.repositories.nodes;
}

export async function searchRepositories(accessToken, searchQuery) {
  const { search } = await query(
    accessToken,
    `query($searchQuery: String!) {
      search(query: $searchQuery, type: REPOSITORY, first: 20) {
        nodes { ... on Repository { ${REPOSITORY_FIELDS} } }
      }
    }`,
    { searchQuery }
  );
  return search.nodes;
}

/**
 * A repository, with the user's permission level on it as viewerPermission ('ADMIN',
 * 'MAINTAIN', 'WRITE', 'TRIAGE' or 'READ'), or null if GitHub says they can't see it. A
 * failed request throws, so that a GitHub outage isn't mistaken for the user having lost
 * access.
 */
export async function fetchRepository(accessToken, owner, repo) {
  const { data, errors } = await graphql(
    accessToken,
    `query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) { ${REPOSITORY_FIELDS} viewerPermission }
    }`,
    { owner, repo }
  );

  if (data?.repository) {
    return data.repository;
  }
  if (errors?.some((error) => error.type === 'NOT_FOUND')) {
    return null;
  }
  throw new Error(`GitHub API error: ${errors?.[0]?.message ?? 'empty response'}`);
}

export async function fetchRepositoryPermission(accessToken, owner, repo) {
  const repository = await fetchRepository(accessToken, owner, repo);
  return repository && repository.viewerPermission;
}
