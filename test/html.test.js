const test = require('node:test');
const assert = require('node:assert/strict');

const Html = require('../src/renderer/html');

test('escapes text for element and attribute interpolation', () => {
    assert.equal(Html.escapeHtml('<img src=x onerror="run()">'), '&lt;img src=x onerror=&quot;run()&quot;&gt;');
});

test('accepts only six-digit hex colors and finite numbers', () => {
    assert.equal(Html.safeColor('#Aa00ff'), '#Aa00ff');
    assert.equal(Html.safeColor('red; background:url(x)'), '#888888');
    assert.equal(Html.finiteNumber('12.5'), 12.5);
    assert.equal(Html.finiteNumber(Infinity), 0);
});
