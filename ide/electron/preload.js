/**
 * YYC³ IDE — Electron preload（安全桥接）
 * 仅暴露白名单 API，不暴露完整 Node.js
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  readFile: (path) => ipcRenderer.invoke("fs:readFile", path),
  writeFile: (path, content) => ipcRenderer.invoke("fs:writeFile", path, content),
  platform: process.platform,
});
