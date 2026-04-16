const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),
  saveFile: (fileName, data) => ipcRenderer.invoke('save-file', { fileName, data }),
  loadFile: (fileName) => ipcRenderer.invoke('load-file', { fileName }),
});