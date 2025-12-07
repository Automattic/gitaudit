import { z } from 'zod';
import { issueQueries, repoQueries, analysisQueries, commentQueries, transaction } from '../../db/queries.js';
import { fetchSingleIssue, fetchIssueComments } from '../github.js';
import {
  analyzeIssueSentiment,
  analyzeCommentsSentiment,
  calculateSentimentScore,
  isSentimentAnalysisAvailable,
} from '../analyzers/sentiment.js';
import { toSqliteDateTime } from '../../utils/dates.js';

/**
 * Zod schema for single-issue-refresh job arguments
 */
export const singleIssueRefreshSchema = z.object({
  repoId: z.number().int().positive(),
  issueNumber: z.number().int().positive(),
});

/**
 * Process single issue refresh job
 * Fetches one issue from GitHub, updates DB, and optionally triggers analysis
 * @param {Object} enrichedArgs - Validated and enriched arguments
 * @param {number} enrichedArgs.repoId - Repository ID
 * @param {number} enrichedArgs.issueNumber - Issue number
 * @param {string} enrichedArgs.accessToken - GitHub access token (enriched)
 * @param {string} enrichedArgs.owner - Repository owner (enriched)
 * @param {string} enrichedArgs.repoName - Repository name (enriched)
 * @param {number} enrichedArgs.userId - User ID (enriched)
 */
export async function singleIssueRefreshHandler(enrichedArgs) {
  const { repoId, issueNumber, accessToken, owner, repoName } = enrichedArgs;

  console.log(`[${owner}/${repoName}] Refreshing issue #${issueNumber}...`);

  try {
    // 1. Fetch single issue from GitHub
    const issue = await fetchSingleIssue(accessToken, owner, repoName, issueNumber);

    // 2. Upsert to database
    const labels = issue.labels.nodes.map(l => l.name);
    const assignees = issue.assignees.nodes.map(a => a.login);
    const comments = issue.comments.nodes;
    const lastComment = comments.length > 0 ? comments[comments.length - 1] : null;

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

    // 3. Fetch and update all comments
    const allComments = await fetchIssueComments(accessToken, owner, repoName, issue.number);
    const dbIssue = issueQueries.findByGithubId.get(issue.databaseId);

    // Clear old comments and insert new ones
    const updateComments = transaction(() => {
      commentQueries.deleteByIssueId.run(dbIssue.id);
      for (const comment of allComments) {
        commentQueries.insertOrUpdate.run(
          dbIssue.id,
          comment.databaseId,
          comment.author?.login || null,
          comment.body,
          toSqliteDateTime(comment.createdAt)
        );
      }
    });
    updateComments();

    // Mark comments as fetched
    issueQueries.updateCommentsFetched.run(dbIssue.id);

    console.log(`[${owner}/${repoName}] ✓ Issue #${issueNumber} refreshed`);

    // 4. Optionally trigger sentiment analysis if it's a bug
    // The updated issue.updated_at will cause incremental analyzer to pick it up automatically
    // But we can also trigger immediate analysis for this specific issue
    if (isSentimentAnalysisAvailable()) {
      const isBug = labels.some(label =>
        label.toLowerCase().includes('bug') ||
        label.toLowerCase().includes('[type] bug')
      );

      if (isBug) {
        console.log(`[${owner}/${repoName}] Triggering sentiment analysis for issue #${issueNumber}...`);

        const issueSentiment = await analyzeIssueSentiment(issue);
        const commentsSentiment = await analyzeCommentsSentiment(dbIssue.id);
        const result = calculateSentimentScore(issueSentiment, commentsSentiment, allComments.length);

        // Store analysis
        analysisQueries.upsert.run(
          dbIssue.id,
          'sentiment',
          result.score,
          JSON.stringify(result.metadata)
        );

        console.log(`[${owner}/${repoName}] ✓ Sentiment analysis completed for #${issueNumber} (score: ${result.score})`);
      }
    }

    console.log(`[${owner}/${repoName}] ✓ Issue #${issueNumber} fully refreshed`);

  } catch (error) {
    console.error(`[${owner}/${repoName}] ✗ Failed to refresh issue #${issueNumber}:`, error.message);
    throw error;
  }
}
