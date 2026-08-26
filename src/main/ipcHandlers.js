const path = require('node:path');
const { pathToFileURL } = require('node:url');

const Channels = require('../shared/ipcChannels');
const { FileManager } = require('./fileManager');

let handlersRegistered = false;

function registerHandlers({ ipc, resolveWindow, files, isTrustedSender, electron } = {}) {
    const usesDefaultIpc = !ipc;
    const runtime = electron || (usesDefaultIpc || !resolveWindow || !files || !isTrustedSender ? require('electron') : null);
    const activeIpc = ipc || runtime.ipcMain;
    if (handlersRegistered && usesDefaultIpc) return;

    const fileManager = files || new FileManager({ dialog: runtime.dialog });
    const getWindow = resolveWindow || (event => runtime.BrowserWindow.fromWebContents(event.sender));
    const trustedEntryUrl = runtime ? pathToFileURL(path.join(runtime.app.getAppPath(), 'index.html')).href : null;
    const trustSender = isTrustedSender || (event => {
        const senderUrl = event.senderFrame ? event.senderFrame.url : event.sender.getURL();
        return senderUrl === trustedEntryUrl;
    });
    const handle = (channel, handler) => {
        activeIpc.handle(channel, (event, ...args) => {
            if (!trustSender(event)) {
                return { status: 'error', code: 'UNTRUSTED_SENDER', message: 'IPC sender is not trusted.' };
            }
            return handler(event, ...args);
        });
    };

    handle(Channels.WINDOW_MINIMIZE, event => {
        const window = getWindow(event);
        if (window && !window.isDestroyed()) window.minimize();
        return { status: 'ok' };
    });
    handle(Channels.WINDOW_MAXIMIZE, event => {
        const window = getWindow(event);
        if (window && !window.isDestroyed()) {
            if (window.isMaximized()) window.unmaximize(); else window.maximize();
        }
        return { status: 'ok' };
    });
    handle(Channels.WINDOW_CLOSE, event => {
        const window = getWindow(event);
        if (window && !window.isDestroyed()) window.close();
        return { status: 'ok' };
    });
    handle(Channels.WINDOW_FOCUS, event => {
        const window = getWindow(event);
        if (!window || window.isDestroyed()) return { status: 'error', code: 'WINDOW_UNAVAILABLE' };
        if (window.isMinimized()) window.restore();
        window.setAlwaysOnTop(true);
        window.show();
        window.focus();
        setTimeout(() => {
            if (!window.isDestroyed()) window.setAlwaysOnTop(false);
        }, 100);
        return { status: 'ok' };
    });

    handle(Channels.PROJECT_SAVE, (event, payload) => {
        if (!payload || typeof payload !== 'object' || !payload.data) {
            return { status: 'error', code: 'INVALID_PAYLOAD', message: 'Project data is required.' };
        }
        return fileManager.saveProject(getWindow(event), payload.data, Boolean(payload.saveAs));
    });
    handle(Channels.PROJECT_LOAD, event => fileManager.loadProject(getWindow(event)));
    handle(Channels.EXPORT_CSV, (event, content) => fileManager.exportCsv(getWindow(event), content));
    handle(Channels.EXPORT_JSON, (event, data) => fileManager.exportJson(getWindow(event), data));

    if (usesDefaultIpc) handlersRegistered = true;
}

module.exports = { registerHandlers };
