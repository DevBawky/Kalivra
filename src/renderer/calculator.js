function calculateValue(formula, statsSnapshot) {
    try {
        const keys = Object.keys(statsSnapshot);
        const values = Object.values(statsSnapshot);
        return new Function(...keys, `return ${formula};`)(...values);
    } catch (e) { return 0; }
}

function getStatsAtLevel(ent, lv, items, rules) {
    let currentStats = {};
    rules.stats.forEach(statName => {
        const s = ent.stats[statName] || {b:0, g:0};
        currentStats[statName] = s.b + (lv - 1) * s.g;
    });

    items.forEach(item => {
        if (item.active && item.targets.includes(ent.id)) {
            item.modifiers.forEach(mod => {
                if (currentStats[mod.stat] !== undefined) {
                    if (mod.op === 'add') currentStats[mod.stat] += mod.val;
                    if (mod.op === 'mult') currentStats[mod.stat] *= mod.val;
                }
            });
        }
    });
    return currentStats;
}

function analyzeCrossovers(rawData, maxLv) {
    const names = Object.keys(rawData);
    if (names.length < 2) return [];

    let logs = [];
    for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
            const charA = names[i];
            const charB = names[j];
            const dA = rawData[charA];
            const dB = rawData[charB];
            
            let currentWinner = dA.data[0] > dB.data[0] ? charA : (dB.data[0] > dA.data[0] ? charB : 'tie');

            for (let k = 1; k < maxLv; k++) {
                let newWinner = dA.data[k] > dB.data[k] ? charA : (dB.data[k] > dA.data[k] ? charB : 'tie');
                if (newWinner !== 'tie' && currentWinner !== 'tie' && newWinner !== currentWinner) {
                    const winnerColor = newWinner === charA ? dA.color : dB.color;
                    const loserColor = newWinner === charA ? dB.color : dA.color;
                    const loserName = newWinner === charA ? charB : charA;
                    logs.push({ lv: k+1, winner: newWinner, loser: loserName, wColor: winnerColor, lColor: loserColor });
                    currentWinner = newWinner;
                } else if (currentWinner === 'tie' && newWinner !== 'tie') currentWinner = newWinner;
            }
        }
    }
    return logs;
}

module.exports = { calculateValue, getStatsAtLevel, analyzeCrossovers };