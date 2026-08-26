const { contextBridge, ipcRenderer } = require('electron');

const channels = Object.freeze({
  WINDOW_MINIMIZE: 'kalivra:window:minimize',
  WINDOW_MAXIMIZE: 'kalivra:window:maximize',
  WINDOW_CLOSE: 'kalivra:window:close',
  WINDOW_FOCUS: 'kalivra:window:focus',
  PROJECT_SAVE: 'kalivra:project:save',
  PROJECT_LOAD: 'kalivra:project:load',
  EXPORT_CSV: 'kalivra:export:csv',
  EXPORT_JSON: 'kalivra:export:json'
});

contextBridge.exposeInMainWorld('kalivra', Object.freeze({
  saveProject: (data, saveAs = false) => ipcRenderer.invoke(channels.PROJECT_SAVE, { data, saveAs }),
  loadProject: () => ipcRenderer.invoke(channels.PROJECT_LOAD),
  exportCsv: content => ipcRenderer.invoke(channels.EXPORT_CSV, content),
  exportJson: data => ipcRenderer.invoke(channels.EXPORT_JSON, data),
  minimizeWindow: () => ipcRenderer.invoke(channels.WINDOW_MINIMIZE),
  maximizeWindow: () => ipcRenderer.invoke(channels.WINDOW_MAXIMIZE),
  closeWindow: () => ipcRenderer.invoke(channels.WINDOW_CLOSE),
  focusWindow: () => ipcRenderer.invoke(channels.WINDOW_FOCUS)
}));
