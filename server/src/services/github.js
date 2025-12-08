import { graphql } from '@octokit/graphql';
import {
  rateLimitConfig,
  isRateLimitError,
  recordRateLimitHit,
  shouldApplyCooldown,
  getCooldownRemaining,
  withRetry,
} from '../utils/rate-limit-handler.js';

// Rate limiting: configurable delay between requests to avoid secondary rate limits
const MIN_REQUEST_INTERVAL_MS = rateLimitConfig.baseRequestDelay;

// Centralized request queue - ensures only ONE GitHub API request at a time across all repos
const requestQueue = [];
let isProcessing = false;
let lastRequestTime = 0;

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Enqueue a GitHub API request for serial execution
 * All requests go through this queue to prevent parallel execution across repos
 * @param {Function} fn - The async function to execute
 * @param {string} context - Context for logging
 * @returns {Promise<any>} Result of the function
 */
async function enqueueRequest(fn, context = 'API call') {
  return new Promise((resolve, reject) => {
    requestQueue.push({ fn, context, resolve, reject, enqueuedAt: Date.now() });
    processNextRequest();
  });
}

/**
 * Process the next request in the queue
 * Ensures only ONE request executes at a time with proper rate limiting
 */
async function processNextRequest() {
  if (isProcessing || requestQueue.length === 0) return;

  isProcessing = true;
  const { fn, context, resolve, reject, enqueuedAt } = requestQueue.shift();
  const queueWaitTime = Date.now() - enqueuedAt;

  // Log if request waited more than 1 second in queue
  if (queueWaitTime > 1000) {
    console.log(
      `[RequestQueue] ${context} waited ${queueWaitTime}ms in queue (${requestQueue.length} remaining)`
    );
  }

  try {
    // Enforce minimum delay since last request
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
    }

    // Execute the request
    lastRequestTime = Date.now();
    const result = await fn();
    resolve(result);
  } catch (error) {
    reject(error);
  } finally {
    isProcessing = false;
    // Process next request in queue
    setImmediate(processNextRequest);
  }
}

/**
 * Rate-limited API call wrapper with retry logic and cooldown
 * Enqueues requests for serial execution and handles rate limit errors
 * @param {Function} fn - The async function to execute
 * @param {string} context - Context for logging
 * @returns {Promise<any>} Result of the function
 */
async function rateLimitedCall(fn, context = 'API call') {
  // Check if we should apply cooldown due to recent rate limits
  if (shouldApplyCooldown()) {
    const remaining = getCooldownRemaining();
    console.warn(
      `[RateLimit] Cooldown active due to repeated rate limits, ` +
        `waiting ${Math.round(remaining / 1000)}s before proceeding`
    );
    await sleep(remaining);
  }

  // Enqueue request for serial execution
  try {
    return await enqueueRequest(fn, context);
  } catch (error) {
    // Detect and record rate limit errors
    if (isRateLimitError(error)) {
      const hitCount = recordRateLimitHit();
      console.warn(
        `[RateLimit] ${context} - Rate limit detected (consecutive hits: ${hitCount})`
      );
    }
    throw error; // Re-throw for upper layers to handle
  }
}

// Create GitHub GraphQL client with user token
// Automatically applies rate limiting and retry logic to all calls
export function createGitHubClient(accessToken) {
  const client = graphql.defaults({
    headers: {
      authorization: `token ${accessToken}`,
    },
  });

  // Wrap client to add rate limiting, retry logic, and context logging
  return async (query, variables) => {
    // Extract operation name from query for better logging
    const operationMatch = query.match(/(?:query|mutation)\s+(\w+)/);
    const operation = operationMatch ? operationMatch[1] : 'GraphQL';
    const context =
      operation +
      (variables?.owner && variables?.repo ? ` (${variables.owner}/${variables.repo})` : '');

    try {
      // Apply retry logic around rate-limited call with validation
      const result = await withRetry(
        async () => {
          const data = await rateLimitedCall(() => client(query, variables), context);

          // Validate response is not null/undefined (inside retry loop)
          if (data === null || data === undefined) {
            console.error(`[GitHub] API returned null/undefined for: ${context}`);
            console.error(`[GitHub] Variables:`, variables);
            const error = new Error(`GitHub API returned null/undefined response`);
            error.isNullResponse = true; // Mark for retry logic
            throw error;
          }

          return data;
        },
        context
      );

      return result;
    } catch (error) {
      // Log error details for debugging
      console.error(`[GitHub] API call failed: ${context}`);
      console.error(`[GitHub] Error status: ${error.status || 'N/A'}`);
      console.error(`[GitHub] Error message: ${error.message}`);
      throw error;
    }
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

  // Full sync: only fetch OPEN issues
  // Incremental sync: fetch both OPEN and CLOSED to catch state changes
  const states = since ? '[OPEN, CLOSED]' : '[OPEN]';

  const query = `
    query($owner: String!, $repo: String!, $first: Int!, $after: String${sinceVariable}) {
      repository(owner: $owner, name: $repo) {
        id
        databaseId
        issues(first: $first, after: $after, states: ${states}, orderBy: {field: UPDATED_AT, direction: ASC}${filterByClause}) {
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
            author {
              login
            }
            authorAssociation
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

/**
 * Fetch a single issue with all details
 */
export async function fetchSingleIssue(accessToken, owner, repo, issueNumber) {
  const client = createGitHubClient(accessToken);

  const query = `
    query($owner: String!, $repo: String!, $issueNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $issueNumber) {
          id
          databaseId
          number
          title
          body
          state
          createdAt
          updatedAt
          closedAt
          author { login }
          authorAssociation
          issueType { name }
          labels(first: 20) {
            nodes { name color }
          }
          comments(first: 2, orderBy: {field: UPDATED_AT, direction: DESC}) {
            totalCount
            nodes {
              createdAt
              author { login }
            }
          }
          reactions { totalCount }
          assignees(first: 10) {
            nodes { login }
          }
          milestone {
            title
            dueOn
          }
        }
      }
    }
  `;

  const result = await client(query, { owner, repo, issueNumber });

  if (!result.repository?.issue) {
    throw new Error(`Issue #${issueNumber} not found in ${owner}/${repo}`);
  }

  return result.repository.issue;
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
              databaseId
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

  // Fetch up to 100 comments (paginate if needed) with retry logic
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

/**
 * Fetch repository pull requests
 * @param {string} accessToken - GitHub access token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} first - Number of PRs to fetch per page (default: 100)
 * @param {string} after - Pagination cursor
 * @param {Array<string>} states - PR states to fetch (e.g., ['OPEN', 'CLOSED', 'MERGED'])
 * @returns {Promise<Object>} PRs response with pageInfo and nodes
 */
export async function fetchRepositoryPullRequests(accessToken, owner, repo, first = 100, after = null, states = ['OPEN']) {
  // Validate states parameter
  if (!Array.isArray(states) || states.length === 0) {
    throw new Error('states must be a non-empty array');
  }

  const validStates = ['OPEN', 'CLOSED', 'MERGED'];
  const invalidStates = states.filter(state => !validStates.includes(state));
  if (invalidStates.length > 0) {
    throw new Error(`Invalid PR states: ${invalidStates.join(', ')}. Valid states: ${validStates.join(', ')}`);
  }

  const client = createGitHubClient(accessToken);

  const query = `
    query($owner: String!, $repo: String!, $first: Int!, $after: String, $states: [PullRequestState!]) {
      repository(owner: $owner, name: $repo) {
        pullRequests(first: $first, after: $after, states: $states, orderBy: {field: UPDATED_AT, direction: ASC}) {
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
            isDraft
            createdAt
            updatedAt
            closedAt
            mergedAt
            author {
              login
            }
            authorAssociation
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
            reviewRequests(first: 10) {
              nodes {
                requestedReviewer {
                  ... on User {
                    login
                  }
                }
              }
            }
            reviewDecision
            mergeable
            additions
            deletions
            changedFiles
            headRefName
            baseRefName
          }
        }
      }
    }
  `;

  const variables = { owner, repo, first, after, states };

  const result = await client(query, variables);

  if (!result || !result.repository) {
    console.error(`[GitHub] fetchRepositoryPullRequests - Invalid response structure:`, result);
    throw new Error(`Invalid GraphQL response: missing repository field`);
  }

  return result.repository.pullRequests;
}

/**
 * Fetch issue comments for a pull request (matches fetchIssueComments pattern)
 * @param {string} accessToken - GitHub access token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} prNumber - PR number
 * @returns {Promise<Array>} Array of comment objects
 */
export async function fetchPRIssueComments(accessToken, owner, repo, prNumber) {
  const client = createGitHubClient(accessToken);

  const query = `
    query($owner: String!, $repo: String!, $prNumber: Int!, $first: Int!, $after: String) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $prNumber) {
          comments(first: $first, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              databaseId
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
    const result = await client(query, { owner, repo, prNumber, first: 100, after });

    if (!result || !result.repository || !result.repository.pullRequest) {
      console.error(`[GitHub] fetchPRIssueComments - Invalid response structure for PR #${prNumber}:`, result);
      throw new Error(`Invalid GraphQL response for PR #${prNumber}: missing pullRequest field`);
    }

    const pr = result.repository.pullRequest;

    // Add issue comments
    allComments = allComments.concat(pr.comments.nodes);

    // Check pagination
    hasNextPage = pr.comments.pageInfo.hasNextPage;
    after = pr.comments.pageInfo.endCursor;
  }

  return allComments;
}

/**
 * Fetch a single PR with all details
 * @param {string} accessToken - GitHub access token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} prNumber - PR number
 * @returns {Promise<Object>} PR object with all fields
 */
export async function fetchSinglePR(accessToken, owner, repo, prNumber) {
  const client = createGitHubClient(accessToken);

  const query = `
    query($owner: String!, $repo: String!, $prNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $prNumber) {
          id
          databaseId
          number
          title
          body
          state
          isDraft
          createdAt
          updatedAt
          closedAt
          mergedAt
          author {
            login
          }
          authorAssociation
          labels(first: 20) {
            nodes {
              name
              color
            }
          }
          comments(first: 2, orderBy: {field: UPDATED_AT, direction: DESC}) {
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
          reviewers: reviews(first: 10) {
            nodes {
              author {
                login
              }
            }
          }
          reviewDecision
          mergeable
          mergeStateStatus
          additions
          deletions
          changedFiles
          headRefName
          baseRefName
        }
      }
    }
  `;

  const result = await client(query, { owner, repo, prNumber });

  if (!result.repository?.pullRequest) {
    throw new Error(`PR #${prNumber} not found in ${owner}/${repo}`);
  }

  return result.repository.pullRequest;
}

/**
 * Fetch team members from a GitHub organization team
 * Used for identifying maintainers in community health analysis
 * @param {string} accessToken - GitHub access token
 * @param {string} org - Organization login (e.g., 'facebook')
 * @param {string} teamSlug - Team slug (e.g., 'react-core')
 * @returns {Promise<string[]>} Array of member logins
 */
export async function fetchTeamMembers(accessToken, org, teamSlug) {
  const client = createGitHubClient(accessToken);

  const query = `
    query($org: String!, $teamSlug: String!, $first: Int!, $after: String) {
      organization(login: $org) {
        team(slug: $teamSlug) {
          members(first: $first, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              login
            }
          }
        }
      }
    }
  `;

  // Fetch all team members with pagination and retry logic
  let allMembers = [];
  let hasNextPage = true;
  let after = null;

  while (hasNextPage) {
    const result = await client(query, { org, teamSlug, first: 100, after });
    const members = result.organization.team.members;

    allMembers = allMembers.concat(members.nodes.map((node) => node.login));
    hasNextPage = members.pageInfo.hasNextPage;
    after = members.pageInfo.endCursor;
  }

  return allMembers;
}
