import { graphql } from '@octokit/graphql';

// Rate limiting: delay between requests to avoid secondary rate limits
const MIN_REQUEST_INTERVAL_MS = 1000; // 1 second between requests
let lastRequestTime = 0;

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rate-limited API call wrapper
 * Ensures minimum time between requests to avoid secondary rate limits
 * If rate limit is hit, job will fail and resume on next fetch
 */
async function rateLimitedCall(fn) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    const delay = MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
    await sleep(delay);
  }

  lastRequestTime = Date.now();
  return await fn();
}

// Create GitHub GraphQL client with user token
export function createGitHubClient(accessToken) {
  const client = graphql.defaults({
    headers: {
      authorization: `token ${accessToken}`,
    },
  });

  // Wrap client to add rate limiting
  return async (query, variables) => {
    return rateLimitedCall(() => client(query, variables));
  };
}

// Exchange OAuth code for access token
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

  return data.access_token;
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

// Fetch issues for a repository
// Supports incremental fetching via 'since' parameter (ISO 8601 timestamp)
export async function fetchRepositoryIssues(accessToken, owner, repo, first = 100, after = null, since = null) {
  const client = createGitHubClient(accessToken);

  // Build query with optional since filter
  const filterByClause = since ? ', filterBy: {since: $since}' : '';
  const sinceVariable = since ? ', $since: DateTime!' : '';

  const query = `
    query($owner: String!, $repo: String!, $first: Int!, $after: String${sinceVariable}) {
      repository(owner: $owner, name: $repo) {
        id
        databaseId
        issues(first: $first, after: $after, states: [OPEN], orderBy: {field: UPDATED_AT, direction: ASC}${filterByClause}) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            databaseId
            number
            title
            body
            state
            createdAt
            updatedAt
            closedAt
            issueType {
              name
            }
            labels(first: 20) {
              nodes {
                name
                color
              }
            }
            comments(last: 2) {
              totalCount
              nodes {
                createdAt
                author {
                  login
                }
              }
            }
            reactions {
              totalCount
            }
            assignees(first: 10) {
              nodes {
                login
              }
            }
            milestone {
              title
              dueOn
            }
          }
        }
      }
    }
  `;

  const variables = { owner, repo, first, after };
  if (since) {
    variables.since = since;
  }

  const result = await client(query, variables);
  return result.repository.issues;
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
 * Fetch all comments for a specific issue
 * Used during sentiment analysis (lazy-fetch approach)
 */
export async function fetchIssueComments(accessToken, owner, repo, issueNumber) {
  const client = createGitHubClient(accessToken);

  const query = `
    query($owner: String!, $repo: String!, $issueNumber: Int!, $first: Int!, $after: String) {
      repository(owner: $owner, name: $repo) {
        issue(number: $issueNumber) {
          comments(first: $first, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              body
              author {
                login
              }
              createdAt
            }
          }
        }
      }
    }
  `;

  // Fetch up to 100 comments (paginate if needed)
  let allComments = [];
  let hasNextPage = true;
  let after = null;

  while (hasNextPage && allComments.length < 100) {
    const result = await client(query, { owner, repo, issueNumber, first: 100, after });
    const comments = result.repository.issue.comments;

    allComments = allComments.concat(comments.nodes);
    hasNextPage = comments.pageInfo.hasNextPage;
    after = comments.pageInfo.endCursor;
  }

  return allComments;
}
