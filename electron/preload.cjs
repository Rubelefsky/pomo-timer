// Runs in the renderer before the page, isolated from it. Exposes the few
// desktop hooks src/native.js uses; in a browser `window.desktop` is undefined.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  timerEnded: () => ipcRenderer.send("timer-ended"),
  focus: () => ipcRenderer.send("focus-window"),
});
