const fs = require('fs');
const { dialog } = require('electron');

async function saveKal(window, data) {
    const result = await dialog.showSaveDialog(window, {
        title: 'Save Kalivra Project',
        defaultPath: 'project.kal',
        filters: [
            { name: 'Kalivra Files', extensions: ['kal'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (!result.canceled && result.filePath) {
        let savePath = result.filePath;
        if (!savePath.endsWith('.kal')) {
            savePath += '.kal';
        }

        try {
            fs.writeFileSync(savePath, JSON.stringify(data, null, 2));
            return 'Project saved successfully.';
        } catch (err) {
            console.error(err);
            return 'Save failed.';
        }
    }
    return null;
}

async function loadKal(window) {
    const result = await dialog.showOpenDialog(window, {
        title: 'Load Kalivra Project',
        properties: ['openFile'],
        filters: [
            { name: 'Kalivra Files', extensions: ['kal'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        try {
            const content = fs.readFileSync(result.filePaths[0], 'utf-8');
            return JSON.parse(content);
        } catch (err) {
            console.error(err);
            return null;
        }
    }
    return null;
}

async function exportCsv(window, content) {
    const result = await dialog.showSaveDialog(window, {
        title: 'Export to CSV',
        defaultPath: 'BalanceTable.csv',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });
    if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, content);
        return 'CSV Exported successfully.';
    }
    return null;
}

module.exports = { saveKal, loadKal, exportCsv };