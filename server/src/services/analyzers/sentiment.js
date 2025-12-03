import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { fetchIssueComments } from '../github.js';

// Get AI provider from environment
function getAIProvider() {
  const provider = process.env.AI_PROVIDER || 'anthropic'; // default
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    throw new Error('AI_API_KEY environment variable not set');
  }

  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey });
    case 'openai':
      return createOpenAI({ apiKey });
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

function getModelName() {
  return process.env.AI_MODEL || 'claude-3-haiku-20240307'; // fast, cheap model
}

/**
 * Analyze sentiment of a single text (issue or comment)
 * Returns: { score: -1 to 1, label: 'negative'|'neutral'|'positive', reasoning: string }
 */
export async function analyzeSentiment(text) {
  const provider = getAIProvider();
  const model = getModelName();

  const prompt = `Analyze the sentiment and urgency of this GitHub issue or comment.

SENTIMENT CATEGORIES:
- NEGATIVE: Frustration, urgency, pain points, complaints, blocking issues
- NEUTRAL: Constructive technical discussion, questions, clarifications
- POSITIVE: Appreciation, encouragement, solved problems

IMPORTANT: Your response MUST be a single valid JSON object. Do not include any markdown code blocks, backticks, or additional text.

REQUIRED OUTPUT FORMAT:
{"score": -0.8, "label": "negative", "reasoning": "User expresses frustration with blocking bug"}

FIELD REQUIREMENTS:
- score: A number between -1.0 and 1.0 (use decimals)
- label: Must be exactly "negative", "neutral", or "positive" (lowercase, in quotes)
- reasoning: A brief explanation (1-2 sentences, in quotes)

TEXT TO ANALYZE:
${text}

OUTPUT (valid JSON only):`;

  try {
    const { text: response } = await generateText({
      model: provider(model),
      prompt,
      maxTokens: 150,
    });

    // Trim whitespace from response
    const trimmedResponse = response.trim();

    // Parse response
    const result = JSON.parse(trimmedResponse);

    // Validate response structure
    if (typeof result.score !== 'number' || typeof result.label !== 'string' || typeof result.reasoning !== 'string') {
      throw new Error(`Invalid response structure: ${JSON.stringify(result)}`);
    }

    return {
      score: Math.max(-1, Math.min(1, result.score)), // Clamp to [-1, 1]
      label: result.label,
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error('Sentiment analysis error:', error.message);
    console.error('Text being analyzed (first 200 chars):', text.substring(0, 200));

    // Return neutral on error
    return { score: 0, label: 'neutral', reasoning: 'Analysis failed' };
  }
}

/**
 * Analyze sentiment for an issue (title + body)
 */
export async function analyzeIssueSentiment(issue) {
  const text = `Title: ${issue.title}\n\nBody: ${issue.body || 'No description'}`;
  return analyzeSentiment(text);
}

/**
 * Fetch and analyze sentiment for all comments of an issue
 * Returns array of sentiment results
 */
export async function analyzeCommentsSentiment(accessToken, owner, repoName, issueNumber) {
  // Lazy-fetch comments from GitHub
  const comments = await fetchIssueComments(accessToken, owner, repoName, issueNumber);

  const results = [];

  // Batch process comments (avoid rate limits)
  for (const comment of comments) {
    const sentiment = await analyzeSentiment(comment.body);
    results.push(sentiment);

    // Small delay to avoid AI API rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Aggregate sentiment scores into a single bug priority score
 * Negative sentiment = higher score (more important)
 */
export function calculateSentimentScore(issueSentiment, commentsSentiments) {
  // Weight: issue body is important, but comments show user frustration
  const issueWeight = 0.3;
  const commentsWeight = 0.7;

  // Count negative comments (score < -0.3)
  const negativeComments = commentsSentiments.filter(c => c.score < -0.3).length;
  const totalComments = commentsSentiments.length;

  // Average comment sentiment
  const avgCommentSentiment =
    totalComments > 0
      ? commentsSentiments.reduce((sum, c) => sum + c.score, 0) / totalComments
      : 0;

  // Combined sentiment (more negative = higher score)
  const combinedSentiment =
    issueSentiment.score * issueWeight + avgCommentSentiment * commentsWeight;

  // Convert to bug priority score (0-30 points)
  // More negative = higher score
  // -1.0 (very negative) → 30 points
  // 0.0 (neutral) → 15 points
  // 1.0 (positive) → 0 points
  const baseScore = Math.round((1 - combinedSentiment) * 15);

  // Bonus for high number of negative comments (indicates widespread frustration)
  const negativeRatio = totalComments > 0 ? negativeComments / totalComments : 0;
  const negativeBonus = Math.round(negativeRatio * 15);

  const finalScore = Math.min(30, baseScore + negativeBonus);

  return {
    score: finalScore,
    metadata: {
      issueSentiment: issueSentiment.score,
      avgCommentSentiment,
      negativeComments,
      totalComments,
      negativeRatio,
      reasoning: `Issue sentiment: ${issueSentiment.label}. ${negativeComments}/${totalComments} negative comments.`,
    },
  };
}
