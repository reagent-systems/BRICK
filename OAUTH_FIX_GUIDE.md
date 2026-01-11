# OAuth Implementation Fix Guide

This document explains the issues encountered when implementing Twitter/X OAuth and how they were resolved. Use this as a reference when implementing OAuth for Reddit, Discord, Email, or other platforms.

## Issues & Solutions

### 1. Capacitor Detection (Critical)

**Problem:** The app has Capacitor packages installed for mobile support. Simply checking `window.Capacitor !== undefined` returns `true` even on web browsers, causing the app to use mobile-specific code paths.

**Wrong:**
```typescript
const isCapacitor = (window as any).Capacitor !== undefined;
```

**Correct:**
```typescript
const isNativePlatform = (): boolean => {
  const capacitor = (window as any).Capacitor;
  return capacitor?.isNativePlatform?.() === true;
};
```

**Location:** `utils/platform.ts` - Central utility for all platform detection.

**Impact:** This caused:
- OAuth opening in a new tab instead of same window (used Browser plugin incorrectly)
- Wrong redirect URIs being used
- Capacitor Browser.close() errors on web

---

### 2. Storage Persistence (Critical)

**Problem:** Capacitor's `Preferences` API wasn't reliably persisting data on web. The PKCE code verifier stored before redirect was lost when the callback page loaded.

**Solution:** Created a `Storage` wrapper that uses `localStorage` directly on web and Capacitor Preferences on native:

```typescript
// In services/tokenStorageService.ts
import { isNativePlatform } from '../utils/platform';

const Storage = {
  async set(options: { key: string; value: string }): Promise<void> {
    if (isNativePlatform()) {
      await Preferences.set(options);
    } else {
      localStorage.setItem(options.key, options.value);
    }
  },
  async get(options: { key: string }): Promise<{ value: string | null }> {
    if (isNativePlatform()) {
      return await Preferences.get(options);
    } else {
      return { value: localStorage.getItem(options.key) };
    }
  },
  // ... remove and keys methods follow same pattern
};
```

---

### 3. CORS Issues (Critical for Web)

**Problem:** Browser security blocks direct API calls to OAuth token endpoints. The token exchange request to `https://api.twitter.com/2/oauth2/token` fails with CORS error.

**Solution:** Use Vite's dev server proxy to route API requests:

**vite.config.ts:**
```typescript
server: {
  port: 3000,
  host: '0.0.0.0',
  proxy: {
    '/api/twitter': {
      target: 'https://api.twitter.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/twitter/, ''),
      secure: true,
    },
    // Add more proxies for other OAuth providers:
    '/api/reddit': {
      target: 'https://oauth.reddit.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/reddit/, ''),
      secure: true,
    },
  },
},
```

**Service code:**
```typescript
// Use proxy on web, direct API on native
const getApiUrl = (path: string): string => {
  const baseUrl = isNativePlatform() ? 'https://api.twitter.com' : '/api/twitter';
  return `${baseUrl}${path}`;
};

// Usage
const response = await fetch(getApiUrl('/2/oauth2/token'), { ... });
```

**Production Note:** For production, you'll need a backend server or serverless function to proxy these requests. The Vite proxy only works in development.

---

### 4. React StrictMode Double-Processing

**Problem:** React StrictMode (enabled in development) runs effects twice. This caused the OAuth callback to be processed twice, and since authorization codes are single-use, the second attempt failed with "invalid authorization code".

**Solution:** Use `sessionStorage` flag to prevent double-processing:

```typescript
useEffect(() => {
  const PROCESSING_KEY = 'oauth_callback_processing';

  const handleOAuthRedirect = async () => {
    // ... platform detection ...

    // For web
    const url = window.location.href;
    if (url.includes('/auth/') && url.includes('callback')) {
      // Prevent double-processing
      if (sessionStorage.getItem(PROCESSING_KEY)) {
        return;
      }
      sessionStorage.setItem(PROCESSING_KEY, 'true');

      // Clean up URL immediately
      window.history.replaceState({}, document.title, '/');

      try {
        await processOAuthCallback(url);
      } finally {
        sessionStorage.removeItem(PROCESSING_KEY);
      }
    }
  };

  handleOAuthRedirect();
}, []);
```

---

### 5. Same-Window Redirect for Web

**Problem:** OAuth was opening in a new tab, breaking the flow because:
- The original tab had the stored PKCE state
- The new tab was a fresh app instance

**Solution:** On web, use `window.location.href` instead of `window.open()`:

```typescript
if (isElectron()) {
  window.open(authUrl, '_blank');  // Electron uses external browser
} else if (isNativePlatform()) {
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url: authUrl });  // Capacitor uses in-app browser
} else {
  window.location.href = authUrl;  // Web redirects in same window
}
```

---

## File Structure

```
utils/
  platform.ts          # Central platform detection (isElectron, isNativePlatform, isWeb)

services/
  tokenStorageService.ts   # Storage wrapper + token management
  oauthService.ts          # Unified OAuth interface for all platforms
  xOAuthService.ts         # Twitter/X specific implementation
  redditOAuthService.ts    # (To create) Reddit specific implementation

vite.config.ts         # Proxy configuration for development
```

---

## Checklist for New OAuth Provider

When implementing OAuth for a new platform (Reddit, Discord, Email, etc.):

1. **Add Vite Proxy** in `vite.config.ts`:
   ```typescript
   '/api/reddit': {
     target: 'https://oauth.reddit.com',
     changeOrigin: true,
     rewrite: (path) => path.replace(/^\/api\/reddit/, ''),
     secure: true,
   },
   ```

2. **Create Service File** (e.g., `redditOAuthService.ts`):
   - Import `isElectron, isNativePlatform` from `../utils/platform`
   - Create `getApiUrl()` helper for that provider
   - Implement `initiateOAuth()`, `handleCallback()`, `refreshToken()`
   - Use the `Storage` wrapper from `tokenStorageService.ts`

3. **Update `oauthService.ts`**:
   - Add the new platform to the switch statements
   - Import the new service functions

4. **Add Environment Variables**:
   ```env
   VITE_REDDIT_CLIENT_ID=xxx
   VITE_REDDIT_CLIENT_SECRET=xxx
   VITE_REDDIT_REDIRECT_URI=http://localhost:3000/auth/reddit/callback
   ```

5. **Register Redirect URI** with the OAuth provider for:
   - Web: `http://localhost:3000/auth/{provider}/callback`
   - Electron: `brick://auth/{provider}/callback`
   - Capacitor: `com.brick.app://auth/{provider}/callback`

---

## Common OAuth Endpoints

| Provider | Auth URL | Token URL |
|----------|----------|-----------|
| Twitter/X | `https://twitter.com/i/oauth2/authorize` | `https://api.twitter.com/2/oauth2/token` |
| Reddit | `https://www.reddit.com/api/v1/authorize` | `https://www.reddit.com/api/v1/access_token` |
| Discord | `https://discord.com/api/oauth2/authorize` | `https://discord.com/api/oauth2/token` |
| Google | `https://accounts.google.com/o/oauth2/v2/auth` | `https://oauth2.googleapis.com/token` |

---

## Key Takeaways

1. **Always use `isNativePlatform()`** - Never check `window.Capacitor !== undefined`
2. **Use localStorage on web** - Capacitor Preferences may not work reliably
3. **Proxy API requests on web** - CORS will block direct calls to OAuth providers
4. **Prevent double-processing** - React StrictMode will run effects twice
5. **Same-window redirect on web** - New tabs break the OAuth state flow
