const test = require('node:test');
const assert = require('node:assert/strict');

const Formula = require('../src/domain/formulaEvaluator');

test('evaluates arithmetic, dotted identifiers, and ternary expressions', () => {
    assert.equal(Formula.evaluateFormula('a.atk * (100 / (100 + b.def))', {
        a: { atk: 50 },
        b: { def: 25 }
    }), 40);
    assert.equal(Formula.evaluateFormula('(atk - def) > 1 ? (atk - def) : 1', {
        atk: 10,
        def: 12
    }), 1);
});

test('rejects executable syntax and unsafe property traversal', () => {
    assert.throws(() => Formula.evaluateFormula('process.exit()', {}), error => {
        assert.equal(error.code, 'INVALID_SYNTAX');
        return true;
    });
    assert.throws(() => Formula.evaluateFormula('a.constructor', { a: {} }), error => {
        assert.equal(error.code, 'FORBIDDEN_IDENTIFIER');
        return true;
    });
});

test('reports unknown identifiers and non-finite results', () => {
    assert.throws(() => Formula.evaluateFormula('missing + 1', {}), error => {
        assert.equal(error.code, 'UNKNOWN_IDENTIFIER');
        return true;
    });
    assert.throws(() => Formula.evaluateFormula('1 / 0', {}), error => {
        assert.equal(error.code, 'NON_FINITE_RESULT');
        return true;
    });
});
