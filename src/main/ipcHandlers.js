const { ipcMain } = require('electron');
// [수정 1] exportJson을 추가로 불러옵니다.
const { saveKal, loadKal, exportCsv, exportJson } = require('./fileManager');

function registerHandlers(win) {
    ipcMain.on('min-app', () => win.minimize());
    ipcMain.on('max-app', () => win.isMaximized() ? win.unmaximize() : win.maximize());
    ipcMain.on('close-app', () => win.close());

    ipcMain.on('force-focus', (event) => {
        if (!win) return;

        if (win.isMinimized()) win.restore();

        win.setAlwaysOnTop(true);
        win.show();
        win.focus();
        
        setTimeout(() => {
            win.setAlwaysOnTop(false);
        }, 100);
    }); 

    ipcMain.on('save-kal', async (e, data) => {
        const msg = await saveKal(win, data);
        if(msg) e.reply('save-finished', msg);
    });

    ipcMain.on('load-kal', async (e) => {
        const data = await loadKal(win);
        if(data) e.reply('load-finished', data);
    });

    ipcMain.on('export-csv', async (e, content) => {
        const msg = await exportCsv(win, content);
        if(msg) e.reply('export-finished', msg);
    });

    ipcMain.on('export-json', async (e, data) => {
        const msg = await exportJson(win, data);
        if(msg) e.reply('export-finished', msg);
    });
}

module.exports = { registerHandlers };