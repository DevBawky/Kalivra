const test = require('node:test');
const assert = require('node:assert/strict');

const Battle = require('../src/renderer/battle');

const entityA = { id: 1, name: 'A', variance: 0, traits: [] };
const entityB = { id: 2, name: 'B', variance: 0, traits: [] };
const statsA = { hp: 100, atk: 20, def: 0, acc: 100, eva: 0, cric: 0, crid: 1.5, aspd: 2 };
const statsB = { hp: 100, atk: 10, def: 0, acc: 100, eva: 0, cric: 0, crid: 1.5, aspd: 1 };
const rules = { dmgFormula: 'a.atk', hitFormula: '100' };

test('supports deterministic battle simulation through an injected random source', () => {
    const result = Battle.simulateBattle(entityA, statsA, entityB, statsB, rules, true, {
        random: () => 0
    });

    assert.equal(result.winnerId, entityA.id);
    assert.equal(result.turns, 5);
    assert.equal(result.winnerHp, 60);
    assert.equal(result.statsA.attacks, 5);
    assert.equal(result.statsA.damageDealt, 100);
    assert.equal(result.logs.at(-1).action, 'die');
});

test('threads the same deterministic runtime through batch simulations', () => {
    const result = Battle.runBattleBatch(entityA, statsA, entityB, statsB, 3, rules, {
        random: () => 0
    });

    assert.equal(result.winRate, 100);
    assert.equal(result.avgTurns, 5);
    assert.equal(result.allLogs.length, 3);
});
