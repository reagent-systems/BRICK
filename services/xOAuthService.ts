/**
 * X/Twitter OAuth 2.0 Service
 * Implements OAuth 2.0 with PKCE for secure authentication
 */

import { generateCodeVerifier, generateCodeChallenge, generateState } from '../utils/pkce';
import { storeOAuthState, getOAuthState, removeOAuthState, storeTokens, getTokens, OAuthTokens } from './tokenStorageService';

// X/Twitter OAuth endpoints
const TWITTER_AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
const TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const TWITTER_USER_URL = 'https://api.twitter.com/2/users/me';

// Get OAuth credentials from environment or use defaults for development
const getTwitterClientId = (): string => {
  return import.meta.env.VITE_TWITTER_CLIENT_ID || '';
};

const getTwitterClientSecret = (): string => {
  return import.meta.env.VITE_TWITTER_CLIENT_SECRET || '';
};

const getRedirectUri = (): string => {
  // Check what environment we're in
  const isElectron = (window as any).electronAPI !== undefined;
  const isCapacitor = (window as any).Capacitor !== undefined || import.meta.env.VITE_CAPACITOR === 'true';
  
  if (isElectron) {
    // Electron uses custom protocol: brick://auth/twitter/callback
    return import.meta.env.VITE_TWITTER_REDIRECT_URI || 'brick://auth/twitter/callback';
  } else if (isCapacitor) {
    // Capacitor uses app bundle ID: com.brick.app://auth/twitter/callback
    return import.meta.env.VITE_TWITTER_REDIRECT_URI || 'com.brick.app://auth/twitter/callback';
  }
  // Web uses HTTP/HTTPS
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
  const scopes = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];
  
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

  // Open browser for OAuth flow
  // Check what environment we're in
  const isElectron = (window as any).electronAPI !== undefined;
  const isCapacitor = (window as any).Capacitor !== undefined;
  
  if (isElectron) {
    // Electron: Open in default browser (protocol handler will catch callback)
    window.open(authUrl, '_blank');
  } else if (isCapacitor) {
    // Capacitor: Use Browser plugin
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: authUrl });
  } else {
    // Web: Redirect in same window
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
  const tokenResponse = await fetch(TWITTER_TOKEN_URL, {
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

  const response = await fetch(TWITTER_TOKEN_URL, {
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
 * Get X user profile
 */
export async function getXUserProfile(): Promise<any> {
  const accessToken = await ensureValidXToken();

  const response = await fetch(`${TWITTER_USER_URL}?user.fields=id,name,username,profile_image_url`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user profile: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Post a tweet to X
 */
export async function postTweet(text: string, mediaIds?: string[]): Promise<any> {
  const accessToken = await ensureValidXToken();

  const body: any = { text };
  if (mediaIds && mediaIds.length > 0) {
    body.media = { media_ids: mediaIds };
  }

  const response = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to post tweet: ${error}`);
  }

  return await response.json();
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
}

