const Sim = require('./calculator');

const Solver = {
    findGrowthValue: (entity, items, rules, targetLv, targetValue, statName, metric) => {
        const clone = JSON.parse(JSON.stringify(entity));
        const dummyTarget = {};
        rules.stats.forEach(s => dummyTarget[s] = 0);
        const formula = metric === 'cp' ? rules.cpFormula : rules.dmgFormula;

        const calcAtGrowth = (gVal) => {
            clone.stats[statName].g = gVal;
            const stats = Sim.getStatsAtLevel(clone, targetLv, items, rules);
            try {
                if (metric === 'cp') return Sim.calculateValue(formula, stats);
                return Sim.calculateValue(formula, { a: stats, b: dummyTarget });
            } catch (e) {
                return NaN;
            }
        };

        let low = 0;
        let high = 0;
        
        const valAtZero = calcAtGrowth(0);
        
        if (isNaN(valAtZero)) return null;

        if (valAtZero < targetValue) {
            low = 0;
            high = 10;
            let safety = 0;
            while (calcAtGrowth(high) < targetValue) {
                low = high;
                high *= 2;
                if (++safety > 100) return null;
            }
        } else {
            high = 0;
            low = -10;
            let safety = 0;
            while (calcAtGrowth(low) > targetValue) {
                high = low;
                low *= 2;
                if (++safety > 100) return null;
            }
        }

        let bestGrowth = low;
        let minDiff = Number.MAX_VALUE;

        for (let i = 0; i < 100; i++) {
            const mid = (low + high) / 2;
            const val = calcAtGrowth(mid);
            if (isNaN(val)) return null;

            const diff = Math.abs(val - targetValue);
            if (diff < minDiff) {
                minDiff = diff;
                bestGrowth = mid;
            }
            if (diff < 0.001) break;

            if (val < targetValue) {
                low = mid;
            } else {
                high = mid;
            }
        }

        if (Number.isInteger(bestGrowth)) return bestGrowth;
        return parseFloat(bestGrowth.toFixed(3));
    }
};

module.exports = Solver;