const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  onOAuthCallback: (callback) => {
    ipcRenderer.on('oauth-callback', (event, url) => {
      callback(url);
    });
  },
  removeOAuthCallback: () => {
    ipcRenderer.removeAllListeners('oauth-callback');
  },
});

