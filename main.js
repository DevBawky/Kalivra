const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'assets/AppIcon.png'),
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    backgroundColor: '#202225',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.setMenuBarVisibility(false);
  win.loadFile('index.html');

  ipcMain.on('minimize-app', () => {
    win.minimize();
  });

  ipcMain.on('maximize-app', () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.on('close-app', () => {
    win.close();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('save-json', (event, data) => {
    dialog.showSaveDialog({
        title: 'Save Project',
        defaultPath: 'balance_project.json',
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    }).then(result => {
        if (!result.canceled && result.filePath) {
            fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
            event.reply('save-finished', 'Project saved.');
        }
    }).catch(err => console.error(err));
});

ipcMain.on('load-json', (event) => {
    dialog.showOpenDialog({
        title: 'Load Project',
        properties: ['openFile'],
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    }).then(result => {
        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            event.reply('load-finished', JSON.parse(fileContent));
        }
    }).catch(err => console.error(err));
});

ipcMain.on('export-csv', (event, csvContent) => {
    dialog.showSaveDialog({
        title: 'Export to CSV',
        defaultPath: 'BalanceTable.csv',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    }).then(result => {
        if (!result.canceled && result.filePath) {
            fs.writeFileSync(result.filePath, csvContent);
            event.reply('export-finished', 'CSV Exported successfully.');
        }
    }).catch(err => console.error(err));
});