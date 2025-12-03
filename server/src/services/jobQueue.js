import { issueQueries, repoQueries, analysisQueries, transaction } from '../db/queries.js';
import { fetchRepositoryIssues } from './github.js';
import {
  analyzeIssueSentiment,
  analyzeCommentsSentiment,
  calculateSentimentScore,
} from './analyzers/sentiment.js';
import { isBugIssue } from './analyzers/important-bugs.js';

// In-memory job queue
const queue = [];
let isProcessing = false;

/**
 * Queue issue fetch for a repository
 * This is the entry point called from the /fetch endpoint
 */
export async function queueIssueFetch(jobData) {
  const { repoId, owner, repoName, accessToken } = jobData;

  console.log(`[JobQueue] Queuing issue fetch for ${owner}/${repoName}, repoId=${repoId}`);
  console.log(`[JobQueue] Current queue length: ${queue.length}, isProcessing: ${isProcessing}`);

  queue.push({
    type: 'issue-fetch',
    repoId,
    owner,
    repoName,
    accessToken
  });

  console.log(`[JobQueue] Job added to queue. New queue length: ${queue.length}`);

  // Start processing if not already running
  if (!isProcessing) {
    console.log(`[JobQueue] Queue not processing, starting processor...`);
    processQueue();
  } else {
    console.log(`[JobQueue] Queue already processing, job will be picked up next`);
  }
}

/**
 * Queue sentiment analysis for a repository
 * Usually called automatically after issue fetch completes
 */
export async function queueSentimentAnalysis(repoId, accessToken) {
  console.log(`Queuing sentiment analysis for repo ${repoId}`);
  queue.push({ type: 'sentiment', repoId, accessToken });

  // Start processing if not already running
  if (!isProcessing) {
    processQueue();
  }
}

/**
 * Process jobs from the queue sequentially
 */
async function processQueue() {
  console.log(`[JobQueue] processQueue called. Queue length: ${queue.length}, isProcessing: ${isProcessing}`);

  if (queue.length === 0) {
    console.log(`[JobQueue] Queue empty, stopping processor`);
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const job = queue.shift();

  console.log(`[JobQueue] Processing job: type=${job.type}, repoId=${job.repoId}, owner=${job.owner}/${job.repoName}`);

  try {
    if (job.type === 'issue-fetch') {
      await processIssueFetchJob(job);

      // After issue fetch completes, automatically queue sentiment analysis
      const repo = repoQueries.getById.get(job.repoId);
      console.log(`[${repo.owner}/${repo.name}] Issue fetch complete, queuing sentiment analysis...`);
      queue.push({
        type: 'sentiment',
        repoId: job.repoId,
        accessToken: job.accessToken
      });
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

  // Process next job
  console.log(`[JobQueue] Scheduling next job processing...`);
  setImmediate(() => processQueue());
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
  // Subtract 1 minute for clock skew protection
  let since = null;
  if (mostRecentIssueUpdatedAt) {
    const mostRecentDate = new Date(mostRecentIssueUpdatedAt);
    const sinceDate = new Date(mostRecentDate.getTime() - 60 * 1000); // 1 minute buffer
    since = sinceDate.toISOString();
  }

  console.log(`[${owner}/${repoName}] Starting issue fetch...`);
  if (since) {
    console.log(
      `[${owner}/${repoName}] Incremental mode: fetching issues updated after ${since} ` +
      `(most recent in DB: ${mostRecentIssueUpdatedAt})`
    );
  } else {
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
          issue.issueType?.name || null
        );
      }
    });

    saveIssues();
    const dbTime = Date.now() - dbStartTime;

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

      // 2. Lazy-fetch and analyze comment sentiments
      const commentsSentiments = await analyzeCommentsSentiment(
        accessToken,
        repo.owner,
        repo.name,
        issue.number
      );

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
    isProcessing,
  };
}
