const fs = require('fs');
const { dialog } = require('electron');

async function saveJson(window, data) {
    const result = await dialog.showSaveDialog(window, {
        title: 'Save Project', defaultPath: 'balance_project.json',
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
        return 'Project saved.';
    }
    return null;
}

async function loadJson(window) {
    const result = await dialog.showOpenDialog(window, {
        title: 'Load Project', properties: ['openFile'],
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
    }
    return null;
}

async function exportCsv(window, content) {
    const result = await dialog.showSaveDialog(window, {
        title: 'Export to CSV', defaultPath: 'BalanceTable.csv',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });
    if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, content);
        return 'CSV Exported successfully.';
    }
    return null;
}

module.exports = { saveJson, loadJson, exportCsv };