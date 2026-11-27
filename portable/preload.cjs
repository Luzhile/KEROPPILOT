const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('keroppilotDesktop', {
  readKey: () => ipcRenderer.invoke('key:read'),
  saveKey: key => ipcRenderer.invoke('key:save', key),
  clearKey: () => ipcRenderer.invoke('key:clear'),
  pin: value => ipcRenderer.invoke('window:pin', value),
  copy: text => ipcRenderer.invoke('clipboard:copy', text),
  open: destination => ipcRenderer.invoke('external:open', destination),
});
