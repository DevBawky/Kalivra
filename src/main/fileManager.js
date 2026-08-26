const fs = require('node:fs/promises');
const path = require('node:path');

const ProjectDocument = require('../domain/projectDocument');

class FileManager {
    constructor({ dialog, fileSystem = fs, clock = Date.now, processId = process.pid } = {}) {
        if (!dialog) throw new TypeError('FileManager requires an Electron dialog adapter.');
        this.dialog = dialog;
        this.fileSystem = fileSystem;
        this.clock = clock;
        this.processId = processId;
        this.currentFilePath = null;
    }

    async saveProject(window, data, forceNewPath = false) {
        try {
            const content = ProjectDocument.serializeProjectDocument(data);
            const reuseCurrentPath = this.currentFilePath && !forceNewPath;
            let savePath = this.currentFilePath;

            if (!reuseCurrentPath) {
                const result = await this.dialog.showSaveDialog(window, {
                    title: 'Save Kalivra Project',
                    defaultPath: 'project.kal',
                    filters: [
                        { name: 'Kalivra Files', extensions: ['kal'] },
                        { name: 'All Files', extensions: ['*'] }
                    ]
                });
                if (result.canceled || !result.filePath) return { status: 'cancelled' };
                savePath = this.ensureExtension(result.filePath, '.kal');
            }

            await this.writeTextAtomic(savePath, content);
            this.currentFilePath = savePath;
            return {
                status: 'ok',
                filePath: savePath,
                reusedPath: Boolean(reuseCurrentPath),
                message: reuseCurrentPath ? 'Project saved.' : 'Project saved successfully.'
            };
        } catch (error) {
            return this.errorResult('SAVE_FAILED', 'Could not save the project.', error);
        }
    }

    async loadProject(window) {
        const result = await this.dialog.showOpenDialog(window, {
            title: 'Load Kalivra Project',
            properties: ['openFile'],
            filters: [
                { name: 'Kalivra Files', extensions: ['kal'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        if (result.canceled || result.filePaths.length === 0) return { status: 'cancelled' };

        const selectedPath = result.filePaths[0];
        try {
            const content = await this.fileSystem.readFile(selectedPath, 'utf8');
            const data = ProjectDocument.parseProjectDocument(content);
            this.currentFilePath = selectedPath;
            return { status: 'ok', filePath: selectedPath, data };
        } catch (error) {
            return this.errorResult('LOAD_FAILED', 'Could not load the project.', error);
        }
    }

    async exportCsv(window, content) {
        if (typeof content !== 'string') {
            return { status: 'error', code: 'INVALID_CSV', message: 'CSV export content must be text.' };
        }
        const result = await this.dialog.showSaveDialog(window, {
            title: 'Export to CSV',
            defaultPath: 'BalanceTable.csv',
            filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        });
        if (result.canceled || !result.filePath) return { status: 'cancelled' };

        try {
            const exportPath = this.ensureExtension(result.filePath, '.csv');
            await this.writeTextAtomic(exportPath, content);
            return { status: 'ok', filePath: exportPath, message: 'CSV exported successfully.' };
        } catch (error) {
            return this.errorResult('EXPORT_FAILED', 'Could not export CSV.', error);
        }
    }

    async exportJson(window, data) {
        const result = await this.dialog.showSaveDialog(window, {
            title: 'Export Balance Data (JSON)',
            defaultPath: 'BalanceData_Share.json',
            filters: [{ name: 'JSON Files', extensions: ['json'] }]
        });
        if (result.canceled || !result.filePath) return { status: 'cancelled' };

        try {
            const exportPath = this.ensureExtension(result.filePath, '.json');
            await this.writeTextAtomic(exportPath, JSON.stringify(data, null, 2));
            return { status: 'ok', filePath: exportPath, message: 'Balance data exported successfully.' };
        } catch (error) {
            return this.errorResult('EXPORT_FAILED', 'Could not export JSON.', error);
        }
    }

    ensureExtension(filePath, extension) {
        return filePath.toLowerCase().endsWith(extension) ? filePath : `${filePath}${extension}`;
    }

    async writeTextAtomic(targetPath, content) {
        const directory = path.dirname(targetPath);
        const baseName = path.basename(targetPath);
        const suffix = `${this.processId}-${this.clock()}`;
        const temporaryPath = path.join(directory, `.${baseName}.${suffix}.tmp`);
        const backupPath = path.join(directory, `.${baseName}.${suffix}.bak`);
        let backupCreated = false;

        await this.fileSystem.writeFile(temporaryPath, content, 'utf8');
        try {
            try {
                await this.fileSystem.rename(temporaryPath, targetPath);
            } catch (error) {
                if (!['EACCES', 'EEXIST', 'EPERM'].includes(error.code)) throw error;
                try {
                    await this.fileSystem.rename(targetPath, backupPath);
                    backupCreated = true;
                } catch (backupError) {
                    if (backupError.code !== 'ENOENT') throw backupError;
                }
                try {
                    await this.fileSystem.rename(temporaryPath, targetPath);
                } catch (replaceError) {
                    if (backupCreated) await this.fileSystem.rename(backupPath, targetPath);
                    throw replaceError;
                }
            }
            if (backupCreated) await this.fileSystem.unlink(backupPath);
        } finally {
            await this.fileSystem.unlink(temporaryPath).catch(() => {});
        }
    }

    errorResult(code, message, error) {
        return {
            status: 'error',
            code,
            message,
            details: error instanceof ProjectDocument.ProjectDocumentError ? error.message : undefined
        };
    }
}

module.exports = { FileManager };
