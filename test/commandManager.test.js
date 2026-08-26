const test = require('node:test');
const assert = require('node:assert/strict');

const { CommandManager } = require('../src/application/commandManager');

function additiveCommand(target, amount) {
    return {
        execute() { target.value += amount; },
        undo() { target.value -= amount; }
    };
}

test('maintains execute, undo, and redo invariants', () => {
    const history = new CommandManager();
    const state = { value: 0 };
    history.execute(additiveCommand(state, 3));
    assert.equal(state.value, 3);
    assert.equal(history.canUndo(), true);
    assert.equal(history.undo(), true);
    assert.equal(state.value, 0);
    assert.equal(history.canRedo(), true);
    assert.equal(history.redo(), true);
    assert.equal(state.value, 3);
});

test('a new command clears redo history and clear resets both stacks', () => {
    const history = new CommandManager();
    const state = { value: 0 };
    history.execute(additiveCommand(state, 1));
    history.undo();
    history.execute(additiveCommand(state, 5));
    assert.equal(history.canRedo(), false);
    history.clear();
    assert.equal(history.canUndo(), false);
    assert.equal(history.canRedo(), false);
});

test('does not corrupt history when undo fails', () => {
    const history = new CommandManager();
    history.execute({ execute() {}, undo() { throw new Error('undo failed'); } });
    assert.throws(() => history.undo(), /undo failed/);
    assert.equal(history.canUndo(), true);
    assert.equal(history.canRedo(), false);
});
