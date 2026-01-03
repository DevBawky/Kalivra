const Sim = require('./calculator');

// ==========================================
// [Helper] 버프 지속시간 관리
// ==========================================
function processBuffDurations(actor, turn, addLogFunc) {
    if (!actor.activeBuffs || actor.activeBuffs.length === 0) return;

    for (let i = actor.activeBuffs.length - 1; i >= 0; i--) {
        const buff = actor.activeBuffs[i];
        buff.duration--;
        if (buff.duration <= 0) {
            if (actor.currentStats[buff.stat]) actor.currentStats[buff.stat] -= buff.val;
            if (addLogFunc) addLogFunc(turn, actor, null, 'buff', 0, `[${buff.source}] Buff Expired (-${buff.val} ${buff.stat.toUpperCase()})`);
            actor.activeBuffs.splice(i, 1);
        }
    }
}

/**
 * 단일 전투 시뮬레이션 (Chance Condition Fix)
 */
function simulateBattle(entA, statsA, entB, statsB, dmgFormula, recordLog = false) {
    const initFighter = (ent, stats) => ({
        ...ent, currentStats: { ...stats }, currentHp: stats.hp || 100, traits: ent.traits || [], activeBuffs: [],
        tracker: { attacks: 0, crits: 0, hits: 0, misses: 0, damageDealt: 0, overkill: 0 }
    });

    // [수정 완료] rules -> dmgFormula로 변경 (이 부분이 원인이었습니다)
    const gameRules = (typeof dmgFormula === 'string') 
        ? { dmgFormula: dmgFormula, hitFormula: "(a.acc - b.eva)" } 
        : dmgFormula;

    const fighterA = initFighter(entA, statsA);
    const fighterB = initFighter(entB, statsB);

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

    // ==========================================
    // [Core] Trigger Engine
    // ==========================================
    const BattleSystem = {
        normalizeString: (str) => {
            if (!str) return "";
            const s = str.toLowerCase().replace(/\s+/g, ""); 
            
            // Trigger Mappings
            if (s.includes("onhittaken") || s.includes("ondamagetaken") || s.includes("피격")) return "OnHitTaken";
            if (s.includes("onattackhit") || s.includes("적중")) return "OnAttackHit";
            if (s.includes("onbeforeattack") || s.includes("공격전")) return "OnBeforeAttack";
            if (s.includes("onmiss") || s.includes("빗나감")) return "OnMiss";
            if (s.includes("onevasion") || s.includes("회피")) return "OnEvasion";
            if (s.includes("oncritical") || s.includes("치명타")) return "OnCritical";
            if (s.includes("onturnstart")) return "OnTurnStart";
            if (s.includes("onturnend")) return "OnTurnEnd";
            if (s.includes("onbattlestart")) return "OnBattleStart";
            
            // Effect & Value Type Mappings
            if (s.includes("heal")) return "Heal";
            if (s.includes("modifydamage")) return "ModifyDamage";
            if (s.includes("dealdamage")) return "DealDamage";
            if (s.includes("buff")) return "BuffStat";
            if (s.includes("percent") || s.includes("%")) return "PercentOfDamage";

            // Condition Type Mappings
            if (s.includes("chance")) return "chance";
            if (s.includes("hp") && s.includes("less")) return "hplessthen";
            if (s.includes("always")) return "always";
            
            return str;
        },

        processTriggers: (triggerName, owner, context, allowedTypes = null) => {
            if (!owner.traits || owner.traits.length === 0) return;

            owner.traits.forEach(trait => {
                if (!trait.triggers) return;
                trait.triggers.filter(t => BattleSystem.normalizeString(t.type) === triggerName).forEach(trig => {
                    if (BattleSystem.checkConditions(trig.conditions, owner, context)) {
                        BattleSystem.applyEffects(trig.effects, owner, context, trait.name, allowedTypes);
                    }
                });
            });
        },

        checkConditions: (conditions, owner, context) => {
            if (!conditions || conditions.length === 0) return true;
            return conditions.every(cond => {
                const type = BattleSystem.normalizeString(cond.type);
                switch (type) {
                    case "chance": return Math.random() * 100 < cond.value;
                    case "hplessthen": 
                        const hpTarget = cond.target === "Self" ? owner : (owner === context.actor ? context.target : context.actor);
                        if (!hpTarget) return false;
                        return (hpTarget.currentHp / hpTarget.currentStats.hp) * 100 <= cond.value;
                    case "iscritical": return !!context.isCrit;
                    case "always": return true;
                    default: return true; 
                }
            });
        },

        applyEffects: (effects, owner, context, sourceName, allowedTypes) => {
            effects.forEach(eff => {
                const type = BattleSystem.normalizeString(eff.type);
                if (allowedTypes && !allowedTypes.includes(type)) return;

                const effTarget = eff.target === "Self" ? owner : (owner === context.actor ? context.target : context.actor);
                if (!effTarget) return;

                const valType = BattleSystem.normalizeString(eff.valueType);

                switch (type) {
                    case "Heal":
                        let healAmount = valType === "PercentOfDamage" 
                            ? (context.damage || 0) * (eff.value / 100) 
                            : eff.value;
                        healAmount = Math.floor(healAmount);
                        if (healAmount != 0) {
                            effTarget.currentHp = Math.min(effTarget.currentHp + healAmount, effTarget.currentStats.hp);
                            addLog(turn, owner, effTarget, 'heal', healAmount, `[${sourceName}] Healed ${healAmount} HP`);
                        }
                        break;

                    case "ModifyDamage":
                        if (context.damageMultiplier !== undefined) {
                            if (eff.op === "multiply") context.damageMultiplier *= eff.value;
                            else if (eff.op === "add") context.damageBonus += eff.value;
                        }
                        break;

                    case "DealDamage": 
                        let dmgVal = valType === "PercentOfDamage" 
                            ? (context.damage || 0) * (eff.value / 100) 
                            : eff.value;
                        dmgVal = Math.floor(dmgVal);
                        if (dmgVal != 0) {
                            effTarget.currentHp -= dmgVal;
                            addLog(turn, owner, effTarget, 'attack', dmgVal, `[${sourceName}] deals extra damage`);
                        }
                        break;

                    case "BuffStat":
                        if (!effTarget.currentStats[eff.stat]) effTarget.currentStats[eff.stat] = 0;
                        effTarget.currentStats[eff.stat] += eff.value;
                        addLog(turn, owner, effTarget, 'buff', eff.value, `[${sourceName}] ${eff.stat.toUpperCase()} ${eff.value>0?'+':''}${eff.value}`);
                        if (eff.duration && eff.duration > 0) {
                            effTarget.activeBuffs.push({ stat: eff.stat, val: eff.value, duration: eff.duration+1, source: sourceName });
                        }
                        break;
                }
            });
        }
    };

    // ==========================================
    // 공격 처리
    // ==========================================
    const processAttack = (attacker, defender) => {
        const aStats = attacker.currentStats;
        const bStats = defender.currentStats;
        attacker.tracker.attacks++;

        let context = { 
            actor: attacker, target: defender, 
            damage: 0, damageMultiplier: 1.0, damageBonus: 0, 
            isCrit: false 
        };

        // 0. 공격 전 트리거
        BattleSystem.processTriggers("OnBeforeAttack", attacker, context);

        // ===============================================
        // 1. 명중(Hit) 공식 계산
        // ===============================================
        let hitChance = 0;
        try {
            hitChance = Sim.calculateValue(gameRules.hitFormula, { a: aStats, b: bStats });
        } catch (e) {
            const acc = aStats.acc || 0;
            const eva = bStats.eva || 0;
            hitChance = (acc - eva);
        }

        hitChance = Math.max(5, Math.min(100, hitChance));

        // 회피 판정
        if (Math.random() * 100 > hitChance) {
            addLog(turn, attacker, defender, 'miss', 0, 'Missed!');
            attacker.tracker.misses++; 
            BattleSystem.processTriggers("OnMiss", attacker, context);
            BattleSystem.processTriggers("OnEvasion", defender, context);
            return; 
        }

        // ===============================================
        // 2. 데미지 계산
        // ===============================================
        let rawDmg = 0;
        try { 
            rawDmg = Sim.calculateValue(gameRules.dmgFormula, { a: aStats, b: bStats }); 
        } catch (e) { rawDmg = 0; }

        const variance = attacker.variance || 0;
        if (variance > 0) rawDmg *= (1 + (Math.random() * variance * 2 - variance));

        // 3. 크리티컬 체크
        const criChance = aStats.cric !== undefined ? aStats.cric : (aStats.cri || 0);
        if (Math.random() * 100 < criChance) {
            context.isCrit = true;
            rawDmg *= (aStats.crid || 1.5);
            attacker.tracker.crits++;
        }

        // 4. [Phase 1] 피격 시 (데미지 확정 전)
        context.damage = Math.floor(rawDmg);
        BattleSystem.processTriggers("OnHitTaken", defender, context, ["ModifyDamage", "BuffStat"]);

        // 5. 최종 데미지 적용
        rawDmg = (rawDmg * context.damageMultiplier) + context.damageBonus;
        let finalDmg = Math.floor(rawDmg);
        if (finalDmg < 0) finalDmg = 0;
        context.damage = finalDmg;

        defender.currentHp -= finalDmg;
        attacker.tracker.damageDealt += finalDmg;
        attacker.tracker.hits++;

        let msg = `deals ${finalDmg} damage`;
        if (context.isCrit) msg += " (Critical!)";
        addLog(turn, attacker, defender, 'attack', finalDmg, msg);

        // 6. [Phase 2] 피격 시 (데미지 적용 후)
        BattleSystem.processTriggers("OnHitTaken", defender, context, ["Heal", "DealDamage", "BuffStat"]);

        // 7. 적중 시 & 크리티컬 시 트리거
        BattleSystem.processTriggers("OnAttackHit", attacker, context);
        if (context.isCrit) {
            BattleSystem.processTriggers("OnCritical", attacker, context);
        }
    };

    // Main Loop
    const aspdA = fighterA.currentStats.aspd || 1;
    const aspdB = fighterB.currentStats.aspd || 1;
    const totalSpeed = aspdA + aspdB;
    const chanceA = totalSpeed > 0 ? (aspdA / totalSpeed) : 0.5;
    
    const isPlayerFirst = Math.random() < chanceA;
    let first = isPlayerFirst ? fighterA : fighterB;
    let second = isPlayerFirst ? fighterB : fighterA;

    BattleSystem.processTriggers("OnBattleStart", first, { actor: first, target: second });
    BattleSystem.processTriggers("OnBattleStart", second, { actor: second, target: first });

    while (turn < MAX_TURNS && fighterA.currentHp > 0 && fighterB.currentHp > 0) {
        turn++;
        BattleSystem.processTriggers("OnTurnStart", first, { actor: first, target: second, turn });
        BattleSystem.processTriggers("OnTurnStart", second, { actor: second, target: first, turn });

        processAttack(first, second);
        processBuffDurations(first, turn, addLog);
        if (second.currentHp <= 0) { winner = first; addLog(turn, second, null, 'die', 0, 'collapsed!'); break; }

        processAttack(second, first);
        processBuffDurations(second, turn, addLog);
        if (first.currentHp <= 0) { winner = second; addLog(turn, first, null, 'die', 0, 'collapsed!'); break; }

        BattleSystem.processTriggers("OnTurnEnd", first, { actor: first, target: second, turn });
        BattleSystem.processTriggers("OnTurnEnd", second, { actor: second, target: first, turn });
    }

    if (!winner) addLog(turn, null, null, 'end', 0, 'Draw');
    if (winner) {
        const loser = winner === fighterA ? fighterB : fighterA;
        if (loser.currentHp < 0) winner.tracker.overkill = Math.abs(loser.currentHp);
    }

    return {
        winnerId: winner ? winner.id : null,
        winnerHp: winner ? winner.currentHp : 0,
        turns: turn,
        logs: logs,
        isPlayerFirst: isPlayerFirst,
        statsA: fighterA.tracker,
        statsB: fighterB.tracker
    };
}

function runBattleBatch(entA, statsA, entB, statsB, count, dmgFormula) {
    let winsA = 0; let totalTurns = 0; let allLogs = []; const LOG_LIMIT = 100;
    for (let i = 0; i < count; i++) {
        const shouldRecord = (i < LOG_LIMIT);
        const result = simulateBattle(entA, statsA, entB, statsB, dmgFormula, shouldRecord);
        if (shouldRecord) allLogs.push(result.logs);
        if (result.winnerId === entA.id) winsA++;
        totalTurns += result.turns;
    }
    return { opponentName: entB.name, winRate: (winsA / count) * 100, avgTurns: totalTurns / count, allLogs: allLogs };
}

function runMonteCarlo(entA, statsA, entB, statsB, count = 10000, dmgFormula) {
    let winsA = 0; let totalTurns = 0; let winsWhenFirst = 0; let totalFirst = 0;
    let totalAttacksA = 0; let totalCritsA = 0; let totalDefensesA = 0; let totalDodgesA = 0;   
    let totalDamageA = 0; let totalOverkillA = 0;
    const turnDist = {}; const winHpDistA = []; const winHpDistB = []; 

    for (let i = 0; i < count; i++) {
    const result = simulateBattle(entA, statsA, entB, statsB, dmgFormula, false);
        if (result.isPlayerFirst) { totalFirst++; if (result.winnerId === entA.id) winsWhenFirst++; }
        totalAttacksA += result.statsA.attacks; totalCritsA += result.statsA.crits;
        totalDamageA += result.statsA.damageDealt; totalDefensesA += result.statsB.attacks; totalDodgesA += result.statsB.misses;
        if (result.winnerId === entA.id) { winsA++; totalOverkillA += result.statsA.overkill; winHpDistA.push(result.winnerHp); } 
        else if (result.winnerId === entB.id) { winHpDistB.push(result.winnerHp); }
        const t = result.turns; turnDist[t] = (turnDist[t] || 0) + 1; totalTurns += t;
    }
    return { 
        count, winsA, winRate: (winsA/count)*100, avgTurns: totalTurns/count, turnDist, winHpDistA, winHpDistB, 
        firstTurnWinRate: totalFirst > 0 ? (winsWhenFirst/totalFirst*100) : 0, 
        realizedCritRate: totalAttacksA > 0 ? (totalCritsA/totalAttacksA*100) : 0, 
        realizedDodgeRate: totalDefensesA > 0 ? (totalDodgesA/totalDefensesA*100) : 0, 
        avgDpt: totalTurns > 0 ? (totalDamageA/totalTurns) : 0, 
        avgOverkill: winsA > 0 ? (totalOverkillA/winsA) : 0 
    };
}

module.exports = { simulateBattle, runBattleBatch, runMonteCarlo };