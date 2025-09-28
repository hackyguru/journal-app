/**
 * Utility functions for handling sentiment analysis results
 */

export type SentimentType = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

/**
 * Get emoji representation of sentiment
 */
export const getSentimentEmoji = (sentiment: SentimentType | string): string => {
  switch (sentiment?.toUpperCase()) {
    case 'POSITIVE':
      return '😊';
    case 'NEGATIVE':
      return '😔';
    case 'NEUTRAL':
    default:
      return '😐';
  }
};

/**
 * Get color representation of sentiment for UI
 */
export const getSentimentColor = (sentiment: SentimentType | string): string => {
  switch (sentiment?.toUpperCase()) {
    case 'POSITIVE':
      return '#4CAF50'; // Green
    case 'NEGATIVE':
      return '#F44336'; // Red
    case 'NEUTRAL':
    default:
      return '#9E9E9E'; // Gray
  }
};

/**
 * Get human-readable sentiment description
 */
export const getSentimentDescription = (sentiment: SentimentType | string, confidence?: number): string => {
  const baseDescription = sentiment?.toLowerCase() || 'neutral';
  
  if (confidence && confidence > 0.8) {
    return `Very ${baseDescription}`;
  } else if (confidence && confidence > 0.6) {
    return `Mostly ${baseDescription}`;
  } else {
    return `Slightly ${baseDescription}`;
  }
};

/**
 * Format sentiment for display with emoji and confidence
 */
export const formatSentimentDisplay = (sentiment: SentimentType | string, confidence?: number): string => {
  const emoji = getSentimentEmoji(sentiment);
  const description = getSentimentDescription(sentiment, confidence);
  
  if (confidence && confidence > 0.5) {
    return `${emoji} ${description}`;
  } else {
    return emoji; // Just show emoji if confidence is low
  }
};
