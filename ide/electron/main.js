/**
 * YYC³ IDE — Electron 主进程
 * Phase 3 P3-5 桌面端脚手架
 */
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const isDev = process.env.NODE_ENV === "development";
const DEV_URL = "http://localhost:3030";
const DIST_PATH = path.join(__dirname, "../dist/index.html");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0d1117",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(DIST_PATH);
  }

  mainWindow.on("closed", () => { mainWindow = null; });
}

// IPC: 本地文件系统访问（安全——仅白名单路径）
ipcMain.handle("fs:readFile", async (event, filePath) => {
  const fs = require("fs/promises");
  const allowed = [app.getPath("documents"), app.getPath("desktop"), app.getPath("downloads")];
  const resolved = path.resolve(filePath);
  if (!allowed.some((dir) => resolved.startsWith(dir))) {
    throw new Error("Access denied: path not in allowed directories");
  }
  return fs.readFile(resolved, "utf-8");
});

ipcMain.handle("fs:writeFile", async (event, filePath, content) => {
  const fs = require("fs/promises");
  const allowed = [app.getPath("documents"), app.getPath("desktop"), app.getPath("downloads")];
  const resolved = path.resolve(filePath);
  if (!allowed.some((dir) => resolved.startsWith(dir))) {
    throw new Error("Access denied: path not in allowed directories");
  }
  await fs.writeFile(resolved, content, "utf-8");
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
