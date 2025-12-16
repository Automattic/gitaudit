import { z } from 'zod';
import { analysisQueries } from '../../db/queries.js';
import {
  analyzeIssueSentiment,
  analyzeCommentsSentiment,
  calculateSentimentScore,
  isSentimentAnalysisAvailable,
} from '../analyzers/sentiment.js';
import { isBugIssue } from '../analyzers/bugs.js';
import { loadRepoSettings } from '../settings.js';

/**
 * Zod schema for sentiment analysis job arguments
 */
export const sentimentSchema = z.object({
  repoId: z.number().int().positive(),
});

/**
 * Process sentiment analysis for issues in a repo
 * INCREMENTAL: Only analyzes issues that changed since last analysis
 * @param {Object} enrichedArgs - Validated and enriched arguments
 * @param {number} enrichedArgs.repoId - Repository ID
 * @param {string} enrichedArgs.accessToken - GitHub access token (enriched, not used)
 * @param {string} enrichedArgs.owner - Repository owner (enriched)
 * @param {string} enrichedArgs.repoName - Repository name (enriched)
 * @param {number} enrichedArgs.userId - User ID (enriched)
 */
export async function sentimentHandler(enrichedArgs) {
  const { repoId, owner, repoName } = enrichedArgs;
  const startTime = Date.now();

  console.log(`[${owner}/${repoName}] Starting sentiment analysis...`);

  // Check if LLM is configured for this repository
  if (!isSentimentAnalysisAvailable(repoId)) {
    console.log(`[${owner}/${repoName}] ✗ Sentiment analysis not available: LLM not configured`);
    return;
  }

  // Load settings for bug/feature label detection
  const settings = loadRepoSettings(repoId);

  // INCREMENTAL: Find issues needing analysis (new or updated since last analysis)
  const staleIssues = analysisQueries.findStaleAnalyses.all('sentiment', repoId);

  // Filter to bugs and features (sentiment is useful for both)
  const { isFeatureRequest } = await import('../analyzers/features.js');
  const issuesToAnalyze = staleIssues.filter(issue => isBugIssue(issue, settings.general) || isFeatureRequest(issue, settings.general));

  const bugCount = staleIssues.filter(issue => isBugIssue(issue, settings.general)).length;
  const featureCount = staleIssues.filter(issue => isFeatureRequest(issue, settings.general)).length;

  console.log(
    `[${owner}/${repoName}] Found ${issuesToAnalyze.length} issues needing analysis ` +
    `(${bugCount} bugs, ${featureCount} features out of ${staleIssues.length} total)`
  );

  if (issuesToAnalyze.length === 0) {
    console.log(`[${owner}/${repoName}] ✓ No issues to analyze, skipping sentiment analysis`);
    return;
  }

  let analyzedCount = 0;
  let totalCommentsFetched = 0;

  for (const issue of issuesToAnalyze) {
    try {
      const issueStartTime = Date.now();

      // 1. Analyze issue sentiment (title + body)
      const issueSentiment = await analyzeIssueSentiment(repoId, issue);

      // 2. Analyze comment sentiments (from cached data)
      const commentsSentiments = await analyzeCommentsSentiment(repoId, issue.id);

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

      // Progress update every 10 issues
      if (analyzedCount % 10 === 0) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const avgTimePerIssue = Math.round((Date.now() - startTime) / analyzedCount);
        const remaining = issuesToAnalyze.length - analyzedCount;
        const eta = Math.round((remaining * avgTimePerIssue) / 1000);
        console.log(
          `[${owner}/${repoName}] Progress: ${analyzedCount}/${issuesToAnalyze.length} ` +
          `(${Math.round((analyzedCount / issuesToAnalyze.length) * 100)}%) | ` +
          `${elapsed}s elapsed, ~${eta}s remaining`
        );
      }
    } catch (error) {
      console.error(`[${owner}/${repoName}] Failed to analyze issue #${issue.number}:`, error);
    }
  }

  const totalTime = Date.now() - startTime;
  const avgTimePerIssue = analyzedCount > 0 ? Math.round(totalTime / analyzedCount) : 0;

  console.log(
    `[${owner}/${repoName}] ✓ Sentiment analysis completed: ` +
    `${analyzedCount} bugs analyzed, ${totalCommentsFetched} comments processed | ` +
    `${Math.round(totalTime / 1000)}s total (avg ${avgTimePerIssue}ms/issue)`
  );
}
