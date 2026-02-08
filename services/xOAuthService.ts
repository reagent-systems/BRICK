/**
 * X/Twitter OAuth 2.0 Service
 * Implements OAuth 2.0 with PKCE for secure authentication
 */

import { generateCodeVerifier, generateCodeChallenge, generateState } from '../utils/pkce';
import { storeOAuthState, getOAuthState, removeOAuthState, storeTokens, getTokens, OAuthTokens } from './tokenStorageService';
import { isElectron, isNativePlatform } from '../utils/platform';

// Rate limit information interface
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
}

// Cached user profile to avoid redundant API calls
let cachedUserProfile: { id: string; username: string; name: string; profile_image_url?: string } | null = null;
let profileCacheExpiry: number = 0;
const PROFILE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// X/Twitter OAuth endpoints
const TWITTER_AUTH_URL = 'https://twitter.com/i/oauth2/authorize';

// API URLs - use proxy on web to avoid CORS, direct API on native
const getApiUrl = (path: string): string => {
  const baseUrl = isNativePlatform() ? 'https://api.twitter.com' : '/api/twitter';
  return `${baseUrl}${path}`;
};

// Get OAuth credentials from environment or use defaults for development
const getTwitterClientId = (): string => {
  return import.meta.env.VITE_TWITTER_CLIENT_ID || '';
};

const getTwitterClientSecret = (): string => {
  return import.meta.env.VITE_TWITTER_CLIENT_SECRET || '';
};

const getRedirectUri = (): string => {
  if (isElectron()) {
    // Electron ALWAYS uses custom protocol — never localhost.
    // The brick:// handler in the main process catches the callback.
    return 'brick://auth/twitter/callback';
  } else if (isNativePlatform()) {
    // Capacitor (iOS/Android) uses the app bundle scheme.
    return 'com.brick.app://auth/twitter/callback';
  }
  // Web fallback (dev/preview only) — use env or origin
  return import.meta.env.VITE_TWITTER_REDIRECT_URI || `${window.location.origin}/auth/twitter/callback`;
};

/**
 * Initiate X OAuth flow
 * Opens browser for user authorization
 */
export async function initiateXOAuth(): Promise<void> {
  const clientId = getTwitterClientId();
  if (!clientId) {
    throw new Error('Twitter Client ID not configured. Please set VITE_TWITTER_CLIENT_ID');
  }

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

  // Store code verifier with state (will be retrieved in callback)
  await storeOAuthState(state, {
    codeVerifier,
    platform: 'x',
  });

  // Build authorization URL
  const redirectUri = getRedirectUri();
  const scopes = ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'media.write'];
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `${TWITTER_AUTH_URL}?${params.toString()}`;

  // Open browser for OAuth flow based on platform
  if (isElectron()) {
    // Electron: Open in system browser (Safari/Chrome) for passkey/WebAuthn support.
    // The brick:// protocol handler will catch the callback.
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.openExternal) {
      await electronAPI.openExternal(authUrl);
    } else {
      // Fallback: open in new window (passkeys won't work here)
      window.open(authUrl, '_blank');
    }
  } else if (isNativePlatform()) {
    // Capacitor Native (iOS/Android): Use Browser plugin
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: authUrl });
  } else {
    // Web: Redirect in same window (keeps React app context)
    window.location.href = authUrl;
  }
}

/**
 * Handle X OAuth callback
 * Exchange authorization code for access token
 */
export async function handleXOAuthCallback(code: string, state: string): Promise<OAuthTokens> {
  // Retrieve stored code verifier
  const stateData = await getOAuthState(state);

  if (!stateData || stateData.platform !== 'x') {
    throw new Error('Invalid or expired OAuth state');
  }

  const { codeVerifier } = stateData;
  const clientId = getTwitterClientId();
  const clientSecret = getTwitterClientSecret();
  const redirectUri = getRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error('Twitter OAuth credentials not configured');
  }

  // Exchange authorization code for access token
  const tokenResponse = await fetch(getApiUrl('/2/oauth2/token'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokenData = await tokenResponse.json();

  // Calculate expiration time
  const expiresIn = tokenData.expires_in || 7200; // Default 2 hours
  const expiresAt = Date.now() + expiresIn * 1000;

  const tokens: OAuthTokens = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt,
    tokenType: tokenData.token_type || 'Bearer',
    scope: tokenData.scope,
  };

  // Store tokens securely
  await storeTokens('x', tokens);

  // Clean up temporary state
  await removeOAuthState(state);

  return tokens;
}

/**
 * Refresh X access token
 */
export async function refreshXToken(): Promise<OAuthTokens> {
  const tokens = await getTokens('x');
  if (!tokens || !tokens.refreshToken) {
    throw new Error('No refresh token available');
  }

  const clientId = getTwitterClientId();
  const clientSecret = getTwitterClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error('Twitter OAuth credentials not configured');
  }

  const response = await fetch(getApiUrl('/2/oauth2/token'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const tokenData = await response.json();
  const expiresIn = tokenData.expires_in || 7200;
  const expiresAt = Date.now() + expiresIn * 1000;

  const newTokens: OAuthTokens = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || tokens.refreshToken,
    expiresAt,
    tokenType: tokenData.token_type || 'Bearer',
    scope: tokenData.scope || tokens.scope,
  };

  await storeTokens('x', newTokens);
  return newTokens;
}

/**
 * Ensure X token is valid, refresh if needed
 */
export async function ensureValidXToken(): Promise<string> {
  const tokens = await getTokens('x');
  if (!tokens) {
    throw new Error('Not authenticated with X');
  }

  // Check if token is expired or expiring soon (5 minute buffer)
  const now = Date.now();
  const expiresAt = tokens.expiresAt;
  const buffer = 5 * 60 * 1000; // 5 minutes

  if (expiresAt <= now + buffer) {
    // Token expired or expiring soon, refresh it
    const newTokens = await refreshXToken();
    return newTokens.accessToken;
  }

  return tokens.accessToken;
}

/**
 * Parse rate limit headers from X API response
 */
function parseRateLimitHeaders(response: Response): RateLimitInfo | null {
  const limit = response.headers.get('x-rate-limit-limit');
  const remaining = response.headers.get('x-rate-limit-remaining');
  const reset = response.headers.get('x-rate-limit-reset');

  if (limit && remaining && reset) {
    return {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      reset: parseInt(reset, 10),
    };
  }

  return null;
}

/**
 * Get X user profile (with caching)
 */
export async function getXUserProfile(forceRefresh: boolean = false): Promise<any> {
  // Return cached profile if still valid
  if (!forceRefresh && cachedUserProfile && Date.now() < profileCacheExpiry) {
    return {
      data: cachedUserProfile,
    };
  }

  const accessToken = await ensureValidXToken();

  const response = await fetch(`${getApiUrl('/2/users/me')}?user.fields=id,name,username,profile_image_url`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user profile: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Cache the profile data
  if (data.data) {
    cachedUserProfile = {
      id: data.data.id,
      username: data.data.username,
      name: data.data.name,
      profile_image_url: data.data.profile_image_url,
    };
    profileCacheExpiry = Date.now() + PROFILE_CACHE_DURATION;
  }

  return data;
}

/**
 * Get cached user profile (lightweight, no API call)
 */
export function getCachedUserProfile(): { id: string; username: string; name: string } | null {
  return cachedUserProfile;
}

/**
 * Clear user profile cache (useful when disconnecting)
 */
export function clearUserProfileCache(): void {
  cachedUserProfile = null;
  profileCacheExpiry = 0;
}

/**
 * Fetch the authenticated user's recent tweets for tone calibration.
 * Returns an array of tweet text strings.
 */
export async function fetchRecentTweets(count: number = 20): Promise<string[]> {
  const accessToken = await ensureValidXToken();

  // First get the user ID
  const profile = await getXUserProfile();
  const userId = profile.data?.id;
  if (!userId) {
    throw new Error('Could not determine user ID');
  }

  // Fetch recent tweets (exclude replies and retweets for cleaner tone data)
  const params = new URLSearchParams({
    'max_results': Math.min(count, 100).toString(),
    'exclude': 'replies,retweets',
    'tweet.fields': 'created_at,text',
  });

  const response = await fetch(`${getApiUrl(`/2/users/${userId}/tweets`)}?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('X API rate limit reached. The free tier allows very few reads per 15 minutes. Wait a bit and try again.');
    }
    const error = await response.text();
    throw new Error(`Failed to fetch tweets: ${error}`);
  }

  const data = await response.json();

  if (!data.data || !Array.isArray(data.data)) {
    return [];
  }

  // Return just the text of each tweet
  return data.data.map((tweet: { text: string }) => tweet.text);
}

/**
 * Upload media to X (images, videos, etc.)
 * Returns media_id that can be used in postTweet
 */
export async function uploadMedia(file: File | Blob, mediaType: 'image' | 'video' = 'image'): Promise<string> {
  const accessToken = await ensureValidXToken();

  // Step 1: Initialize media upload
  const formData = new FormData();
  formData.append('media', file);
  formData.append('media_category', mediaType === 'image' ? 'tweet_image' : 'tweet_video');

  const initResponse = await fetch(getApiUrl('/1.1/media/upload.json'), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!initResponse.ok) {
    const error = await initResponse.text();
    throw new Error(`Failed to upload media: ${error}`);
  }

  const mediaData = await initResponse.json();
  
  // For videos, we might need to check processing status
  if (mediaType === 'video' && mediaData.processing_info) {
    // Poll for processing completion
    const checkStatus = async (): Promise<string> => {
      const statusResponse = await fetch(
        `${getApiUrl('/1.1/media/upload.json')}?command=STATUS&media_id=${mediaData.media_id_string}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      
      if (!statusResponse.ok) {
        throw new Error('Failed to check media status');
      }
      
      const statusData = await statusResponse.json();
      
      if (statusData.processing_info.state === 'succeeded') {
        return mediaData.media_id_string;
      } else if (statusData.processing_info.state === 'failed') {
        throw new Error('Media processing failed');
      } else {
        // Still processing, wait and retry
        await new Promise(resolve => setTimeout(resolve, statusData.processing_info.check_after_secs * 1000));
        return checkStatus();
      }
    };
    
    return checkStatus();
  }

  return mediaData.media_id_string;
}

/**
 * Post a tweet to X
 * Returns tweet data including rate limit info
 */
export async function postTweet(
  text: string, 
  mediaIds?: string[]
): Promise<{ data: any; rateLimit?: RateLimitInfo }> {
  const accessToken = await ensureValidXToken();

  const body: any = { text };
  if (mediaIds && mediaIds.length > 0) {
    body.media = { media_ids: mediaIds };
  }

  const response = await fetch(getApiUrl('/2/tweets'), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    const rateLimit = parseRateLimitHeaders(response);
    
    // Check for rate limit error
    if (response.status === 429) {
      const resetTime = rateLimit?.reset ? new Date(rateLimit.reset * 1000).toLocaleTimeString() : 'soon';
      throw new Error(`Rate limit exceeded. Try again after ${resetTime}. Remaining: ${rateLimit?.remaining || 0}`);
    }
    
    throw new Error(`Failed to post tweet: ${error}`);
  }

  const data = await response.json();
  const rateLimit = parseRateLimitHeaders(response);

  return { data, rateLimit };
}

/**
 * Post a thread (multiple connected tweets) to X
 * Splits content by double newlines or automatically if content is too long
 */
export async function postTweetThread(
  tweets: string[],
  mediaIds?: string[][]
): Promise<{ tweets: any[]; rateLimit?: RateLimitInfo }> {
  const accessToken = await ensureValidXToken();
  const postedTweets: any[] = [];
  let lastTweetId: string | undefined;
  let rateLimit: RateLimitInfo | undefined;

  for (let i = 0; i < tweets.length; i++) {
    const tweetText = tweets[i];
    const body: any = { text: tweetText };
    
    // Add reply reference if this is not the first tweet
    if (lastTweetId) {
      body.reply = { in_reply_to_tweet_id: lastTweetId };
    }
    
    // Add media if provided
    if (mediaIds && mediaIds[i] && mediaIds[i].length > 0) {
      body.media = { media_ids: mediaIds[i] };
    }

    const response = await fetch(getApiUrl('/2/tweets'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      const parsedRateLimit = parseRateLimitHeaders(response);
      
      if (response.status === 429) {
        const resetTime = parsedRateLimit?.reset ? new Date(parsedRateLimit.reset * 1000).toLocaleTimeString() : 'soon';
        throw new Error(`Rate limit exceeded while posting thread. Try again after ${resetTime}. Posted ${postedTweets.length} of ${tweets.length} tweets.`);
      }
      
      throw new Error(`Failed to post tweet ${i + 1} of ${tweets.length}: ${error}`);
    }

    const tweetData = await response.json();
    const parsedRateLimit = parseRateLimitHeaders(response);
    
    if (parsedRateLimit) {
      rateLimit = parsedRateLimit;
    }
    
    if (tweetData.data?.id) {
      lastTweetId = tweetData.data.id;
      postedTweets.push(tweetData.data);
    }

    // Small delay between tweets to avoid rate limits
    if (i < tweets.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return { tweets: postedTweets, rateLimit };
}

/**
 * Check if user is connected to X
 */
export async function isXConnected(): Promise<boolean> {
  try {
    const tokens = await getTokens('x');
    return tokens !== null;
  } catch {
    return false;
  }
}

/**
 * Disconnect X account
 */
export async function disconnectX(): Promise<void> {
  const { removeTokens } = await import('./tokenStorageService');
  await removeTokens('x');
  clearUserProfileCache();
}

