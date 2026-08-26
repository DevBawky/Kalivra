const { app, BrowserWindow } = require('electron');
const path = require('path');
const { registerHandlers } = require('./src/main/ipcHandlers');

function createWindow () {
  const win = new BrowserWindow({
    width: 1280, height: 800,
    icon: path.join(__dirname, 'assets/AppIcon.png'),
    minWidth: 1000, minHeight: 700, frame: false, backgroundColor: '#202225',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  registerHandlers();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
