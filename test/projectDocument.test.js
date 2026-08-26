const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ProjectDocument = require('../src/domain/projectDocument');

function fixture(name) {
    return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
}

test('round-trips the current project schema', () => {
    const parsed = ProjectDocument.parseProjectDocument(fixture('current-project.json'));
    const roundTripped = ProjectDocument.parseProjectDocument(ProjectDocument.serializeProjectDocument(parsed));
    assert.deepEqual(roundTripped, parsed);
    assert.equal(parsed.schemaVersion, ProjectDocument.CURRENT_SCHEMA_VERSION);
});

test('migrates the legacy top-level entities/items shape', () => {
    const migrated = ProjectDocument.parseProjectDocument(fixture('legacy-project.json'));
    assert.equal(migrated.schemaVersion, 1);
    assert.equal(migrated.current.entities[0].name, 'Legacy Unit');
    assert.deepEqual(migrated.snapshots, []);
    assert.deepEqual(migrated.itemSets, []);
});

test('supplies stable defaults when a legacy project has no rules', () => {
    const migrated = ProjectDocument.normalizeProjectDocument({
        entities: [{ id: 1, name: 'Legacy', stats: {} }],
        items: []
    });

    assert.deepEqual(migrated.current.gameRules.stats, ProjectDocument.DEFAULT_GAME_RULES.stats);
    assert.equal(migrated.current.gameRules.dmgFormula, ProjectDocument.DEFAULT_GAME_RULES.dmgFormula);
});

test('rejects future schemas and duplicate ids without mutating input', () => {
    const current = JSON.parse(fixture('current-project.json'));
    const future = { ...current, schemaVersion: 2 };
    assert.throws(() => ProjectDocument.normalizeProjectDocument(future), error => {
        assert.equal(error.code, 'UNSUPPORTED_SCHEMA_VERSION');
        return true;
    });

    current.current.entities.push({ ...current.current.entities[0] });
    const before = JSON.stringify(current);
    assert.throws(() => ProjectDocument.normalizeProjectDocument(current), /Duplicate entity id/);
    assert.equal(JSON.stringify(current), before);
});

test('distinguishes malformed JSON from an invalid document', () => {
    assert.throws(() => ProjectDocument.parseProjectDocument('{'), error => {
        assert.equal(error.code, 'INVALID_JSON');
        return true;
    });
    assert.throws(() => ProjectDocument.normalizeProjectDocument({}), error => {
        assert.equal(error.code, 'INVALID_DOCUMENT');
        return true;
    });
});
