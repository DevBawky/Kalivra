const Sim = require('./calculator');

function simulateBattle(entA, statsA, entB, statsB, dmgFormula, recordLog = false) {
    const fighterA = { ...entA, currentStats: { ...statsA }, currentHp: statsA.hp || 100, traits: entA.traits || [] };
    const fighterB = { ...entB, currentStats: { ...statsB }, currentHp: statsB.hp || 100, traits: entB.traits || [] };

    fighterA.currentHp = fighterA.currentStats.hp = fighterA.currentStats.hp || 100;
    fighterB.currentHp = fighterB.currentStats.hp = fighterB.currentStats.hp || 100;

    const logs = [];
    let turn = 0;
    const MAX_TURNS = 200;
    let winner = null;

    const addLog = (turn, actor, target, action, val, msg) => {
        if (!recordLog) return;
        logs.push({ turn, actor: actor ? actor.name : 'System', target: target ? target.name : null, action, val, msg });
    };

    // --- [Core] Trigger Engine ---
    const BattleSystem = {
        processTriggers: (triggerName, context) => {
            const actor = context.actor;
            if (!actor.traits) return;

            actor.traits.forEach(trait => {
                if (!trait.triggers) return;
                const relevantTriggers = trait.triggers.filter(t => t.type === triggerName);

                relevantTriggers.forEach(trig => {
                    if (BattleSystem.checkConditions(trig.conditions, context)) {
                        BattleSystem.applyEffects(trig.effects, context, trait.name);
                    }
                });
            });
        },

        checkConditions: (conditions, context) => {
            if (!conditions || conditions.length === 0) return true;
            return conditions.every(cond => {
                switch (cond.type) {
                    case "Chance":
                        return Math.random() * 100 < cond.value;
                    case "HpLessThen": // 체력 % 이하일 때
                        const target = cond.target === "Self" ? context.actor : context.target;
                        return (target.currentHp / target.currentStats.hp) * 100 <= cond.value;
                    default:
                        return true;
                }
            });
        },

        applyEffects: (effects, context, sourceName) => {
            effects.forEach(eff => {
                switch (eff.type) {
                    case "Heal": // 체력 회복 (흡혈 등)
                        const healTarget = eff.target === "Self" ? context.actor : context.target;
                        let healAmount = 0;
                        if (eff.valueType === "PercentOfDamage") healAmount = context.damage * (eff.value / 100);
                        else if (eff.valueType === "Fixed") healAmount = eff.value;
                        
                        healAmount = Math.floor(healAmount);
                        if (healAmount > 0) {
                            healTarget.currentHp = Math.min(healTarget.currentHp + healAmount, healTarget.currentStats.hp);
                            addLog(turn, context.actor, healTarget, 'heal', healAmount, `[${sourceName}] Healed ${healAmount} HP`);
                        }
                        break;

                    case "ModifyDamage": // 데미지 증폭/감소
                        if (eff.op === "multiply") context.damageMultiplier *= eff.value;
                        else if (eff.op === "add") context.damageBonus += eff.value;
                        addLog(turn, context.actor, null, 'buff', 0, `[${sourceName}] Dmg Modified`);
                        break;
                }
            });
        }
    };

    const processAttack = (attacker, defender) => {
        const aStats = attacker.currentStats;
        const bStats = defender.currentStats;

        // 1. 회피 체크
        const evaChance = bStats.eva || 0;
        if (Math.random() * 100 < evaChance) {
            addLog(turn, attacker, defender, 'miss', 0, 'Missed! (Dodged)');
            return;
        }

        // 2. 데미지 계산 컨텍스트 생성
        let context = {
            actor: attacker,
            target: defender,
            damage: 0,
            damageMultiplier: 1.0,
            damageBonus: 0
        };

        // [Hook] 공격 전 (OnBeforeAttack) - 예: 체력 낮으면 데미지 증가
        BattleSystem.processTriggers("OnBeforeAttack", context);

        let rawDmg = 0;
        try {
            rawDmg = Sim.calculateValue(dmgFormula, { a: aStats, b: bStats });
        } catch (e) {
            addLog(turn, attacker, defender, 'error', 0, `Formula Error: ${e.message}`);
            rawDmg = 0;
        }

        const variance = attacker.variance || 0;
        if (variance > 0) {
            const mult = 1 + (Math.random() * variance * 2 - variance);
            rawDmg *= mult;
        }

        const criChance = aStats.cric !== undefined ? aStats.cric : (aStats.cri || 0);
        let isCritical = false;
        if (Math.random() * 100 < criChance) {
            isCritical = true;
            rawDmg *= (aStats.crid || 1.5);
        }

        // 3. 트리거에 의한 데미지 보정 적용
        rawDmg = (rawDmg * context.damageMultiplier) + context.damageBonus;

        let finalDmg = Math.floor(rawDmg);
        if (finalDmg < 0) finalDmg = 0;

        // 실제 데미지 적용
        defender.currentHp -= finalDmg;
        context.damage = finalDmg; // 최종 데미지 업데이트

        let msg = `deals ${finalDmg} damage`;
        if (isCritical) msg += " (Critical!)";
        addLog(turn, attacker, defender, 'attack', finalDmg, msg);

        // [Hook] 공격 적중 후 (OnAttackHit) - 예: 흡혈
        BattleSystem.processTriggers("OnAttackHit", context);
    };

    while (turn < MAX_TURNS && fighterA.currentHp > 0 && fighterB.currentHp > 0) {
        turn++;
        const aspdA = fighterA.currentStats.aspd || 1;
        const aspdB = fighterB.currentStats.aspd || 1;
        const totalSpeed = aspdA + aspdB;
        const chanceA = totalSpeed > 0 ? (aspdA / totalSpeed) : 0.5;

        let first, second;
        if (Math.random() < chanceA) { first = fighterA; second = fighterB; } 
        else { first = fighterB; second = fighterA; }

        processAttack(first, second);
        if (second.currentHp <= 0) {
            winner = first;
            addLog(turn, second, null, 'die', 0, 'collapsed!');
            break;
        }

        processAttack(second, first);
        if (first.currentHp <= 0) {
            winner = second;
            addLog(turn, first, null, 'die', 0, 'collapsed!');
            break;
        }
    }

    if (!winner) addLog(turn, null, null, 'end', 0, 'Draw (Max Turns)');

    return {
        winnerName: winner ? winner.name : 'Draw',
        winnerId: winner ? winner.id : null,
        turns: turn,
        logs: logs
    };
}

function runBattleBatch(entA, statsA, entB, statsB, count, dmgFormula) {
    let winsA = 0;
    let totalTurns = 0;
    let allLogs = [];
    const LOG_LIMIT = 100;

    for (let i = 0; i < count; i++) {
        const shouldRecord = (i < LOG_LIMIT);
        const result = simulateBattle(entA, statsA, entB, statsB, dmgFormula, shouldRecord);
        if (shouldRecord) allLogs.push(result.logs);
        if (result.winnerId === entA.id) winsA++;
        totalTurns += result.turns;
    }

    return {
        opponentName: entB.name,
        winRate: (winsA / count) * 100,
        avgTurns: totalTurns / count,
        allLogs: allLogs
    };
}

module.exports = { simulateBattle, runBattleBatch };