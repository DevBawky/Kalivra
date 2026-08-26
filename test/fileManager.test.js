const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { FileManager } = require('../src/main/fileManager');

async function makeWorkspace(t) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'kalivra-file-manager-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    return directory;
}

function validProject() {
    return {
        schemaVersion: 1,
        meta: { projectName: 'File Test' },
        snapshots: [],
        itemSets: [],
        current: {
            entities: [{ id: 1, name: 'Unit', stats: { hp: { b: 10, g: 1 } } }],
            items: [],
            gameRules: { stats: ['hp'], dmgFormula: 'a.hp', hitFormula: '100', cpFormula: 'hp' }
        }
    };
}

test('saves atomically, appends the extension, and reuses the current path', async t => {
    const directory = await makeWorkspace(t);
    const requestedPath = path.join(directory, 'project');
    let saveDialogCalls = 0;
    const manager = new FileManager({
        dialog: {
            async showSaveDialog() { saveDialogCalls++; return { canceled: false, filePath: requestedPath }; }
        },
        clock: () => 123,
        processId: 7
    });

    const first = await manager.saveProject({}, validProject());
    assert.equal(first.status, 'ok');
    assert.equal(first.filePath, `${requestedPath}.kal`);
    assert.equal(JSON.parse(await fs.readFile(first.filePath, 'utf8')).schemaVersion, 1);

    const changed = validProject();
    changed.meta.projectName = 'Changed';
    const second = await manager.saveProject({}, changed);
    assert.equal(second.status, 'ok');
    assert.equal(second.reusedPath, true);
    assert.equal(saveDialogCalls, 1);
    assert.equal(JSON.parse(await fs.readFile(first.filePath, 'utf8')).meta.projectName, 'Changed');
});

test('distinguishes cancelled dialogs and invalid project files', async t => {
    const directory = await makeWorkspace(t);
    const invalidPath = path.join(directory, 'invalid.kal');
    await fs.writeFile(invalidPath, '{', 'utf8');

    const cancelled = new FileManager({
        dialog: {
            async showSaveDialog() { return { canceled: true }; }
        }
    });
    assert.deepEqual(await cancelled.saveProject({}, validProject()), { status: 'cancelled' });

    const loader = new FileManager({
        dialog: {
            async showOpenDialog() { return { canceled: false, filePaths: [invalidPath] }; }
        }
    });
    const result = await loader.loadProject({});
    assert.equal(result.status, 'error');
    assert.equal(result.code, 'LOAD_FAILED');
    assert.match(result.details, /Project JSON is invalid/);
    assert.equal(loader.currentFilePath, null);
});
