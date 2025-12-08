import { z } from 'zod';
import { prQueries, repoQueries, prCommentQueries, transaction } from '../../db/queries.js';
import { fetchRepositoryPullRequests, fetchPRIssueComments } from '../github.js';
import { toSqliteDateTime, now, parseSqliteDate } from '../../utils/dates.js';
import { isRateLimitError } from '../../utils/rate-limit-handler.js';

/**
 * Zod schema for pr-fetch job arguments
 */
export const prFetchSchema = z.object({
  repoId: z.number().int().positive(),
});

/**
 * Process PR fetch job
 * RESUMABLE: Uses ASC ordering + since filter for interrupted fetches
 * @param {Object} enrichedArgs - Validated and enriched arguments
 * @param {number} enrichedArgs.repoId - Repository ID
 * @param {string} enrichedArgs.accessToken - GitHub access token (enriched)
 * @param {string} enrichedArgs.owner - Repository owner (enriched)
 * @param {string} enrichedArgs.repoName - Repository name (enriched)
 * @param {number} enrichedArgs.userId - User ID (enriched)
 */
export async function prFetchHandler(enrichedArgs) {
  const { repoId, owner, repoName, accessToken } = enrichedArgs;

  let hasNextPage = true;
  let after = null;
  let fetchedCount = 0;
  let newCount = 0;
  let updatedCount = 0;
  let pageCount = 0;
  const startTime = Date.now();

  // Record the job start time - this will be stored in last_pr_fetched at the end
  // to ensure no gaps in incremental syncs
  const jobStartTime = now();

  // Get repo info for incremental sync
  const repo = repoQueries.getById.get(repoId);

  // Calculate 'since' timestamp for client-side filtering
  // - Full sync (since = null): fetches only OPEN PRs
  // - Incremental sync (since = timestamp): fetches OPEN + CLOSED + MERGED, filters client-side
  let since = null;

  if (repo.last_pr_fetched) {
    // Use last successful fetch start time for incremental mode
    // This ensures we catch ALL PRs updated since last sync started
    const lastFetchDate = parseSqliteDate(repo.last_pr_fetched);
    const sinceDate = new Date(lastFetchDate.getTime() - 60 * 1000); // 1 minute buffer for clock skew
    since = sinceDate.toISOString();

    console.log(
      `[${owner}/${repoName}] Starting incremental PR fetch (since: ${since})`
    );
  } else {
    console.log(`[${owner}/${repoName}] Starting full PR sync (first fetch)`);
  }

  while (hasNextPage) {
    const pageStartTime = Date.now();
    pageCount++;

    // Determine which states to fetch
    // Note: PRs have MERGED state (unlike issues), must include it to avoid missing merged PRs
    const states = since ? ['OPEN', 'CLOSED', 'MERGED'] : ['OPEN'];
    const result = await fetchRepositoryPullRequests(accessToken, owner, repoName, 100, after, states);

    // Client-side filtering for incremental sync
    let originalCount = result.nodes.length;
    if (since) {
      const sinceTimestamp = new Date(since).getTime();
      result.nodes = result.nodes.filter(pr => {
        const updatedAt = new Date(pr.updatedAt).getTime();
        return updatedAt >= sinceTimestamp;
      });

      // Early termination: if all PRs on this page are older than 'since', stop pagination
      // (since results are ordered by UPDATED_AT ASC)
      if (result.nodes.length === 0 && result.pageInfo.hasNextPage) {
        console.log(
          `[${owner}/${repoName}] Reached PRs older than last fetch (filtered ${originalCount} PRs), stopping pagination`
        );
        result.pageInfo.hasNextPage = false;
      }
    }

    const fetchTime = Date.now() - pageStartTime;

    // Store PRs in database
    const dbStartTime = Date.now();
    let pageNewCount = 0;
    let pageUpdatedCount = 0;
    const prsNeedingComments = [];

    const savePRs = transaction(() => {
      for (const pr of result.nodes) {
        const labels = pr.labels.nodes.map(l => l.name);
        const assignees = pr.assignees.nodes.map(a => a.login);
        const reviewers = pr.reviewRequests.nodes
          .map(rr => rr.requestedReviewer?.login)
          .filter(Boolean);
        const comments = pr.comments.nodes;
        const lastComment = comments.length > 0 ? comments[comments.length - 1] : null;

        // Track if this is a new or updated PR
        const existingPR = prQueries.findByGithubId.get(pr.databaseId);
        const isNew = !existingPR;
        const isUpdated = existingPR && new Date(pr.updatedAt) > parseSqliteDate(existingPR.updated_at);

        if (isNew) {
          pageNewCount++;
        } else if (isUpdated) {
          pageUpdatedCount++;
        }

        prQueries.upsert.run(
          repoId,
          pr.databaseId,
          pr.number,
          pr.title,
          pr.body,
          pr.state.toLowerCase(),
          pr.isDraft ? 1 : 0,
          JSON.stringify(labels),
          toSqliteDateTime(pr.createdAt),
          toSqliteDateTime(pr.updatedAt),
          toSqliteDateTime(pr.closedAt),
          toSqliteDateTime(pr.mergedAt),
          pr.comments.totalCount,
          toSqliteDateTime(lastComment?.createdAt) || null,
          lastComment?.author?.login || null,
          JSON.stringify({ total: pr.reactions.totalCount }),
          JSON.stringify(assignees),
          JSON.stringify(reviewers),
          pr.reviewDecision || null,
          pr.mergeable || null,
          pr.additions || 0,
          pr.deletions || 0,
          pr.changedFiles || 0,
          pr.author?.login || null,
          pr.authorAssociation || null,
          pr.headRefName || null,
          pr.baseRefName || null
        );

        // Determine if this PR needs comment fetching
        // Fetch if: (1) new PR, (2) updated PR, or (3) comments_fetched = false (migration)
        const needsComments = isNew || isUpdated || (existingPR && !existingPR.comments_fetched);

        if (needsComments) {
          // Get the DB PR record to access its ID
          const dbPR = prQueries.findByGithubId.get(pr.databaseId);
          prsNeedingComments.push({
            id: dbPR.id,
            number: pr.number,
            commentsCount: pr.comments.totalCount
          });
        }
      }
    });

    savePRs();
    const dbTime = Date.now() - dbStartTime;

    // Fetch and store comments for PRs that need them
    const commentsStartTime = Date.now();
    let commentsFetchedCount = 0;
    let totalCommentsSaved = 0;

    for (const prInfo of prsNeedingComments) {
      try {
        // Skip if PR has no comments
        if (prInfo.commentsCount === 0) {
          // Still mark as fetched
          prQueries.updateCommentsFetched?.run?.(prInfo.id);
          continue;
        }

        // Fetch issue comments from GitHub (matches issue fetching pattern)
        const comments = await fetchPRIssueComments(accessToken, owner, repoName, prInfo.number);

        // Store comments in database
        const storeComments = transaction(() => {
          for (const comment of comments) {
            if (comment.author && comment.author.login) {
              prCommentQueries.insertOrUpdate.run(
                prInfo.id,
                comment.databaseId || comment.id, // GitHub comment ID
                'issue', // Comment type (always 'issue' now, reviews not fetched)
                comment.author.login,
                comment.body,
                toSqliteDateTime(comment.createdAt)
              );
            }
          }

          // Mark comments as fetched for this PR
          prQueries.updateCommentsFetched?.run?.(prInfo.id);
        });

        storeComments();
        commentsFetchedCount++;
        totalCommentsSaved += comments.length;
      } catch (error) {
        const errorType = isRateLimitError(error) ? '[RateLimit]' : '[Error]';

        console.error(
          `[${owner}/${repoName}] ${errorType} Failed to fetch comments for PR #${prInfo.number}:`,
          error.message
        );

        // Don't mark as fetched if it failed - will retry next time
        // For rate limit errors: Let them propagate to fail the job
        // The `since`-based fetch will pick up this PR on next run
        if (isRateLimitError(error)) {
          console.warn(
            `[${owner}/${repoName}] Rate limit during comment fetch for PR #${prInfo.number}. ` +
            `Job will be marked as failed. This PR will be retried on next fetch.`
          );
          throw error; // Propagate to fail the job gracefully
        }
        // Other errors: continue with other PRs (soft failure)
      }
    }

    const commentsTime = Date.now() - commentsStartTime;

    if (prsNeedingComments.length > 0) {
      console.log(
        `[${owner}/${repoName}] PR Comments: ${commentsFetchedCount}/${prsNeedingComments.length} PRs processed, ` +
        `${totalCommentsSaved} comments saved | ${commentsTime}ms`
      );
    }

    fetchedCount += result.nodes.length;
    newCount += pageNewCount;
    updatedCount += pageUpdatedCount;
    hasNextPage = result.pageInfo.hasNextPage;
    after = result.pageInfo.endCursor;

    const filteredInfo = since && originalCount > result.nodes.length
      ? ` (${originalCount - result.nodes.length} filtered)`
      : '';
    console.log(
      `[${owner}/${repoName}] PR Page ${pageCount}: ` +
      `fetched ${result.nodes.length} PRs${filteredInfo} (${pageNewCount} new, ${pageUpdatedCount} updated, ${fetchedCount} total) | ` +
      `API: ${fetchTime}ms, DB: ${dbTime}ms, Total: ${fetchTime + dbTime}ms` +
      `${hasNextPage ? ' | More pages...' : ''}`
    );
  }

  const totalTime = Date.now() - startTime;
  const avgTimePerPage = pageCount > 0 ? Math.round(totalTime / pageCount) : 0;

  // Store job start time for incremental sync tracking
  prQueries.updateLastPRFetched.run(jobStartTime, repoId);

  // Update PR count for this repository
  prQueries.updatePRCount.run(repoId, repoId);

  console.log(
    `[${owner}/${repoName}] ✓ PR fetch completed: ` +
    `${fetchedCount} PRs fetched (${newCount} new, ${updatedCount} updated), ${pageCount} pages, ${Math.round(totalTime / 1000)}s total ` +
    `(avg ${avgTimePerPage}ms/page)` +
    `${since ? ' | Incremental update' : ' | Full sync'}`
  );
}
