const test = require('node:test');
const assert = require('node:assert/strict');

const { buildBalanceCsv, buildShareExport, escapeCsv } = require('../src/application/exportData');

test('CSV export escapes user data and evaluates each level through injected ports', () => {
    const csv = buildBalanceCsv({
        entities: [{ name: 'Unit, "A"', base: 10 }],
        items: [],
        rules: { stats: ['atk'], cpFormula: 'atk', dmgFormula: 'a.atk' },
        maxLevel: 2,
        metric: 'cp',
        getStatsAtLevel: (entity, level) => ({ atk: entity.base + level }),
        calculateValue: (_formula, scope) => scope.atk
    });

    assert.match(csv, /"Unit, ""A"""/);
    assert.match(csv, /1,11\.00/);
    assert.match(csv, /2,12\.00/);
    assert.equal(escapeCsv('plain'), 'plain');
});

test('shared export is cloned and has an injected timestamp', () => {
    const entities = [{ id: 1 }];
    const exported = buildShareExport({
        meta: {}, rules: {}, entities, items: [],
        now: () => new Date('2026-08-26T00:00:00.000Z')
    });

    entities[0].id = 2;
    assert.equal(exported.entities[0].id, 1);
    assert.equal(exported.exportedAt, '2026-08-26T00:00:00.000Z');
});
