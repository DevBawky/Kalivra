const test = require('node:test');
const assert = require('node:assert/strict');

const { createMonotonicIdGenerator } = require('../src/application/idGenerator');

test('generates unique monotonic ids even when the clock does not advance', () => {
    const createId = createMonotonicIdGenerator(() => 100);
    assert.deepEqual([createId(), createId(), createId()], [100, 101, 102]);
});
