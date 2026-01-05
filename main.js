const { app, BrowserWindow } = require('electron');
const path = require('path');
const { registerHandlers } = require('./src/main/ipcHandlers');
require('dotenv').config();

function createWindow () {
  const win = new BrowserWindow({
    width: 1280, height: 800,
    icon: path.join(__dirname, 'assets/AppIcon.png'),
    minWidth: 1000, minHeight: 700, frame: false, backgroundColor: '#202225',
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  win.setMenuBarVisibility(false);
  win.loadFile('index.html');
  registerHandlers(win);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });