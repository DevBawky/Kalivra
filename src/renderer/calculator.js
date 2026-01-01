// calculator.js 내 analyzeCrossovers 함수 교체

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

// [수정된 핵심 로직] 상태 기반 교차 감지 (중복 제거)
function analyzeCrossovers(rawData, maxLv) {
    const ids = Object.keys(rawData);
    if (ids.length < 2) return [];

    let logs = [];

    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            const idA = ids[i];
            const idB = ids[j];
            const objA = rawData[idA]; 
            const objB = rawData[idB];
            
            const dataA = objA.data;
            const dataB = objB.data;

            // 초기 승자 판별 (0: 동점, 1: A승, -1: B승)
            // 첫 레벨(Lv.1, index 0) 상태 확인
            let currentWinnerSign = Math.sign(dataA[0] - dataB[0]);

            for (let lv = 1; lv < maxLv; lv++) {
                const diff = dataA[lv] - dataB[lv];
                const newSign = Math.sign(diff);

                // 1. 현재 동점(0)이면 승자가 바뀐게 아니므로 무시 (상태 유지)
                // 2. 승자(부호)가 확실히 바뀌었을 때만 로그 기록
                if (newSign !== 0 && newSign !== currentWinnerSign) {
                    
                    // 초기 상태가 동점이었다면 교차가 아니라 그냥 갈라지는 것임 -> 로그 스킵 여부 결정
                    // 하지만 보통은 기록하는게 좋으므로 기록. 단, currentWinnerSign이 0이 아닐때만 '역전'이라 부름.
                    
                    if (currentWinnerSign !== 0) {
                        let winnerName = newSign > 0 ? objA.name : objB.name;
                        let loserName = newSign > 0 ? objB.name : objA.name;
                        let wColor = newSign > 0 ? objA.color : objB.color;
                        let lColor = newSign > 0 ? objB.color : objA.color;

                        logs.push({
                            lv: lv + 1,
                            winnerName: winnerName,
                            loserName: loserName,
                            wColor: wColor,
                            lColor: lColor
                        });
                    }
                    // 승자 상태 갱신
                    currentWinnerSign = newSign;
                }
                // 만약 newSign이 0(동점)이면 currentWinnerSign을 바꾸지 않고 유지함
                // -> 그래야 다음 레벨에서 다시 벌어졌을 때 역전인지 유지인지 판단 가능
            }
        }
    }
    return logs;
}

module.exports = { calculateValue, getStatsAtLevel, analyzeCrossovers };