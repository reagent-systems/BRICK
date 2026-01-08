const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');
const { fileURLToPath } = require('url');

// Handle protocol for OAuth callbacks
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'brick',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,
    icon: path.join(__dirname, '../dist/favicon.ico'),
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle protocol URLs (OAuth callbacks)
app.setAsDefaultProtocolClient('brick');

app.whenReady().then(() => {
  // Register protocol handler
  protocol.registerHttpProtocol('brick', (request, callback) => {
    // Handle OAuth callback
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('oauth-callback', request.url);
      mainWindow.focus();
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle protocol URLs when app is already running
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('oauth-callback', url);
    mainWindow.focus();
  } else {
    createWindow();
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('oauth-callback', url);
    });
  }
});

// Windows/Linux protocol handler
if (process.platform === 'win32' || process.platform === 'linux') {
  app.on('second-instance', (event, commandLine) => {
    // Find protocol URL in command line arguments
    const url = commandLine.find(arg => arg.startsWith('brick://'));
    if (url && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('oauth-callback', url);
      mainWindow.focus();
    } else if (url) {
      createWindow();
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.send('oauth-callback', url);
      });
    }
  });

  // Prevent multiple instances
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  }
}

