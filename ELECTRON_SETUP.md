# Electron Desktop App Setup

BRICK can run as a native desktop app on Windows, macOS, and Linux using Electron.

## Architecture

- **Web**: Runs in browser (localhost:5173)
- **Electron**: Desktop app (Windows, macOS, Linux)
- **Capacitor**: Mobile apps (iOS, Android)

All three share the same codebase and OAuth implementation!

## Development

### Run Electron in Development Mode

```bash
npm run electron:dev
```

This will:
1. Start the Vite dev server
2. Wait for it to be ready
3. Launch Electron with hot reload

### Build Desktop App

```bash
# Build for current platform
npm run electron:build

# Build without installer (faster, for testing)
npm run electron:pack
```

Outputs will be in the `release/` directory:
- **macOS**: `.dmg` and `.zip`
- **Windows**: `.exe` installer and portable `.exe`
- **Linux**: `.AppImage` and `.deb`

## OAuth in Electron

Electron uses a custom protocol handler (`brick://`) for OAuth callbacks:

1. **User clicks "Connect X"** → Opens system browser
2. **User authorizes** → X redirects to `brick://auth/twitter/callback`
3. **OS opens Electron app** → Protocol handler catches the URL
4. **App processes callback** → OAuth completes

### Twitter Developer Portal Configuration

Add this redirect URI in your Twitter app settings:
```
brick://auth/twitter/callback
```

You can add multiple redirect URIs:
- `http://localhost:5173/auth/twitter/callback` (web dev)
- `https://yourdomain.com/auth/twitter/callback` (web prod)
- `brick://auth/twitter/callback` (Electron desktop)
- `com.brick.app://auth/twitter/callback` (Capacitor mobile)

## How It Works

### Protocol Handler Registration

The `electron/main.js` file registers `brick://` as a custom protocol. When the OS receives a `brick://` URL, it opens your Electron app.

### OAuth Flow

1. **Preload Script** (`electron/preload.js`): Safely exposes Electron APIs to renderer
2. **Main Process** (`electron/main.js`): Handles protocol URLs and sends them to renderer
3. **Renderer Process** (`App.tsx`): Listens for OAuth callbacks and processes them

### Platform-Specific Behavior

- **macOS**: Uses `app.on('open-url')` event
- **Windows/Linux**: Uses command-line arguments and `second-instance` event
- **Protocol registration**: Handled by `electron-builder` during packaging

## File Structure

```
electron/
  ├── main.js      # Main Electron process (handles app lifecycle, protocol)
  └── preload.js   # Preload script (safe bridge between main and renderer)

package.json       # Electron scripts and build config
```

## Troubleshooting

### OAuth callback not working
- Make sure `brick://auth/twitter/callback` is added in Twitter Developer Portal
- Check that protocol is registered: Try opening `brick://test` in browser
- Rebuild the app after changing protocol settings

### App won't start
- Make sure Vite dev server is running (for dev mode)
- Check that `dist/` folder exists (for production builds)
- Run `npm run build` first if building for production

### Protocol handler not registered
- Rebuild the app: `npm run electron:build`
- On macOS, you may need to allow the app in System Preferences → Security

## Distribution

### Code Signing (Recommended)

For production releases, you should code sign your app:

**macOS**: Add to `package.json` build config:
```json
"mac": {
  "identity": "Developer ID Application: Your Name"
}
```

**Windows**: Add certificate path:
```json
"win": {
  "certificateFile": "path/to/certificate.pfx",
  "certificatePassword": "password"
}
```

### Auto-Updates

Consider adding `electron-updater` for automatic updates:
```bash
npm install electron-updater
```

## Next Steps

1. Test OAuth flow in Electron: `npm run electron:dev`
2. Build desktop app: `npm run electron:build`
3. Add code signing for production releases
4. Set up auto-updates (optional)

