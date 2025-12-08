import { z } from 'zod';
import { prQueries, repoQueries, prCommentQueries, transaction } from '../../db/queries.js';
import { fetchSinglePR, fetchPRIssueComments } from '../github.js';
import { toSqliteDateTime } from '../../utils/dates.js';

/**
 * Zod schema for single-pr-refresh job arguments
 */
export const singlePRRefreshSchema = z.object({
  repoId: z.number().int().positive(),
  prNumber: z.number().int().positive(),
});

/**
 * Process single PR refresh job
 * Fetches one PR from GitHub, updates DB
 * @param {Object} enrichedArgs - Validated and enriched arguments
 * @param {number} enrichedArgs.repoId - Repository ID
 * @param {number} enrichedArgs.prNumber - PR number
 * @param {string} enrichedArgs.accessToken - GitHub access token (enriched)
 * @param {string} enrichedArgs.owner - Repository owner (enriched)
 * @param {string} enrichedArgs.repoName - Repository name (enriched)
 * @param {number} enrichedArgs.userId - User ID (enriched)
 */
export async function singlePRRefreshHandler(enrichedArgs) {
  const { repoId, prNumber, accessToken, owner, repoName } = enrichedArgs;

  console.log(`[${owner}/${repoName}] Refreshing PR #${prNumber}...`);

  try {
    // 1. Fetch single PR from GitHub
    const pr = await fetchSinglePR(accessToken, owner, repoName, prNumber);

    // 2. Upsert to database
    const labels = pr.labels.nodes.map(l => l.name);
    const assignees = pr.assignees.nodes.map(a => a.login);
    const reviewers = pr.reviewers.nodes.map(r => r.author.login).filter(Boolean);
    const comments = pr.comments.nodes;
    const lastComment = comments.length > 0 ? comments[comments.length - 1] : null;

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
      pr.mergeStateStatus || null,
      pr.additions || 0,
      pr.deletions || 0,
      pr.changedFiles || 0,
      pr.author?.login || null,
      pr.authorAssociation || null,
      pr.headRefName || null,
      pr.baseRefName || null
    );

    // 3. Fetch and update all comments
    const allComments = await fetchPRIssueComments(accessToken, owner, repoName, pr.number);
    const dbPR = prQueries.findByGithubId.get(pr.databaseId);

    // Clear old comments and insert new ones
    const updateComments = transaction(() => {
      prCommentQueries.deleteByPRId.run(dbPR.id);
      for (const comment of allComments) {
        if (comment.author && comment.author.login) {
          prCommentQueries.insertOrUpdate.run(
            dbPR.id,
            comment.databaseId || comment.id,
            'issue', // Comment type (always 'issue' now, reviews not fetched)
            comment.author.login,
            comment.body,
            toSqliteDateTime(comment.createdAt)
          );
        }
      }
    });
    updateComments();

    // Mark comments as fetched
    prQueries.updateCommentsFetched.run(dbPR.id);

    console.log(`[${owner}/${repoName}] ✓ PR #${prNumber} fully refreshed`);

  } catch (error) {
    console.error(`[${owner}/${repoName}] ✗ Failed to refresh PR #${prNumber}:`, error.message);
    throw error;
  }
}
