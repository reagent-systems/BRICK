# OAuth Setup Guide for X/Twitter

This guide will help you set up X/Twitter OAuth for BRICK.

## Prerequisites

1. A Twitter Developer Account
2. A Twitter App created in the [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)

## Step 1: Create a Twitter App

1. Go to https://developer.twitter.com/en/portal/dashboard
2. Create a new App or use an existing one
3. Note your **Client ID** and **Client Secret**

## Step 2: Configure OAuth Settings

In your Twitter App settings:

1. Go to **User authentication settings**
2. Set **App permissions** to:
   - Read and write
   - Direct message (optional)
3. Set **Type of App** to: Web App, Automated App or Bot
4. Add **Callback URI / Redirect URL**:
   - For web development: `http://localhost:5173/auth/twitter/callback`
   - For production: `https://yourdomain.com/auth/twitter/callback`
   - For Capacitor (mobile): `capacitor://localhost/auth/twitter/callback`
5. Set **Website URL** (required): Your app's website URL
6. Save settings

## Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```
   VITE_TWITTER_CLIENT_ID=your_client_id_here
   VITE_TWITTER_CLIENT_SECRET=your_client_secret_here
   VITE_TWITTER_REDIRECT_URI=http://localhost:5173/auth/twitter/callback
   VITE_CAPACITOR=false
   ```

## Step 4: Test the OAuth Flow

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Go through the onboarding flow
3. Click "Connect" on the X platform
4. You should be redirected to Twitter for authorization
5. After authorizing, you'll be redirected back to the app

## Troubleshooting

### "Twitter Client ID not configured"
- Make sure your `.env` file exists and contains `VITE_TWITTER_CLIENT_ID`
- Restart your dev server after changing `.env` files

### "Invalid redirect URI"
- Make sure the redirect URI in your `.env` matches exactly what's configured in Twitter Developer Portal
- Check for trailing slashes or protocol mismatches (http vs https)

### OAuth callback not working
- For web: Make sure your redirect URI matches your dev server URL
- For Capacitor: Ensure deep linking is configured in `capacitor.config.ts`

## Security Notes

- **Never commit your `.env` file** - it contains sensitive credentials
- The `.env` file is already in `.gitignore`
- For production, use environment variables provided by your hosting platform
- Consider using a backend proxy for OAuth flows in production (see implementation plan)

## Next Steps

Once X OAuth is working, you can:
- Implement Reddit OAuth
- Implement Discord OAuth  
- Implement Email OAuth (Gmail/Outlook)
- Add posting functionality using the stored tokens

