import { z } from 'zod';
import { issueQueries, repoQueries, commentQueries, transaction } from '../../db/queries.js';
import { fetchRepositoryIssues, fetchIssueComments, fetchTeamMembers } from '../github.js';
import { loadRepoSettings } from '../settings.js';
import { toSqliteDateTime, now, parseSqliteDate } from '../../utils/dates.js';
import { isRateLimitError } from '../../utils/rate-limit-handler.js';
import { isSentimentAnalysisAvailable } from '../analyzers/sentiment.js';
import { queueJob } from '../job-queue.js';

/**
 * Zod schema for issue-fetch job arguments
 */
export const issueFetchSchema = z.object({
  repoId: z.number().int().positive(),
});

/**
 * Process issue fetch job
 * RESUMABLE: Uses ASC ordering + since filter for interrupted fetches
 * @param {Object} enrichedArgs - Validated and enriched arguments
 * @param {number} enrichedArgs.repoId - Repository ID
 * @param {string} enrichedArgs.accessToken - GitHub access token (enriched)
 * @param {string} enrichedArgs.owner - Repository owner (enriched)
 * @param {string} enrichedArgs.repoName - Repository name (enriched)
 * @param {number} enrichedArgs.userId - User ID (enriched)
 */
export async function issueFetchHandler(enrichedArgs) {
  const { repoId, owner, repoName, accessToken, userId } = enrichedArgs;

  let hasNextPage = true;
  let after = null;
  let fetchedCount = 0;
  let newCount = 0;
  let updatedCount = 0;
  let pageCount = 0;
  const startTime = Date.now();

  // Record the job start time - this will be stored in last_fetched at the end
  // to ensure no gaps in incremental syncs
  const jobStartTime = now();

  // Get repo info for incremental sync
  const repo = repoQueries.getById.get(repoId);

  // Calculate 'since' timestamp for GitHub API filter
  // - Full sync (since = null): fetches only OPEN issues
  // - Incremental sync (since = timestamp): fetches OPEN + CLOSED to catch state changes
  let since = null;
  if (repo.needs_full_refetch) {
    console.log(`[${owner}/${repoName}] Starting full refetch (populating author data)`);
    since = null; // Force full sync
  } else if (repo.last_fetched) {
    // Use last successful fetch start time for incremental mode
    // This ensures we catch ALL issues updated since last sync started
    const lastFetchDate = parseSqliteDate(repo.last_fetched);
    const sinceDate = new Date(lastFetchDate.getTime() - 60 * 1000); // 1 minute buffer for clock skew
    since = sinceDate.toISOString();

    console.log(
      `[${owner}/${repoName}] Starting incremental fetch (since: ${since})`
    );
  } else {
    console.log(`[${owner}/${repoName}] Starting full sync (first fetch)`);
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
        const isUpdated = existingIssue && new Date(issue.updatedAt) > parseSqliteDate(existingIssue.updated_at);

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
          toSqliteDateTime(issue.createdAt),
          toSqliteDateTime(issue.updatedAt),
          toSqliteDateTime(issue.closedAt),
          issue.comments.totalCount,
          toSqliteDateTime(lastComment?.createdAt) || null,
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
                toSqliteDateTime(comment.createdAt)
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
        const errorType = isRateLimitError(error) ? '[RateLimit]' : '[Error]';

        console.error(
          `[${owner}/${repoName}] ${errorType} Failed to fetch comments for issue #${issueInfo.number}:`,
          error.message
        );

        // Don't mark as fetched if it failed - will retry next time
        // For rate limit errors: Let them propagate to fail the job
        // The `since`-based fetch will pick up this issue on next run
        if (isRateLimitError(error)) {
          console.warn(
            `[${owner}/${repoName}] Rate limit during comment fetch for #${issueInfo.number}. ` +
            `Job will be marked as failed. This issue will be retried on next fetch.`
          );
          throw error; // Propagate to fail the job gracefully
        }
        // Other errors: continue with other issues (soft failure)
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

  // Store job start time for incremental sync tracking
  repoQueries.updateLastFetched.run(jobStartTime, repoId);

  // Clear full refetch flag if it was set
  if (repo.needs_full_refetch) {
    repoQueries.clearFullRefetchFlag.run(repoId);
    console.log(`[${owner}/${repoName}] Full refetch completed, flag cleared`);
  }

  // Fetch and store maintainer logins for Community Health scoring
  try {
    const settings = loadRepoSettings(repoId);
    const team = settings.general?.maintainerTeam;

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

  // Auto-queue sentiment analysis after successful issue fetch (if AI provider is configured)
  if (isSentimentAnalysisAvailable()) {
    queueJob({
      type: 'sentiment',
      repoId,
      userId,
      args: {},
      priority: 50,
    });
    console.log(`[${owner}/${repoName}] Auto-queued sentiment analysis`);
  }
}
