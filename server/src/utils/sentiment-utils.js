/**
 * Scale sentiment score to a target maximum
 * Sentiment analysis returns scores in 0-30 range
 * This function scales them to the configured maximum
 *
 * @param {number} sentimentScore - Raw sentiment score (0-30)
 * @param {number} maxPoints - Target maximum points
 * @returns {number} Scaled score
 *
 * @example
 * scaleSentimentScore(15, 30) // 15 (no scaling needed)
 * scaleSentimentScore(15, 60) // 30 (doubled)
 * scaleSentimentScore(15, 15) // 7.5 (halved)
 */
export function scaleSentimentScore(sentimentScore, maxPoints) {
  return Math.round(sentimentScore * (maxPoints / 30));
}
