// Desktop shell (Mac / Windows): opens the built web app from dist/ in a
// window. The renderer is the same code the phone apps and browser run;
// Capacitor reports platform "web" here, so the browser fallbacks are used.
const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const path = require("node:path");

const DEV_URL = "http://localhost:5173";      // `npm run dev` server, used with --dev
const isDev = process.argv.includes("--dev");
const isMac = process.platform === "darwin";

let win = null;
let quitting = false;

// Windows ties notifications and the taskbar entry to this id; it must match
// appId in electron-builder.yml. The name also picks the userData folder, so
// dev and packaged runs share sign-in state and settings.
app.setAppUserModelId("com.rubelefsky.pomotimer");
app.setName("PomoTimer");

// A second launch just brings the existing window forward.
if (!app.requestSingleInstanceLock()) app.quit();

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createWindow() {
  win = new BrowserWindow({
    width: 560,
    height: 880,
    minWidth: 400,
    minHeight: 620,
    title: "PomoTimer",
    backgroundColor: "#0a0c16",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Keep the clock ticking at full rate while the window is hidden or minimised.
      backgroundThrottling: false,
    },
  });

  win.once("ready-to-show", () => win.show());
  win.on("focus", () => win.flashFrame(false));
  win.on("closed", () => { win = null; });

  // Mac convention: closing the window keeps the app (and a running timer) in the Dock.
  win.on("close", e => {
    if (isMac && !quitting) { e.preventDefault(); win.hide(); }
  });

  // Anything that would leave the app opens in the default browser instead.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    const inApp = isDev ? url.startsWith(DEV_URL) : url.startsWith("file:");
    if (inApp) return;
    e.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
  });

  if (isDev) {
    win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

function buildMenu() {
  if (!isMac) { Menu.setApplicationMenu(null); return; }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: "appMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ]));
}

// Renderer -> main: the timer just ended. Get the user's attention without
// stealing focus: bounce the Dock icon on Mac, flash the taskbar button on Windows.
ipcMain.on("timer-ended", () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.showInactive();
  if (isMac) app.dock?.bounce("critical");
  else win.flashFrame(true);
});

// Renderer -> main: the user clicked the notification.
ipcMain.on("focus-window", showWindow);

app.on("second-instance", showWindow);
app.on("before-quit", () => { quitting = true; });
app.on("window-all-closed", () => { if (!isMac) app.quit(); });

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on("activate", () => { if (win) showWindow(); else createWindow(); });
});
