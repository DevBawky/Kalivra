const test = require('node:test');
const assert = require('node:assert/strict');

const {
    AppendToCollectionCommand,
    BulkStatChangeCommand,
    RemoveFromCollectionCommand,
    ReplaceAtIndexCommand,
    ReplaceValueCommand,
    SetPropertyCommand
} = require('../src/application/editCommands');

test('property and collection commands round-trip state through undo', () => {
    const target = { name: 'before' };
    const values = [{ id: 1 }];
    let changes = 0;
    const changed = () => { changes += 1; };

    const set = new SetPropertyCommand(target, 'name', 'before', 'after', changed);
    set.execute();
    assert.equal(target.name, 'after');
    set.undo();
    assert.equal(target.name, 'before');

    const append = new AppendToCollectionCommand(values, { id: 2 }, changed);
    append.execute();
    append.undo();
    assert.deepEqual(values, [{ id: 1 }]);

    const remove = new RemoveFromCollectionCommand(values, 0, changed);
    remove.execute();
    remove.undo();
    assert.deepEqual(values, [{ id: 1 }]);
    assert.equal(changes, 6);
});

test('replace and bulk commands restore complete previous state', () => {
    let current = [{ id: 1 }];
    const replace = new ReplaceValueCommand({ read: () => current, write: value => { current = value; } }, [{ id: 2 }]);
    replace.execute();
    assert.deepEqual(current, [{ id: 2 }]);
    replace.undo();
    assert.deepEqual(current, [{ id: 1 }]);

    const entities = [{ id: 1, stats: { atk: { b: 10, g: 0 } } }, { id: 2, stats: {} }];
    const bulk = new BulkStatChangeCommand(entities, [1, 2], 'atk', 'add', 2.25);
    bulk.execute();
    assert.deepEqual(entities.map(entity => entity.stats.atk.b), [12.25, 2.25]);
    bulk.undo();
    assert.equal(entities[0].stats.atk.b, 10);
    assert.equal(entities[1].stats.atk, undefined);
});

test('indexed replacement isolates snapshots from later mutation', () => {
    const values = [{ nested: { value: 1 } }];
    const replacement = { nested: { value: 2 } };
    const command = new ReplaceAtIndexCommand(values, 0, values[0], replacement);

    command.execute();
    replacement.nested.value = 99;
    assert.equal(values[0].nested.value, 2);
    command.undo();
    assert.equal(values[0].nested.value, 1);
});
