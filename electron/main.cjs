const { app, BrowserWindow, protocol, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const mcpServer = require('./mcp-server.cjs');
const gitWatcher = require('./git-watcher.cjs');
const fileWatcher = require('./file-watcher.cjs');

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
      preload: path.join(__dirname, 'preload.cjs'),
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,
    icon: path.join(__dirname, '../build/icon.png'),
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shell IPC Handler (open URLs in system browser for passkey/WebAuthn support)
// ═══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('shell:openExternal', async (_event, url) => {
  await shell.openExternal(url);
});

// ═══════════════════════════════════════════════════════════════════════════════
// MCP Server IPC Handlers
// ═══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('mcp:start', async (_event, port) => {
  try {
    const result = await mcpServer.startServer(port || 3777);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('mcp:stop', async () => {
  try {
    await mcpServer.stopServer();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('mcp:status', () => {
  return mcpServer.getStatus();
});

ipcMain.handle('mcp:progressLog', () => {
  return mcpServer.getProgressLog();
});

ipcMain.handle('mcp:localIP', () => {
  return mcpServer.getLocalIP();
});

// Forward MCP progress events to renderer
mcpServer.onProgress((event) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mcp:progress', event);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Git Watcher IPC Handlers
// ═══════════════════════════════════════════════════════════════════════════════

// Open folder picker and validate as git repo
ipcMain.handle('git:selectRepo', async () => {
  if (!mainWindow) return { success: false, error: 'No window' };

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Git Repository',
    properties: ['openDirectory'],
    message: 'Choose a folder that contains a git repository',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, error: 'cancelled' };
  }

  const dirPath = result.filePaths[0];
  const validation = await gitWatcher.validateRepo(dirPath);

  if (!validation.valid) {
    return { success: false, error: validation.error || 'Not a git repository' };
  }

  return {
    success: true,
    repoPath: validation.repoRoot,
    branch: validation.branch,
  };
});

// Start watching a repo
ipcMain.handle('git:startWatching', async (_event, repoPath) => {
  return gitWatcher.startWatching(repoPath);
});

// Stop watching
ipcMain.handle('git:stopWatching', async () => {
  await gitWatcher.stopWatching();
  return { success: true };
});

// Get git watcher status
ipcMain.handle('git:status', async () => {
  return gitWatcher.getStatus();
});

// Get recent commits from the watched repo
ipcMain.handle('git:recentCommits', async (_event, limit) => {
  return gitWatcher.fetchRecentCommits(limit || 10);
});

// Get commit event log
ipcMain.handle('git:commitLog', () => {
  return gitWatcher.getCommitLog();
});

// Forward git commit events to renderer
gitWatcher.onCommit((event) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('git:commit', event);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// File Watcher IPC Handlers
// ═══════════════════════════════════════════════════════════════════════════════

// Open folder picker for file watching
ipcMain.handle('watcher:selectFolder', async () => {
  if (!mainWindow) return { success: false, error: 'No window' };

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Folder to Watch',
    properties: ['openDirectory'],
    message: 'Choose a folder to watch for file changes',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, error: 'cancelled' };
  }

  const folderPath = result.filePaths[0];

  // Immediately start watching
  const watchResult = fileWatcher.watchFolder(folderPath);
  return watchResult;
});

// Watch a specific folder (without dialog)
ipcMain.handle('watcher:watch', (_event, folderPath) => {
  return fileWatcher.watchFolder(folderPath);
});

// Stop watching a specific folder
ipcMain.handle('watcher:unwatch', (_event, folderPath) => {
  return fileWatcher.unwatchFolder(folderPath);
});

// Get watched folders list
ipcMain.handle('watcher:folders', () => {
  return fileWatcher.getWatchedFolders();
});

// Get file watcher status
ipcMain.handle('watcher:status', () => {
  return fileWatcher.getStatus();
});

// Get change event log
ipcMain.handle('watcher:changeLog', () => {
  return fileWatcher.getChangeLog();
});

// Set custom ignore patterns
ipcMain.handle('watcher:setIgnorePatterns', (_event, patterns) => {
  fileWatcher.setIgnorePatterns(patterns);
  return { success: true };
});

// Forward file change events to renderer
fileWatcher.onChange((event) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('watcher:change', event);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// OAuth Protocol Handler (with deduplication)
// ═══════════════════════════════════════════════════════════════════════════════

// Both protocol.registerHttpProtocol and app.on('open-url') can fire for the
// same brick:// URL. Deduplicate so the renderer only processes each callback once.
let lastOAuthUrl = '';
let lastOAuthTime = 0;

function sendOAuthCallback(url) {
  const now = Date.now();
  // Ignore duplicate callbacks within 5 seconds
  if (url === lastOAuthUrl && now - lastOAuthTime < 5000) {
    return;
  }
  lastOAuthUrl = url;
  lastOAuthTime = now;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('oauth-callback', url);
    mainWindow.focus();
  } else {
    createWindow();
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('oauth-callback', url);
    });
  }
}

app.setAsDefaultProtocolClient('brick');

app.whenReady().then(() => {
  // Register protocol handler (for brick:// URLs opened within Electron)
  protocol.registerHttpProtocol('brick', (request, _callback) => {
    sendOAuthCallback(request.url);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Stop all services when app closes
  mcpServer.stopServer().catch(() => {});
  gitWatcher.stopWatching().catch(() => {});
  fileWatcher.unwatchAll();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle protocol URLs when app is already running (macOS)
app.on('open-url', (event, url) => {
  event.preventDefault();
  sendOAuthCallback(url);
});

// Windows/Linux protocol handler
if (process.platform === 'win32' || process.platform === 'linux') {
  app.on('second-instance', (_event, commandLine) => {
    const url = commandLine.find(arg => arg.startsWith('brick://'));
    if (url) {
      sendOAuthCallback(url);
    }
  });

  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  }
}
