const test = require('node:test');
const assert = require('node:assert/strict');

const Calculator = require('../src/renderer/calculator');

test('calculates level growth and applies active targeted modifiers in order', () => {
    const entity = {
        id: 7,
        stats: {
            hp: { b: 100, g: 10 },
            atk: { b: 20, g: 2 }
        }
    };
    const rules = { stats: ['hp', 'atk'] };
    const items = [
        { active: true, targets: [7], modifiers: [{ stat: 'atk', op: 'add', val: 5 }] },
        { active: true, targets: [7], modifiers: [{ stat: 'atk', op: 'mult', val: 2 }] },
        { active: false, targets: [7], modifiers: [{ stat: 'hp', op: 'add', val: 999 }] },
        { active: true, targets: [8], modifiers: [{ stat: 'hp', op: 'add', val: 999 }] }
    ];

    assert.deepEqual(Calculator.getStatsAtLevel(entity, 3, items, rules), {
        hp: 120,
        atk: 58
    });
});

test('validates both flat and combatant formula scopes', () => {
    assert.equal(Calculator.validateFormula('atk * 2 + hp', ['atk', 'hp']).valid, true);
    assert.equal(Calculator.validateFormula('a.atk - b.hp', ['atk', 'hp']).valid, true);
    assert.equal(Calculator.validateFormula('Math.random()', ['atk']).valid, false);
});
