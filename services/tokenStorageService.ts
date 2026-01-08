/**
 * Secure token storage service
 * Uses Capacitor Preferences for encrypted storage
 */

import { Preferences } from '@capacitor/preferences';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Unix timestamp in milliseconds
  tokenType?: string;
  scope?: string;
}

const TOKEN_PREFIX = 'oauth_tokens_';
const STATE_PREFIX = 'oauth_state_';

/**
 * Store OAuth tokens securely for a platform
 */
export async function storeTokens(platform: string, tokens: OAuthTokens): Promise<void> {
  const key = `${TOKEN_PREFIX}${platform}`;
  await Preferences.set({
    key,
    value: JSON.stringify(tokens),
  });
}

/**
 * Retrieve OAuth tokens for a platform
 */
export async function getTokens(platform: string): Promise<OAuthTokens | null> {
  const key = `${TOKEN_PREFIX}${platform}`;
  const result = await Preferences.get({ key });
  
  if (!result.value) {
    return null;
  }
  
  try {
    return JSON.parse(result.value) as OAuthTokens;
  } catch {
    return null;
  }
}

/**
 * Check if tokens exist and are valid (not expired)
 */
export async function hasValidTokens(platform: string): Promise<boolean> {
  const tokens = await getTokens(platform);
  if (!tokens) {
    return false;
  }
  
  // Check if token is expired (with 5 minute buffer)
  const now = Date.now();
  const expiresAt = tokens.expiresAt;
  return expiresAt > now + 5 * 60 * 1000; // 5 minute buffer
}

/**
 * Store temporary OAuth state (for PKCE code verifier)
 * Expires after 10 minutes
 */
export async function storeOAuthState(
  state: string,
  data: { codeVerifier: string; platform: string }
): Promise<void> {
  const key = `${STATE_PREFIX}${state}`;
  const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes
  const value = JSON.stringify({ ...data, expiry });
  
  await Preferences.set({ key, value });
}

/**
 * Retrieve OAuth state data
 */
export async function getOAuthState(state: string): Promise<{ codeVerifier: string; platform: string } | null> {
  const key = `${STATE_PREFIX}${state}`;
  const result = await Preferences.get({ key });
  
  if (!result.value) {
    return null;
  }
  
  try {
    const data = JSON.parse(result.value) as { codeVerifier: string; platform: string; expiry: number };
    
    // Check if expired
    if (Date.now() > data.expiry) {
      await Preferences.remove({ key });
      return null;
    }
    
    return { codeVerifier: data.codeVerifier, platform: data.platform };
  } catch {
    return null;
  }
}

/**
 * Remove OAuth state after use
 */
export async function removeOAuthState(state: string): Promise<void> {
  const key = `${STATE_PREFIX}${state}`;
  await Preferences.remove({ key });
}

/**
 * Remove tokens for a platform (disconnect)
 */
export async function removeTokens(platform: string): Promise<void> {
  const key = `${TOKEN_PREFIX}${platform}`;
  await Preferences.remove({ key });
}

/**
 * Get all connected platforms
 */
export async function getConnectedPlatforms(): Promise<string[]> {
  const keys = await Preferences.keys();
  return keys.keys
    .filter(key => key.startsWith(TOKEN_PREFIX))
    .map(key => key.replace(TOKEN_PREFIX, ''));
}

