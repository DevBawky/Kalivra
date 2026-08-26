const test = require('node:test');
const assert = require('node:assert/strict');

const Channels = require('../src/shared/ipcChannels');
const { registerHandlers } = require('../src/main/ipcHandlers');

test('registers the central channel contract and validates save payloads', async () => {
    const handlers = new Map();
    const ipc = { handle(channel, handler) { handlers.set(channel, handler); } };
    const calls = [];
    const files = {
        saveProject(window, data, saveAs) { calls.push({ window, data, saveAs }); return { status: 'ok' }; },
        loadProject() { return { status: 'cancelled' }; },
        exportCsv() { return { status: 'ok' }; },
        exportJson() { return { status: 'ok' }; }
    };
    const window = { isDestroyed: () => false };

    registerHandlers({ ipc, files, resolveWindow: () => window, isTrustedSender: () => true });
    assert.deepEqual(new Set(handlers.keys()), new Set(Object.values(Channels)));

    assert.deepEqual(await handlers.get(Channels.PROJECT_SAVE)({}, null), {
        status: 'error',
        code: 'INVALID_PAYLOAD',
        message: 'Project data is required.'
    });
    await handlers.get(Channels.PROJECT_SAVE)({}, { data: { current: {} }, saveAs: 1 });
    assert.deepEqual(calls, [{ window, data: { current: {} }, saveAs: true }]);
});

test('window handlers operate only on a live resolved window', async () => {
    const handlers = new Map();
    const ipc = { handle(channel, handler) { handlers.set(channel, handler); } };
    const actions = [];
    const window = {
        isDestroyed: () => false,
        isMaximized: () => false,
        isMinimized: () => false,
        minimize: () => actions.push('minimize'),
        maximize: () => actions.push('maximize'),
        close: () => actions.push('close'),
        setAlwaysOnTop: value => actions.push(`top:${value}`),
        show: () => actions.push('show'),
        focus: () => actions.push('focus')
    };
    const files = {
        saveProject() {}, loadProject() {}, exportCsv() {}, exportJson() {}
    };

    registerHandlers({ ipc, files, resolveWindow: () => window, isTrustedSender: () => true });
    await handlers.get(Channels.WINDOW_MINIMIZE)({});
    await handlers.get(Channels.WINDOW_MAXIMIZE)({});
    await handlers.get(Channels.WINDOW_CLOSE)({});
    assert.deepEqual(actions, ['minimize', 'maximize', 'close']);
});

test('rejects calls from an untrusted renderer before invoking an adapter', async () => {
    const handlers = new Map();
    const ipc = { handle(channel, handler) { handlers.set(channel, handler); } };
    let called = false;
    const files = {
        saveProject() { called = true; }, loadProject() {}, exportCsv() {}, exportJson() {}
    };

    registerHandlers({ ipc, files, resolveWindow: () => null, isTrustedSender: () => false });
    const result = await handlers.get(Channels.PROJECT_SAVE)({}, { data: { current: {} } });
    assert.equal(result.code, 'UNTRUSTED_SENDER');
    assert.equal(called, false);
});
