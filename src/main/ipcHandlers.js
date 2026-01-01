const { ipcMain } = require('electron');
const { saveJson, loadJson, exportCsv } = require('./fileManager');

function registerHandlers(win) {
    ipcMain.on('minimize-app', () => win.minimize());
    ipcMain.on('maximize-app', () => win.isMaximized() ? win.unmaximize() : win.maximize());
    ipcMain.on('close-app', () => win.close());

    ipcMain.on('save-json', async (e, data) => {
        const msg = await saveJson(win, data);
        if(msg) e.reply('save-finished', msg);
    });

    ipcMain.on('load-json', async (e) => {
        const data = await loadJson(win);
        if(data) e.reply('load-finished', data);
    });

    ipcMain.on('export-csv', async (e, content) => {
        const msg = await exportCsv(win, content);
        if(msg) e.reply('export-finished', msg);
    });
}
module.exports = { registerHandlers };