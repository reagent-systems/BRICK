/**
 * X API (pay-per-use / v2) host configuration.
 *
 * - REST + OAuth token: https://api.x.com (see https://docs.x.com/x-api/introduction )
 * - User authorization: https://x.com/i/oauth2/authorize
 * - OAuth token / refresh: POST https://api.x.com/2/oauth2/token
 *
 * Migrate apps created under developer.twitter.com to the X Developer Console
 * (console.x.com) and usage-based billing as documented there.
 */

/** Base URL for X API v2 and OAuth 2.0 token endpoints */
export const X_API_BASE = 'https://api.x.com';

/** Browser dev proxy path (see vite.config.ts) — forwards to X_API_BASE */
export const X_API_PROXY_PATH = '/api/twitter';

/** OAuth 2.0 authorization page (PKCE) */
export const X_OAUTH_AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize';

/**
 * Media upload still uses the v1.1 `media/upload` contract.
 * Hosted on the same API domain as v2 for the current X platform.
 */
export const X_MEDIA_UPLOAD_PATH = '/1.1/media/upload.json';

export function getNativeXApiBase(): string {
  return X_API_BASE;
}

/** All /2/* and /1.1/* calls (OAuth, tweets, users, media) when not using the dev proxy */
export function getXApiUrl(path: string): string {
  return `${X_API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
