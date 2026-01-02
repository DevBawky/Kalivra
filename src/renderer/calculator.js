// 1. 수식 계산기
function calculateValue(formula, statsSnapshot) {
    try {
        const keys = Object.keys(statsSnapshot);
        const values = Object.values(statsSnapshot);
        return new Function(...keys, `return ${formula};`)(...values);
    } catch (e) { return 0; }
}

// 2. 수식 유효성 검증기
function validateFormula(formula, statNames) {
    const dummyStats = {};
    statNames.forEach(s => dummyStats[s] = 1);
    try {
        const keys = Object.keys(dummyStats);
        const values = Object.values(dummyStats);
        new Function(...keys, `return ${formula};`)(...values);
        return { valid: true };
    } catch (e) {
        return { valid: false, error: e.message };
    }
}

// 3. 레벨별 스탯 계산기
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

// 4. [중요] Crossover 감지기 클래스
class CrossoverDetector {
    constructor() {
        this.prevDiff = null;
    }

    update(valA, valB) {
        const currDiff = valA - valB;
        let result = null;

        if (this.prevDiff !== null) {
            // 부호가 바뀌거나, 0이 되었다면 교차
            if (this.prevDiff * currDiff <= 0 && this.prevDiff !== currDiff) {
                if (currDiff > 0) result = "GOLDEN_CROSS";
                else if (currDiff < 0) result = "DEAD_CROSS";
                else result = "TOUCH";
            }
        }
        this.prevDiff = currDiff;
        return result;
    }
}

// 5. 분석 함수
function analyzeCrossovers(rawData, maxLv) {
    const names = Object.keys(rawData);
    if (names.length < 2) return [];

    let logs = [];

    for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
            const charA = names[i];
            const charB = names[j];
            const dataA = rawData[charA].data;
            const dataB = rawData[charB].data;

            const detector = new CrossoverDetector();
            detector.prevDiff = dataA[0] - dataB[0];

            for (let lv = 1; lv < maxLv; lv++) {
                const status = detector.update(dataA[lv], dataB[lv]);
                if (status) {
                    let winner = status === "GOLDEN_CROSS" ? charA : charB;
                    let loser = winner === charA ? charB : charA;
                    const wObj = rawData[winner];
                    const lObj = rawData[loser];

                    logs.push({
                        lv: lv + 1,
                        type: status,
                        winnerName: wObj.name,
                        loserName: lObj.name,
                        wColor: wObj.color,
                        lColor: lObj.color
                    });
                }
            }
        }
    }
    return logs;
}

module.exports = { calculateValue, validateFormula, getStatsAtLevel, analyzeCrossovers };