const { calculateValue } = require('./calculator');

function runBattleBatch(entA, statsA, entB, statsB, count, dmgFormula) {
    let wins = 0;
    let totalTTK = 0;
    
    const getBaseDmg = (atkStats, defStats) => {
        const context = { ...atkStats, def: defStats.def || 0 };
        return calculateValue(dmgFormula, context);
    };
    
    const baseDmgA = getBaseDmg(statsA, statsB);
    const baseDmgB = getBaseDmg(statsB, statsA);
    const intervalA = 1 / (statsA.aspd || 1);
    const intervalB = 1 / (statsB.aspd || 1);
    const evaA = statsA.eva || 0;
    const evaB = statsB.eva || 0;

    for (let i = 0; i < count; i++) {
        let hpA = statsA.hp, hpB = statsB.hp;
        let time = 0, cdA = 0, cdB = 0;
        const tick = 0.1;

        while (time < 120) {
            time += tick;
            if (time >= cdA) {
                if (Math.random() * 100 >= evaB) {
                    const mult = 1 + (Math.random() * (entA.variance || 0) * 2 - (entA.variance || 0));
                    hpB -= baseDmgA * mult;
                }
                if (hpB <= 0) { wins++; totalTTK += time; break; }
                cdA += intervalA;
            }
            if (time >= cdB) {
                if (Math.random() * 100 >= evaA) {
                    const mult = 1 + (Math.random() * (entB.variance || 0) * 2 - (entB.variance || 0));
                    hpA -= baseDmgB * mult;
                }
                if (hpA <= 0) break;
                cdB += intervalB;
            }
        }
    }
    return { opponentName: entB.name, winRate: (wins/count)*100, avgTTK: wins>0 ? (totalTTK/wins) : 0 };
}
module.exports = { runBattleBatch };