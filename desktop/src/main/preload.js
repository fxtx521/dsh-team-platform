'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('wb', {
  snapshot: () => ipcRenderer.invoke('app:snapshot'),
  saveConfig: (patch) => ipcRenderer.invoke('app:saveConfig', patch),
  pickFolder: () => ipcRenderer.invoke('project:pickFolder'),
  addProject: (p) => ipcRenderer.invoke('project:add', p),
  removeProject: (id) => ipcRenderer.invoke('project:remove', id),
  listFiles: (p) => ipcRenderer.invoke('project:listFiles', p),
  readFile: (p) => ipcRenderer.invoke('project:readFile', p),
  writeFile: (p) => ipcRenderer.invoke('project:writeFile', p),
  openInFinder: (d) => ipcRenderer.invoke('project:openInFinder', d),
  reveal: (f) => ipcRenderer.invoke('project:reveal', f),
  runCmd: (p) => ipcRenderer.invoke('cmd:run', p),
  heartbeat: () => ipcRenderer.invoke('cloud:heartbeat'),
  tasks: () => ipcRenderer.invoke('cloud:tasks'),
  skills: () => ipcRenderer.invoke('cloud:skills'),
  skillStats: () => ipcRenderer.invoke('cloud:skillStats'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  onState: (cb) => ipcRenderer.on('app:state', (_e, d) => cb(d)),
  onLog: (cb) => ipcRenderer.on('app:log', (_e, d) => cb(d)),
  onGoto: (cb) => ipcRenderer.on('app:goto', (_e, d) => cb(d)),
});
