/**
 * Unified Feedback Service
 * Provides a scalable interface for fetching notifications/feedback from all platforms
 */

import { FeedbackItem, Platform } from '../types';
import { fetchXFeedback } from './platforms/xFeedbackService';

export interface FeedbackFetchOptions {
  limit?: number;
  since?: number; // Unix timestamp in milliseconds
  platform?: Platform; // Filter by specific platform
}

export interface PlatformFeedbackService {
  /**
   * Fetch feedback/notifications from this platform
   */
  fetchFeedback(options?: FeedbackFetchOptions): Promise<FeedbackItem[]>;
  
  /**
   * Check if this platform is connected
   */
  isConnected(): Promise<boolean>;
}

/**
 * Fetch feedback from all connected platforms
 */
export async function fetchAllFeedback(options: FeedbackFetchOptions = {}): Promise<FeedbackItem[]> {
  const allFeedback: FeedbackItem[] = [];
  
  // Fetch from each platform in parallel
  const platformPromises: Promise<FeedbackItem[]>[] = [];
  
  // X/Twitter
  try {
    const xService = { fetchFeedback: fetchXFeedback, isConnected: async () => {
      const { isXConnected } = await import('./xOAuthService');
      return await isXConnected();
    }};
    
    if (await xService.isConnected()) {
      if (!options.platform || options.platform === Platform.X) {
        platformPromises.push(
          xService.fetchFeedback(options).catch(error => {
            console.error('Failed to fetch X feedback:', error);
            return [];
          })
        );
      }
    }
  } catch (error) {
    console.error('Error checking X connection:', error);
  }
  
  // TODO: Add other platforms as they're implemented
  // Reddit, Discord, Email...
  
  // Wait for all platform fetches to complete
  const results = await Promise.all(platformPromises);
  
  // Flatten and sort by timestamp (newest first)
  results.forEach(feedback => allFeedback.push(...feedback));
  
  return allFeedback.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Fetch feedback from a specific platform
 */
export async function fetchPlatformFeedback(
  platform: Platform,
  options: FeedbackFetchOptions = {}
): Promise<FeedbackItem[]> {
  switch (platform) {
    case Platform.X:
      return await fetchXFeedback(options);
    case Platform.REDDIT:
      // TODO: Implement Reddit feedback fetching
      throw new Error('Reddit feedback fetching not yet implemented');
    case Platform.DISCORD:
      // TODO: Implement Discord feedback fetching
      throw new Error('Discord feedback fetching not yet implemented');
    case Platform.EMAIL:
      // TODO: Implement Email feedback fetching
      throw new Error('Email feedback fetching not yet implemented');
    default:
      return [];
  }
}

