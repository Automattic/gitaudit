import { issueQueries, repoQueries, analysisQueries, commentQueries, transaction } from '../db/queries.js';
import { fetchRepositoryIssues, fetchIssueComments, fetchTeamMembers } from './github.js';
import {
  analyzeIssueSentiment,
  analyzeCommentsSentiment,
  calculateSentimentScore,
  isSentimentAnalysisAvailable,
} from './analyzers/sentiment.js';
import { isBugIssue } from './analyzers/important-bugs.js';
import { loadRepoSettings } from './settings.js';

// In-memory job queue
const queue = [];
const MAX_CONCURRENT_REPOS = 5;
// Map of repoId -> current job being processed for that repo
const processingRepos = new Map();

/**
 * Queue issue fetch for a repository
 * This is the entry point called from the /fetch endpoint
 */
export async function queueIssueFetch(jobData) {
  const { repoId, owner, repoName, accessToken } = jobData;

  console.log(`[JobQueue] Queuing issue fetch for ${owner}/${repoName}, repoId=${repoId}`);
  console.log(`[JobQueue] Current queue length: ${queue.length}, processing repos: ${processingRepos.size}`);

  queue.push({
    type: 'issue-fetch',
    repoId,
    owner,
    repoName,
    accessToken
  });

  console.log(`[JobQueue] Job added to queue. New queue length: ${queue.length}`);

  // Trigger processing (will check capacity internally)
  processQueue();
}

/**
 * Queue sentiment analysis for a repository
 * Usually called automatically after issue fetch completes
 */
export async function queueSentimentAnalysis(repoId, accessToken) {
  console.log(`Queuing sentiment analysis for repo ${repoId}`);
  queue.push({ type: 'sentiment', repoId, accessToken });

  // Trigger processing (will check capacity internally)
  processQueue();
}

/**
 * Process jobs from the queue, allowing multiple repos in parallel
 */
async function processQueue() {
  console.log(`[JobQueue] processQueue called. Queue length: ${queue.length}, processing repos: ${processingRepos.size}/${MAX_CONCURRENT_REPOS}`);

  // Check if we're at max capacity
  if (processingRepos.size >= MAX_CONCURRENT_REPOS) {
    console.log(`[JobQueue] At max capacity (${MAX_CONCURRENT_REPOS} repos), waiting...`);
    return;
  }

  // Find next job for a repo that's not currently being processed
  const availableJobIndex = queue.findIndex(job => !processingRepos.has(job.repoId));

  if (availableJobIndex === -1) {
    if (queue.length > 0) {
      console.log(`[JobQueue] ${queue.length} jobs queued but all repos currently processing`);
    } else {
      console.log(`[JobQueue] Queue empty`);
    }
    return;
  }

  // Remove job from queue
  const job = queue.splice(availableJobIndex, 1)[0];

  // Mark repo as being processed
  processingRepos.set(job.repoId, job);

  console.log(`[JobQueue] Starting job: type=${job.type}, repoId=${job.repoId}, owner=${job.owner || 'unknown'}/${job.repoName || 'unknown'}`);

  // Process the job asynchronously
  processJob(job).finally(() => {
    // Remove from processing map when done
    processingRepos.delete(job.repoId);
    console.log(`[JobQueue] Repo ${job.repoId} finished processing. Processing: ${processingRepos.size}/${MAX_CONCURRENT_REPOS}`);

    // Trigger processing of next jobs
    processQueue();
  });

  // Immediately try to start more jobs if capacity available
  setImmediate(() => processQueue());
}

/**
 * Process a single job (issue-fetch or sentiment)
 */
async function processJob(job) {
  try {
    if (job.type === 'issue-fetch') {
      await processIssueFetchJob(job);

      // After issue fetch completes, automatically queue sentiment analysis (if AI provider is configured)
      if (isSentimentAnalysisAvailable()) {
        const repo = repoQueries.getById.get(job.repoId);
        console.log(`[${repo.owner}/${repo.name}] Issue fetch complete, queuing sentiment analysis...`);
        queue.push({
          type: 'sentiment',
          repoId: job.repoId,
          accessToken: job.accessToken
        });

        // Trigger processing for the sentiment job
        setImmediate(() => processQueue());
      } else {
        const repo = repoQueries.getById.get(job.repoId);
        console.log(`[${repo.owner}/${repo.name}] Issue fetch complete. Sentiment analysis skipped (no AI provider configured).`);
      }
    } else if (job.type === 'sentiment') {
      await processSentimentJob(job);
    }

    console.log(`[JobQueue] ✓ Completed job: ${job.type} for repo ${job.repoId}`);
  } catch (error) {
    console.error(`[JobQueue] ✗ Job failed: ${job.type} for repo ${job.repoId}`, error);

    // Update repo status on failure
    if (job.type === 'issue-fetch') {
      repoQueries.updateFetchStatus.run('failed', job.repoId);
    }
  }
}

/**
 * Process issue fetch job
 * RESUMABLE: Uses ASC ordering + since filter for interrupted fetches
 */
async function processIssueFetchJob(job) {
  const { repoId, owner, repoName, accessToken } = job;

  let hasNextPage = true;
  let after = null;
  let fetchedCount = 0;
  let newCount = 0;
  let updatedCount = 0;
  let pageCount = 0;
  const startTime = Date.now();

  // Get most recent issue's updated_at for incremental updates
  const repo = repoQueries.getById.get(repoId);
  const mostRecentResult = issueQueries.getMostRecentUpdatedAt.get(repoId);
  const mostRecentIssueUpdatedAt = mostRecentResult?.most_recent_updated_at;

  // Calculate 'since' timestamp for GitHub API filter
  // Check if full refetch is needed (to populate author data)
  let since = null;
  if (repo.needs_full_refetch) {
    console.log(`[${owner}/${repoName}] Starting issue fetch...`);
    console.log(`[${owner}/${repoName}] Full refetch mode (populating author data)`);
    since = null; // Force full sync
  } else if (mostRecentIssueUpdatedAt) {
    // Normal incremental mode - subtract 1 minute for clock skew protection
    const mostRecentDate = new Date(mostRecentIssueUpdatedAt);
    const sinceDate = new Date(mostRecentDate.getTime() - 60 * 1000); // 1 minute buffer
    since = sinceDate.toISOString();

    console.log(`[${owner}/${repoName}] Starting issue fetch...`);
    console.log(
      `[${owner}/${repoName}] Incremental mode: fetching issues updated after ${since} ` +
      `(most recent in DB: ${mostRecentIssueUpdatedAt})`
    );
  } else {
    console.log(`[${owner}/${repoName}] Starting issue fetch...`);
    console.log(`[${owner}/${repoName}] Full sync mode (first fetch)`);
  }

  while (hasNextPage) {
    const pageStartTime = Date.now();
    pageCount++;

    // Fetch with ASC ordering and optional 'since' filter
    const result = await fetchRepositoryIssues(accessToken, owner, repoName, 100, after, since);
    const fetchTime = Date.now() - pageStartTime;

    // Store issues in database
    const dbStartTime = Date.now();
    let pageNewCount = 0;
    let pageUpdatedCount = 0;
    const issuesNeedingComments = [];

    const saveIssues = transaction(() => {
      for (const issue of result.nodes) {
        const labels = issue.labels.nodes.map(l => l.name);
        const assignees = issue.assignees.nodes.map(a => a.login);
        const comments = issue.comments.nodes;
        const lastComment = comments.length > 0 ? comments[comments.length - 1] : null;

        // Track if this is a new or updated issue
        const existingIssue = issueQueries.findByGithubId.get(issue.databaseId);
        const isNew = !existingIssue;
        const isUpdated = existingIssue && new Date(issue.updatedAt) > new Date(existingIssue.updated_at);

        if (isNew) {
          pageNewCount++;
        } else if (isUpdated) {
          pageUpdatedCount++;
        }

        issueQueries.upsert.run(
          repoId,
          issue.databaseId,
          issue.number,
          issue.title,
          issue.body,
          issue.state.toLowerCase(),
          JSON.stringify(labels),
          issue.createdAt,
          issue.updatedAt,
          issue.closedAt,
          issue.comments.totalCount,
          lastComment?.createdAt || null,
          lastComment?.author?.login || null,
          JSON.stringify({ total: issue.reactions.totalCount }),
          JSON.stringify(assignees),
          issue.milestone?.title || null,
          issue.issueType?.name || null,
          issue.author?.login || null,
          issue.authorAssociation || null
        );

        // Determine if this issue needs comment fetching
        // Fetch if: (1) new issue, (2) updated issue, or (3) comments_fetched = false (migration)
        const needsComments = isNew || isUpdated || (existingIssue && !existingIssue.comments_fetched);

        if (needsComments) {
          // Get the DB issue record to access its ID
          const dbIssue = issueQueries.findByGithubId.get(issue.databaseId);
          issuesNeedingComments.push({
            id: dbIssue.id,
            number: issue.number,
            commentsCount: issue.comments.totalCount
          });
        }
      }
    });

    saveIssues();
    const dbTime = Date.now() - dbStartTime;

    // Fetch and store comments for issues that need them
    const commentsStartTime = Date.now();
    let commentsFetchedCount = 0;
    let totalCommentsSaved = 0;

    for (const issueInfo of issuesNeedingComments) {
      try {
        // Skip if issue has no comments
        if (issueInfo.commentsCount === 0) {
          // Still mark as fetched
          issueQueries.updateCommentsFetched?.run?.(issueInfo.id);
          continue;
        }

        // Fetch comments from GitHub
        const comments = await fetchIssueComments(accessToken, owner, repoName, issueInfo.number);

        // Store comments in database
        const storeComments = transaction(() => {
          for (const comment of comments) {
            if (comment.author && comment.author.login) {
              commentQueries.insertOrUpdate.run(
                issueInfo.id,
                comment.databaseId || comment.id, // GitHub comment ID
                comment.author.login,
                comment.body,
                comment.createdAt
              );
            }
          }

          // Mark comments as fetched for this issue
          issueQueries.updateCommentsFetched?.run?.(issueInfo.id);
        });

        storeComments();
        commentsFetchedCount++;
        totalCommentsSaved += comments.length;
      } catch (error) {
        console.error(
          `[${owner}/${repoName}] Failed to fetch comments for issue #${issueInfo.number}:`,
          error.message
        );
        // Don't mark as fetched if it failed - will retry next time
      }
    }

    const commentsTime = Date.now() - commentsStartTime;

    if (issuesNeedingComments.length > 0) {
      console.log(
        `[${owner}/${repoName}] Comments: ${commentsFetchedCount}/${issuesNeedingComments.length} issues processed, ` +
        `${totalCommentsSaved} comments saved | ${commentsTime}ms`
      );
    }

    fetchedCount += result.nodes.length;
    newCount += pageNewCount;
    updatedCount += pageUpdatedCount;
    hasNextPage = result.pageInfo.hasNextPage;
    after = result.pageInfo.endCursor;

    console.log(
      `[${owner}/${repoName}] Page ${pageCount}: ` +
      `fetched ${result.nodes.length} issues (${pageNewCount} new, ${pageUpdatedCount} updated, ${fetchedCount} total) | ` +
      `API: ${fetchTime}ms, DB: ${dbTime}ms, Total: ${fetchTime + dbTime}ms` +
      `${hasNextPage ? ' | More pages...' : ''}`
    );
  }

  const totalTime = Date.now() - startTime;
  const avgTimePerPage = pageCount > 0 ? Math.round(totalTime / pageCount) : 0;

  // Update status to completed
  repoQueries.updateFetchStatus.run('completed', repoId);

  // Clear full refetch flag if it was set
  if (repo.needs_full_refetch) {
    repoQueries.clearFullRefetchFlag.run(repoId);
    console.log(`[${owner}/${repoName}] Full refetch completed, flag cleared`);
  }

  // Fetch and store maintainer logins for Community Health scoring
  try {
    const settings = loadRepoSettings(repoId);
    const team = settings.communityHealth?.maintainerTeam;

    if (team && team.org && team.teamSlug) {
      console.log(`[${owner}/${repoName}] Fetching maintainer logins from ${team.org}/${team.teamSlug}...`);
      const maintainerLogins = await fetchTeamMembers(accessToken, team.org, team.teamSlug);

      // Store in database
      repoQueries.updateMaintainerLogins.run(JSON.stringify(maintainerLogins), repoId);
      console.log(`[${owner}/${repoName}] ✓ Stored ${maintainerLogins.length} maintainer(s)`);
    }
  } catch (error) {
    console.error(`[${owner}/${repoName}] Failed to fetch/store maintainer logins:`, error.message);
    // Don't fail the entire job - maintainer detection is optional
  }

  console.log(
    `[${owner}/${repoName}] ✓ Issue fetch completed: ` +
    `${fetchedCount} issues fetched (${newCount} new, ${updatedCount} updated), ${pageCount} pages, ${Math.round(totalTime / 1000)}s total ` +
    `(avg ${avgTimePerPage}ms/page)` +
    `${since ? ' | Incremental update' : ' | Full sync'}`
  );
}

/**
 * Process sentiment analysis for issues in a repo
 * INCREMENTAL: Only analyzes issues that changed since last analysis
 */
async function processSentimentJob(job) {
  const { repoId, accessToken } = job;
  const startTime = Date.now();

  // Get repo info (need owner/name for GitHub API)
  const repo = repoQueries.getById.get(repoId);
  if (!repo) {
    console.error(`Repo ${repoId} not found`);
    return;
  }

  console.log(`[${repo.owner}/${repo.name}] Starting sentiment analysis...`);

  // INCREMENTAL: Find issues needing analysis (new or updated since last analysis)
  const staleIssues = analysisQueries.findStaleAnalyses.all('sentiment', repoId);

  // Filter to only bug issues (same filter used in UI)
  const issuesToAnalyze = staleIssues.filter(isBugIssue);

  console.log(
    `[${repo.owner}/${repo.name}] Found ${issuesToAnalyze.length} bug issues needing analysis ` +
    `(${staleIssues.length} total issues, ${Math.round((issuesToAnalyze.length / staleIssues.length) * 100)}% are bugs)`
  );

  if (issuesToAnalyze.length === 0) {
    console.log(`[${repo.owner}/${repo.name}] ✓ No bugs to analyze, skipping sentiment analysis`);
    return;
  }

  let analyzedCount = 0;
  let totalCommentsFetched = 0;

  for (const issue of issuesToAnalyze) {
    try {
      const issueStartTime = Date.now();

      // 1. Analyze issue sentiment (title + body)
      const issueSentiment = await analyzeIssueSentiment(issue);

      // 2. Analyze comment sentiments (from cached data)
      const commentsSentiments = await analyzeCommentsSentiment(issue.id);

      totalCommentsFetched += commentsSentiments.length;

      // 3. Calculate aggregate sentiment score
      const { score, metadata } = calculateSentimentScore(
        issueSentiment,
        commentsSentiments
      );

      // 4. Store in issue_analysis table
      analysisQueries.upsert.run(
        issue.id,
        'sentiment',
        score,
        JSON.stringify(metadata)
      );

      analyzedCount++;
      const issueTime = Date.now() - issueStartTime;

      console.log(
        `[${repo.owner}/${repo.name}] Issue #${issue.number}: ` +
        `score=${score}/30 (${metadata.reasoning}) | ` +
        `${commentsSentiments.length} comments | ${issueTime}ms`
      );

      // Progress update every 10 issues
      if (analyzedCount % 10 === 0) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const avgTimePerIssue = Math.round((Date.now() - startTime) / analyzedCount);
        const remaining = issuesToAnalyze.length - analyzedCount;
        const eta = Math.round((remaining * avgTimePerIssue) / 1000);
        console.log(
          `[${repo.owner}/${repo.name}] Progress: ${analyzedCount}/${issuesToAnalyze.length} ` +
          `(${Math.round((analyzedCount / issuesToAnalyze.length) * 100)}%) | ` +
          `${elapsed}s elapsed, ~${eta}s remaining`
        );
      }
    } catch (error) {
      console.error(`[${repo.owner}/${repo.name}] Failed to analyze issue #${issue.number}:`, error);
    }
  }

  const totalTime = Date.now() - startTime;
  const avgTimePerIssue = Math.round(totalTime / analyzedCount);

  console.log(
    `[${repo.owner}/${repo.name}] ✓ Sentiment analysis completed: ` +
    `${analyzedCount} bugs analyzed, ${totalCommentsFetched} comments processed | ` +
    `${Math.round(totalTime / 1000)}s total (avg ${avgTimePerIssue}ms/issue)`
  );
}

/**
 * Get queue status
 */
export function getQueueStatus() {
  return {
    queueLength: queue.length,
    processingCount: processingRepos.size,
    maxConcurrent: MAX_CONCURRENT_REPOS,
  };
}

/**
 * Get the current job type being processed for a specific repo
 * Returns 'issue-fetch', 'sentiment', or null
 */
export function getCurrentJobForRepo(repoId) {
  const job = processingRepos.get(repoId);
  return job ? job.type : null;
}
