import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { JournalApi } from './api';

const api: JournalApi = {
  platform: process.platform,
  load: () => ipcRenderer.invoke('vault:load'),
  sync: change => ipcRenderer.invoke('vault:sync', change),
  writeState: json => ipcRenderer.invoke('vault:writeState', json),
  saveAttachment: (dir, name, src) => ipcRenderer.invoke('vault:saveAttachment', dir, name, src),
  openAsset: rel => ipcRenderer.invoke('vault:openAsset', rel),
  pathForFile: file => webUtils.getPathForFile(file),
  existingFiles: candidates => ipcRenderer.invoke('fs:existingFiles', candidates),
  mkdir: rel => ipcRenderer.invoke('vault:mkdir', rel),
  chooseVault: () => ipcRenderer.invoke('vault:choose'),
  revealVault: () => ipcRenderer.invoke('vault:reveal'),
  openExternal: url => ipcRenderer.invoke('shell:openExternal', url),
  copyText: text => ipcRenderer.invoke('clipboard:write', text),
  fetchTitle: url => ipcRenderer.invoke('link:title', url),
  setTitleBar: colors => ipcRenderer.send('window:titleBar', colors),
  onFlush: fn => {
    ipcRenderer.removeAllListeners('app:flush');
    ipcRenderer.on('app:flush', () => { fn().finally(() => ipcRenderer.send('app:flushed')); });
  },
};

contextBridge.exposeInMainWorld('journal', api);
