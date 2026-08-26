const test = require('node:test');
const assert = require('node:assert/strict');

const DM = require('../src/renderer/dataManager');

test('snapshot and item-set timestamps can be injected deterministically', () => {
    const snapshotIndex = DM.getSnapshots().length;
    const setIndex = DM.getItemSets().length;

    DM.createSnapshot('Deterministic', { clock: () => 1234 });
    DM.addItemSet('Deterministic', { clock: () => 5678 });

    const snapshot = DM.getSnapshots()[snapshotIndex];
    const itemSet = DM.getItemSets()[setIndex];
    assert.equal(snapshot.id, 1234);
    assert.equal(snapshot.date, '1970-01-01T00:00:01.234Z');
    assert.ok(snapshot.data.gameRules);
    assert.equal(itemSet.id, 5678);

    DM.deleteSnapshot(snapshotIndex);
    DM.deleteItemSet(setIndex);
});
