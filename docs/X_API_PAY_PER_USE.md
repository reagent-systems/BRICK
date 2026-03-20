# X API (pay-per-use)

BRICK calls the **current X REST API** at **`https://api.x.com`** (same `/2/...` paths as the legacy `api.twitter.com` host). Authorization uses **`https://x.com/i/oauth2/authorize`** and token exchange **`POST https://api.x.com/2/oauth2/token`**, per [X API introduction](https://docs.x.com/x-api/introduction) and [OAuth 2.0 with PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token).

## What you need to do (console / billing)

1. **Developer Console** — [console.x.com](https://console.x.com): create or migrate your app, enable OAuth 2.0, and set the same redirect URIs you use for BRICK (`brick://...`, web callback, etc.).
2. **Keys** — Use the app’s **Client ID** and **Client Secret** in `VITE_TWITTER_CLIENT_ID` / `VITE_TWITTER_CLIENT_SECRET` (or your env naming).
3. **Pay-per-use** — Purchase API credits and attach the app to the usage-based plan as described in [pricing](https://docs.x.com/x-api/getting-started/pricing). Old “free tier bucket” limits are separate from usage-based billing.
4. **Scopes** — BRICK requests: `tweet.read`, `tweet.write`, `users.read`, `offline.access`, `media.write`. Ensure the app is allowed to request these in the console.

## What changed in code

- Central config: `services/xApiConfig.ts` (`api.x.com`, `x.com` authorize).
- OAuth + REST + media paths: `services/xOAuthService.ts`.
- Feedback (mentions/timeline): `services/platforms/xFeedbackService.ts`.
- Dev proxy: `vite.config.ts` proxies `/api/twitter` → `https://api.x.com`.

## Re-connect X in the app

After migrating the app in the console, **disconnect and reconnect** X in BRICK so tokens are issued against the new project settings if anything changed.

## If media upload fails

Media uses **`/1.1/media/upload.json`** on the same `api.x.com` host. If you see upload errors, check the [Media](https://docs.x.com/x-api/media/introduction) docs for your plan; some teams still use `upload.twitter.com` for v1.1 media — you can add an env override later if X documents a different host.
