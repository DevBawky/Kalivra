function escapeCsv(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildBalanceCsv({ entities, items, rules, maxLevel, metric, getStatsAtLevel, calculateValue }) {
    if (!['cp', 'dmg'].includes(metric)) throw new TypeError(`Unsupported metric: ${metric}`);
    if (!Number.isInteger(maxLevel) || maxLevel < 1) throw new TypeError('maxLevel must be a positive integer.');

    const formula = metric === 'cp' ? rules.cpFormula : rules.dmgFormula;
    const dummyTarget = Object.fromEntries((rules.stats || []).map(stat => [stat, 0]));
    const rows = [
        ['Level', `Metric (${metric.toUpperCase()})`, `Formula: ${formula}`],
        ['Level', ...entities.map(entity => entity.name)]
    ];

    for (let level = 1; level <= maxLevel; level += 1) {
        const row = [level];
        entities.forEach(entity => {
            const stats = getStatsAtLevel(entity, level, items, rules);
            const scope = metric === 'cp' ? stats : { a: stats, b: dummyTarget };
            const value = calculateValue(formula, scope);
            if (!Number.isFinite(value)) throw new TypeError(`Non-finite export value for ${entity.name} at level ${level}.`);
            row.push(value.toFixed(2));
        });
        rows.push(row);
    }

    return `${rows.map(row => row.map(escapeCsv).join(',')).join('\n')}\n`;
}

function buildShareExport({ meta, rules, entities, items, now = () => new Date() }) {
    return JSON.parse(JSON.stringify({
        meta,
        rules,
        entities,
        items,
        exportedAt: now().toISOString(),
        note: 'This is a shared balance configuration.'
    }));
}

module.exports = { buildBalanceCsv, buildShareExport, escapeCsv };
