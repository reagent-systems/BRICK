/**
 * X/Twitter Feedback Service
 * Fetches mentions, replies, and other notifications from X/Twitter
 */

import { FeedbackItem, Platform } from '../../types';
import { ensureValidXToken, getXUserProfile } from '../xOAuthService';
import { FeedbackFetchOptions } from '../feedbackService';
import { isNativePlatform } from '../../utils/platform';

// API URLs - use proxy on web to avoid CORS, direct API on native
const getApiUrl = (path: string): string => {
  const baseUrl = isNativePlatform() ? 'https://api.twitter.com' : '/api/twitter';
  return `${baseUrl}${path}`;
};

/**
 * Classify feedback type based on tweet content
 */
function classifyFeedbackType(text: string): 'question' | 'bug' | 'request' | 'positive' | 'general' {
  const lowerText = text.toLowerCase();
  
  // Questions
  if (lowerText.includes('?') || 
      lowerText.includes('how') || 
      lowerText.includes('what') || 
      lowerText.includes('why') ||
      lowerText.includes('when') ||
      lowerText.includes('where')) {
    return 'question';
  }
  
  // Bugs/Issues
  if (lowerText.includes('bug') || 
      lowerText.includes('error') || 
      lowerText.includes('broken') ||
      lowerText.includes('issue') ||
      lowerText.includes('problem') ||
      lowerText.includes('not working')) {
    return 'bug';
  }
  
  // Requests/Feature requests
  if (lowerText.includes('please') || 
      lowerText.includes('can you') || 
      lowerText.includes('would love') ||
      lowerText.includes('should') ||
      lowerText.includes('could you') ||
      lowerText.includes('add') ||
      lowerText.includes('feature')) {
    return 'request';
  }
  
  // Positive feedback
  if (lowerText.includes('love') || 
      lowerText.includes('great') || 
      lowerText.includes('awesome') ||
      lowerText.includes('amazing') ||
      lowerText.includes('thank') ||
      lowerText.includes('thanks') ||
      lowerText.match(/🔥|❤️|💯|👍|🙌/)) {
    return 'positive';
  }
  
  return 'general';
}

/**
 * Fetch mentions for the authenticated user
 */
async function fetchMentions(options: FeedbackFetchOptions = {}): Promise<any> {
  const accessToken = await ensureValidXToken();
  
  // Get user ID first
  const userProfile = await getXUserProfile();
  const userId = userProfile.data?.id;
  
  if (!userId) {
    throw new Error('Could not retrieve user ID');
  }
  
  // Build query parameters
  const params = new URLSearchParams({
    'max_results': String(options.limit || 25),
    'tweet.fields': 'created_at,author_id,in_reply_to_user_id,conversation_id,text,public_metrics',
    'user.fields': 'username,name,profile_image_url',
    'expansions': 'author_id',
  });
  
  // Note: Twitter API v2 mentions endpoint doesn't support since_id directly
  // We'll filter client-side if needed
  
  const response = await fetch(
    `${getApiUrl(`/2/users/${userId}/mentions`)}?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Failed to fetch mentions: ${response.status} ${response.statusText}`;
    
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.detail || errorJson.title || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    // Handle rate limiting (429)
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a few minutes before refreshing. X API has strict rate limits.');
    }
    
    // If it's a 403, might be missing scopes or API access tier
    if (response.status === 403) {
      throw new Error(`${errorMessage}. Make sure your X app has access to read mentions.`);
    }
    
    throw new Error(errorMessage);
  }
  
  const data = await response.json();
  
  // Filter by timestamp if since is provided
  if (options.since && data.data) {
    data.data = data.data.filter((tweet: any) => {
      const tweetTime = new Date(tweet.created_at).getTime();
      return tweetTime >= options.since!;
    });
  }
  
  return data;
}

/**
 * Fetch replies to user's tweets
 * Note: This requires Twitter API v2 Basic tier or higher for search functionality
 */
async function fetchReplies(options: FeedbackFetchOptions = {}): Promise<any> {
  const accessToken = await ensureValidXToken();
  
  // Get user ID
  const userProfile = await getXUserProfile();
  const userId = userProfile.data?.id;
  const username = userProfile.data?.username;
  
  if (!userId || !username) {
    throw new Error('Could not retrieve user ID or username');
  }
  
  // Get user's recent tweets first
  const tweetsParams = new URLSearchParams({
    'max_results': '10',
    'tweet.fields': 'created_at,conversation_id,text',
  });
  
  const tweetsResponse = await fetch(
    `${getApiUrl(`/2/users/${userId}/tweets`)}?${tweetsParams.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );
  
  if (!tweetsResponse.ok) {
    // User might not have any tweets, that's okay
    return { data: [], includes: { users: [] } };
  }
  
  const tweetsData = await tweetsResponse.json();
  const tweets = tweetsData.data || [];
  
  if (tweets.length === 0) {
    return { data: [], includes: { users: [] } };
  }
  
  // Use search to find replies to user's tweets
  // Search for tweets that are replies to the user's tweets
  // Format: to:username (replies to the user)
  const query = `to:${username} -from:${username}`;
  
  const searchParams = new URLSearchParams({
    'query': query,
    'max_results': String(options.limit || 25),
    'tweet.fields': 'created_at,author_id,in_reply_to_user_id,conversation_id,text,public_metrics',
    'user.fields': 'username,name,profile_image_url',
    'expansions': 'author_id',
  });
  
  const searchResponse = await fetch(
    `${getApiUrl('/2/tweets/search/recent')}?${searchParams.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );
  
  if (!searchResponse.ok) {
    // Handle rate limiting
    if (searchResponse.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a few minutes before refreshing. X API has strict rate limits.');
    }
    // Search API might not be available on free tier
    // Return empty result instead of throwing
    return { data: [], includes: { users: [] } };
  }
  
  const searchData = await searchResponse.json();
  
  // Filter by timestamp if since is provided
  if (options.since && searchData.data) {
    searchData.data = searchData.data.filter((tweet: any) => {
      const tweetTime = new Date(tweet.created_at).getTime();
      return tweetTime >= options.since!;
    });
  }
  
  return searchData;
}

/**
 * Transform Twitter API response to FeedbackItem format
 */
function transformToFeedbackItems(
  apiData: any,
  threadTitle?: string
): FeedbackItem[] {
  if (!apiData.data || !Array.isArray(apiData.data)) {
    return [];
  }
  
  const users = apiData.includes?.users || [];
  const userMap = new Map(users.map((u: any) => [u.id, u]));
  
  return apiData.data
    .filter((tweet: any) => tweet.text) // Only include tweets with text
    .map((tweet: any) => {
      const author = userMap.get(tweet.author_id);
      const username = author?.username ? `@${author.username}` : 'Unknown';
      
      // Extract thread title from tweet text (first 50 chars)
      const textPreview = tweet.text?.substring(0, 50).trim() || '';
      const title = threadTitle || (textPreview ? `${textPreview}...` : 'X Conversation');
      
      return {
        id: tweet.id,
        platform: Platform.X,
        username,
        content: tweet.text || '',
        timestamp: new Date(tweet.created_at).getTime(),
        type: classifyFeedbackType(tweet.text || ''),
        threadId: tweet.conversation_id || tweet.id,
        threadTitle: title,
      };
    });
}

/**
 * Fetch feedback from X/Twitter
 */
export async function fetchXFeedback(options: FeedbackFetchOptions = {}): Promise<FeedbackItem[]> {
  const allFeedback: FeedbackItem[] = [];
  let rateLimitError: Error | null = null;
  
  // Fetch mentions
  try {
    const mentionsData = await fetchMentions(options);
    const mentions = transformToFeedbackItems(mentionsData);
    allFeedback.push(...mentions);
  } catch (error) {
    console.error('Failed to fetch X mentions:', error);
    // If it's a rate limit error, throw it so user sees the message
    if (error instanceof Error && error.message.includes('Rate limit')) {
      rateLimitError = error;
    }
    // For other errors, continue and try to fetch replies
  }
  
  // Fetch replies (if search API is available)
  try {
    const repliesData = await fetchReplies(options);
    const replies = transformToFeedbackItems(repliesData);
    allFeedback.push(...replies);
  } catch (error) {
    // Search API might not be available, that's okay
    console.warn('Could not fetch X replies:', error);
    // If it's a rate limit and we don't have one already, store it
    if (error instanceof Error && error.message.includes('Rate limit') && !rateLimitError) {
      rateLimitError = error;
    }
  }
  
  // If we got a rate limit error and no feedback, throw it
  if (rateLimitError && allFeedback.length === 0) {
    throw rateLimitError;
  }
  
  // Remove duplicates (same tweet ID)
  const uniqueFeedback = Array.from(
    new Map(allFeedback.map(item => [item.id, item])).values()
  );
  
  // Sort by timestamp (newest first)
  return uniqueFeedback.sort((a, b) => b.timestamp - a.timestamp);
}

