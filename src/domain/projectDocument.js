const CURRENT_SCHEMA_VERSION = 1;

const DEFAULT_GAME_RULES = Object.freeze({
    stats: ['hp', 'atk', 'def', 'acc', 'eva', 'cric', 'crid', 'aspd'],
    defaultValues: {
        hp: { b: 200, g: 20 }, atk: { b: 20, g: 2 }, def: { b: 5, g: 0 },
        acc: { b: 95, g: 0 }, eva: { b: 20, g: 1 }, cric: { b: 15, g: 0 },
        crid: { b: 1.5, g: 0 }, aspd: { b: 1, g: 0 }
    },
    descriptions: {
        hp: 'Health Point', atk: 'Base Damage', def: 'Defense', acc: 'Accuracy',
        eva: 'Evasion', cric: 'Critical Chance', crid: 'Critical Damage', aspd: 'Attack Speed'
    },
    dmgFormula: 'a.atk * (100 / (100 + b.def))',
    hitFormula: 'a.acc - b.eva',
    cpFormula: 'atk * aspd * 10 + hp * 0.5 + def * 1.5 + acc + eva * 2'
});

class ProjectDocumentError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'ProjectDocumentError';
        this.code = code;
    }
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function assertObject(value, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new ProjectDocumentError('INVALID_DOCUMENT', `${path} must be an object.`);
    }
}

function assertArray(value, path) {
    if (!Array.isArray(value)) {
        throw new ProjectDocumentError('INVALID_DOCUMENT', `${path} must be an array.`);
    }
}

function normalizeRules(rules, fallbackRules) {
    const normalized = clone(rules || fallbackRules || DEFAULT_GAME_RULES);
    assertObject(normalized, 'current.gameRules');
    assertArray(normalized.stats, 'current.gameRules.stats');

    const uniqueStats = new Set();
    normalized.stats.forEach((stat, index) => {
        if (typeof stat !== 'string' || stat.trim() === '') {
            throw new ProjectDocumentError('INVALID_DOCUMENT', `current.gameRules.stats[${index}] must be a non-empty string.`);
        }
        if (uniqueStats.has(stat)) {
            throw new ProjectDocumentError('INVALID_DOCUMENT', `Duplicate stat "${stat}".`);
        }
        uniqueStats.add(stat);
    });

    ['dmgFormula', 'cpFormula'].forEach(key => {
        if (typeof normalized[key] !== 'string' || normalized[key].trim() === '') {
            throw new ProjectDocumentError('INVALID_DOCUMENT', `current.gameRules.${key} must be a non-empty string.`);
        }
    });
    if (normalized.hitFormula === undefined) normalized.hitFormula = '(a.acc - b.eva)';
    if (typeof normalized.hitFormula !== 'string' || normalized.hitFormula.trim() === '') {
        throw new ProjectDocumentError('INVALID_DOCUMENT', 'current.gameRules.hitFormula must be a non-empty string.');
    }
    return normalized;
}

function normalizeEntities(entities) {
    assertArray(entities, 'current.entities');
    const ids = new Set();
    return clone(entities).map((entity, index) => {
        assertObject(entity, `current.entities[${index}]`);
        if (entity.id === undefined || entity.id === null || entity.id === '') {
            throw new ProjectDocumentError('INVALID_DOCUMENT', `current.entities[${index}].id is required.`);
        }
        if (ids.has(entity.id)) {
            throw new ProjectDocumentError('INVALID_DOCUMENT', `Duplicate entity id "${entity.id}".`);
        }
        ids.add(entity.id);
        assertObject(entity.stats, `current.entities[${index}].stats`);
        return entity;
    });
}

function normalizeItems(items) {
    assertArray(items, 'current.items');
    const ids = new Set();
    return clone(items).map((item, index) => {
        assertObject(item, `current.items[${index}]`);
        if (item.id === undefined || item.id === null || item.id === '') {
            throw new ProjectDocumentError('INVALID_DOCUMENT', `current.items[${index}].id is required.`);
        }
        if (ids.has(item.id)) {
            throw new ProjectDocumentError('INVALID_DOCUMENT', `Duplicate item id "${item.id}".`);
        }
        ids.add(item.id);
        item.targets = item.targets === undefined ? [] : item.targets;
        item.modifiers = item.modifiers === undefined ? [] : item.modifiers;
        item.traits = item.traits === undefined ? [] : item.traits;
        assertArray(item.targets, `current.items[${index}].targets`);
        assertArray(item.modifiers, `current.items[${index}].modifiers`);
        assertArray(item.traits, `current.items[${index}].traits`);
        return item;
    });
}

function toCurrentShape(input, fallback) {
    if (input.current) return input;
    if (!Array.isArray(input.entities) || !Array.isArray(input.items)) {
        throw new ProjectDocumentError('INVALID_DOCUMENT', 'Project must contain current data or legacy entities/items.');
    }

    const fallbackCurrent = fallback && fallback.current ? fallback.current : {};
    return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        meta: clone((fallback && fallback.meta) || {}),
        snapshots: [],
        itemSets: [],
        current: {
            entities: input.entities,
            items: input.items,
            gameRules: input.gameRules || fallbackCurrent.gameRules
        }
    };
}

function normalizeProjectDocument(document, fallback = null) {
    assertObject(document, 'project');
    if (fallback) assertObject(fallback, 'fallback project');

    const source = toCurrentShape(clone(document), fallback);
    const schemaVersion = source.schemaVersion === undefined ? CURRENT_SCHEMA_VERSION : source.schemaVersion;
    if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
        throw new ProjectDocumentError('INVALID_SCHEMA_VERSION', 'schemaVersion must be a positive integer.');
    }
    if (schemaVersion > CURRENT_SCHEMA_VERSION) {
        throw new ProjectDocumentError('UNSUPPORTED_SCHEMA_VERSION', `Project schema ${schemaVersion} is newer than supported schema ${CURRENT_SCHEMA_VERSION}.`);
    }

    assertObject(source.current, 'current');
    const fallbackCurrent = fallback && fallback.current ? fallback.current : {};
    const normalized = {
        ...source,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        meta: clone(source.meta || {}),
        snapshots: clone(source.snapshots || []),
        itemSets: clone(source.itemSets || []),
        current: {
            ...source.current,
            entities: normalizeEntities(source.current.entities),
            items: normalizeItems(source.current.items),
            gameRules: normalizeRules(source.current.gameRules, fallbackCurrent.gameRules)
        }
    };
    assertArray(normalized.snapshots, 'snapshots');
    assertArray(normalized.itemSets, 'itemSets');
    return normalized;
}

function parseProjectDocument(serialized, fallback = null) {
    if (typeof serialized !== 'string') {
        throw new ProjectDocumentError('INVALID_JSON', 'Serialized project must be a string.');
    }
    let parsed;
    try {
        parsed = JSON.parse(serialized);
    } catch (error) {
        throw new ProjectDocumentError('INVALID_JSON', `Project JSON is invalid: ${error.message}`);
    }
    return normalizeProjectDocument(parsed, fallback);
}

function serializeProjectDocument(document) {
    return JSON.stringify(normalizeProjectDocument(document), null, 2);
}

module.exports = {
    CURRENT_SCHEMA_VERSION,
    DEFAULT_GAME_RULES,
    ProjectDocumentError,
    normalizeProjectDocument,
    parseProjectDocument,
    serializeProjectDocument
};
