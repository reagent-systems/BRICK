import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.brick.app',
  appName: 'BRICK',
  webDir: 'dist',
  server: {
    // For development, you can set a custom URL
    // url: 'http://localhost:5173',
    // cleartext: true
  },
  plugins: {
    Browser: {
      // Configure browser plugin if needed
    },
    App: {
      // Handle deep links for OAuth callbacks
      // The URL scheme will be: capacitor://localhost/auth/{platform}/callback
    }
  }
};

export default config;
