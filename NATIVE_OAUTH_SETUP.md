# Native App OAuth Setup (iOS/Android)

When building native apps with Capacitor, OAuth works differently than web apps. Here's how to set it up:

## How Native OAuth Works

1. **User clicks "Connect X"** → Opens browser (Safari/Chrome)
2. **User authorizes** → X redirects to `com.brick.app://auth/twitter/callback`
3. **Deep link opens app** → Capacitor handles the URL scheme
4. **App processes callback** → Exchanges code for token

## Configuration Steps

### 1. iOS Configuration (Already Done)

The `Info.plist` has been configured with:
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.brick.app</string>
        </array>
    </dict>
</array>
```

This allows iOS to recognize `com.brick.app://` URLs and open your app.

### 2. Android Configuration (Already Done)

The `AndroidManifest.xml` has been configured with:
```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="com.brick.app" />
</intent-filter>
```

This allows Android to recognize `com.brick.app://` URLs and open your app.

### 3. Twitter Developer Portal Configuration

**CRITICAL:** You MUST add the native app redirect URI in Twitter Developer Portal:

1. Go to https://developer.twitter.com/en/portal/dashboard
2. Open your app → **User authentication settings**
3. Add **Callback URI / Redirect URL**:
   ```
   com.brick.app://auth/twitter/callback
   ```
4. Save settings

**Important:** You can add MULTIPLE redirect URIs:
- `http://localhost:5173/auth/twitter/callback` (for web)
- `https://yourdomain.com/auth/twitter/callback` (for production web)
- `com.brick.app://auth/twitter/callback` (for native iOS/Android)

### 4. Environment Variables

For native builds, set in your `.env`:
```bash
VITE_TWITTER_CLIENT_ID=your_oauth2_client_id
VITE_TWITTER_CLIENT_SECRET=your_oauth2_client_secret
VITE_TWITTER_REDIRECT_URI=com.brick.app://auth/twitter/callback
VITE_CAPACITOR=true
```

Or the app will auto-detect Capacitor and use the bundle ID scheme.

## Testing Native OAuth

### iOS
1. Build and run on device/simulator:
   ```bash
   npm run cap:ios
   ```
2. Click "Connect X" in the app
3. Safari opens for authorization
4. After authorizing, Safari redirects to `com.brick.app://...`
5. iOS opens your app automatically
6. OAuth completes!

### Android
1. Build and run on device/emulator:
   ```bash
   npm run cap:android
   ```
2. Click "Connect X" in the app
3. Chrome opens for authorization
4. After authorizing, Chrome redirects to `com.brick.app://...`
5. Android opens your app automatically
6. OAuth completes!

## Troubleshooting

### "Invalid redirect URI" error
- Make sure `com.brick.app://auth/twitter/callback` is added in Twitter Developer Portal
- Check that the URL scheme matches exactly (no typos)

### App doesn't open after authorization
- Verify URL scheme is configured in `Info.plist` (iOS) and `AndroidManifest.xml` (Android)
- Rebuild the native app after making changes
- Check device logs for deep link errors

### Browser opens but doesn't redirect
- Verify redirect URI is set correctly in Twitter Developer Portal
- Check that the URL scheme matches your bundle ID (`com.brick.app`)

## How It Works Internally

1. **Capacitor Browser Plugin** opens OAuth URL
2. **User authorizes** in browser
3. **X redirects** to `com.brick.app://auth/twitter/callback?code=...&state=...`
4. **iOS/Android** recognizes the URL scheme and opens your app
5. **Capacitor App Plugin** fires `appUrlOpen` event
6. **Your app** processes the callback and exchanges code for token
7. **Browser closes** automatically

The implementation handles all of this automatically!

