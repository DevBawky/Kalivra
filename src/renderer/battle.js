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
 * 단일 전투 시뮬레이션 (통계 추적 강화판)
 */
function simulateBattle(entA, statsA, entB, statsB, dmgFormula, recordLog = false) {
    // 1. 전투 객체 초기화 (통계용 statsTracker 추가)
    const initFighter = (ent, stats) => ({
        ...ent, currentStats: { ...stats }, currentHp: stats.hp || 100, traits: ent.traits || [], activeBuffs: [],
        // [NEW] 전투 내 통계 추적용
        tracker: { 
            attacks: 0, crits: 0, hits: 0, misses: 0, 
            damageDealt: 0, overkill: 0 
        }
    });

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
        processTriggers: (triggerName, context) => {
            const actor = context.actor;
            if (!actor.traits || actor.traits.length === 0) return;
            actor.traits.forEach(trait => {
                if (!trait.triggers) return;
                trait.triggers.filter(t => t.type === triggerName).forEach(trig => {
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
                    case "Chance": return Math.random() * 100 < cond.value;
                    case "HpLessThen": 
                        const target = cond.target === "Self" ? context.actor : context.target;
                        if (!target) return false;
                        return (target.currentHp / target.currentStats.hp) * 100 <= cond.value;
                    default: return true;
                }
            });
        },
        applyEffects: (effects, context, sourceName) => {
            effects.forEach(eff => {
                switch (eff.type) {
                    case "Heal":
                        const healTarget = eff.target === "Self" ? context.actor : context.target;
                        if (!healTarget) return;
                        let healAmount = eff.valueType === "PercentOfDamage" ? context.damage * (eff.value / 100) : eff.value;
                        healAmount = Math.floor(healAmount);
                        if (healAmount > 0) {
                            healTarget.currentHp = Math.min(healTarget.currentHp + healAmount, healTarget.currentStats.hp);
                            addLog(turn, context.actor, healTarget, 'heal', healAmount, `[${sourceName}] Healed ${healAmount} HP`);
                        }
                        break;
                    case "ModifyDamage":
                        if (eff.op === "multiply") context.damageMultiplier *= eff.value;
                        else if (eff.op === "add") context.damageBonus += eff.value;
                        break;
                    case "DealDamage": // 추가타 (통계 집계 제외: 보통 메인 공격만 치명타/회피 집계함)
                        const dmgTarget = eff.target === "Self" ? context.actor : context.target;
                        if (!dmgTarget) return;
                        let dmgVal = eff.valueType === "PercentOfDamage" ? context.damage * (eff.value / 100) : eff.value;
                        dmgVal = Math.floor(dmgVal);
                        if (dmgVal > 0) {
                            dmgTarget.currentHp -= dmgVal;
                            addLog(turn, context.actor, dmgTarget, 'attack', dmgVal, `[${sourceName}] deals extra damage`);
                        }
                        break;
                    case "BuffStat":
                        const buffTarget = eff.target === "Self" ? context.actor : context.target;
                        if (!buffTarget) return;
                        if (!buffTarget.currentStats[eff.stat]) buffTarget.currentStats[eff.stat] = 0;
                        buffTarget.currentStats[eff.stat] += eff.value;
                        addLog(turn, context.actor, buffTarget, 'buff', eff.value, `[${sourceName}] ${eff.stat.toUpperCase()} Up`);
                        if (eff.duration && eff.duration > 0) {
                            buffTarget.activeBuffs.push({ stat: eff.stat, val: eff.value, duration: eff.duration, source: sourceName });
                        }
                        break;
                }
            });
        }
    };

    // ==========================================
    // 공격 처리 (통계 집계 포함)
    // ==========================================
    const processAttack = (attacker, defender) => {
        const aStats = attacker.currentStats;
        const bStats = defender.currentStats;

        // [Stats] 공격 시도 횟수 증가
        attacker.tracker.attacks++;

        // 1. 회피(EVA) 체크
        const evaChance = bStats.eva || 0; 
        if (Math.random() * 100 < evaChance) {
            addLog(turn, attacker, defender, 'miss', 0, 'Missed! (Dodged)');
            attacker.tracker.misses++; // [Stats] 빗나감(상대 회피) 증가
            return;
        }

        let context = { actor: attacker, target: defender, damage: 0, damageMultiplier: 1.0, damageBonus: 0 };
        BattleSystem.processTriggers("OnBeforeAttack", context);

        let rawDmg = 0;
        try { rawDmg = Sim.calculateValue(dmgFormula, { a: aStats, b: bStats }); } 
        catch (e) { addLog(turn, attacker, defender, 'error', 0, `Error: ${e.message}`); }

        const variance = attacker.variance || 0;
        if (variance > 0) rawDmg *= (1 + (Math.random() * variance * 2 - variance));

        const criChance = aStats.cric !== undefined ? aStats.cric : (aStats.cri || 0);
        let isCritical = false;
        if (Math.random() * 100 < criChance) {
            isCritical = true;
            rawDmg *= (aStats.crid || 1.5);
            attacker.tracker.crits++; // [Stats] 치명타 증가
        }

        rawDmg = (rawDmg * context.damageMultiplier) + context.damageBonus;
        let finalDmg = Math.floor(rawDmg);
        if (finalDmg < 0) finalDmg = 0;

        // 실제 데미지 적용
        defender.currentHp -= finalDmg;
        context.damage = finalDmg;
        
        // [Stats] 데미지 집계
        attacker.tracker.damageDealt += finalDmg;
        attacker.tracker.hits++;

        let msg = `deals ${finalDmg} damage`;
        if (isCritical) msg += " (Critical!)";
        addLog(turn, attacker, defender, 'attack', finalDmg, msg);

        BattleSystem.processTriggers("OnAttackHit", context);
    };

    // ==========================================
    // 메인 전투 루프
    // ==========================================
    // 선공 결정
    const aspdA = fighterA.currentStats.aspd || 1;
    const aspdB = fighterB.currentStats.aspd || 1;
    const totalSpeed = aspdA + aspdB;
    const chanceA = totalSpeed > 0 ? (aspdA / totalSpeed) : 0.5;
    
    // 이번 전투의 선공자 기록 (통계용)
    const isPlayerFirst = Math.random() < chanceA;
    let first = isPlayerFirst ? fighterA : fighterB;
    let second = isPlayerFirst ? fighterB : fighterA;

    // 전투 시작 훅
    BattleSystem.processTriggers("OnBattleStart", { actor: first, target: second });
    BattleSystem.processTriggers("OnBattleStart", { actor: second, target: first });

    while (turn < MAX_TURNS && fighterA.currentHp > 0 && fighterB.currentHp > 0) {
        turn++;
        
        // 1. 선공
        processAttack(first, second);
        processBuffDurations(first, turn, addLog);
        if (second.currentHp <= 0) { 
            winner = first; 
            addLog(turn, second, null, 'die', 0, 'collapsed!'); 
            break; 
        }

        // 2. 후공
        processAttack(second, first);
        processBuffDurations(second, turn, addLog);
        if (first.currentHp <= 0) { 
            winner = second; 
            addLog(turn, first, null, 'die', 0, 'collapsed!'); 
            break; 
        }
    }
    if (!winner) addLog(turn, null, null, 'end', 0, 'Draw');

    // [Stats] 오버킬 계산 (승리한 경우, 패자의 마이너스 체력)
    if (winner) {
        const loser = winner === fighterA ? fighterB : fighterA;
        if (loser.currentHp < 0) winner.tracker.overkill = Math.abs(loser.currentHp);
    }

    return {
        winnerId: winner ? winner.id : null,
        winnerHp: winner ? winner.currentHp : 0,
        turns: turn,
        logs: logs,
        // 통계 데이터 반환
        isPlayerFirst: isPlayerFirst,
        statsA: fighterA.tracker,
        statsB: fighterB.tracker
    };
}

// 배치 실행 (기존)
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

// [New] 몬테카를로 분석 (심층 통계 집계)
function runMonteCarlo(entA, statsA, entB, statsB, count = 10000, dmgFormula) {
    let winsA = 0;
    let totalTurns = 0;
    
    // 심층 통계 변수들
    let winsWhenFirst = 0;
    let totalFirst = 0;
    
    let totalAttacksA = 0;
    let totalCritsA = 0;
    let totalDefensesA = 0; // A가 맞은 횟수 (B의 공격 횟수)
    let totalDodgesA = 0;   // A가 회피한 횟수 (B의 미스 횟수)
    let totalDamageA = 0;
    let totalOverkillA = 0;

    // 분포 데이터
    const turnDist = {}; 
    const winHpDistA = []; 
    const winHpDistB = []; 

    for (let i = 0; i < count; i++) {
        const result = simulateBattle(entA, statsA, entB, statsB, dmgFormula, false);
        
        // 1. 선공 통계
        if (result.isPlayerFirst) {
            totalFirst++;
            if (result.winnerId === entA.id) winsWhenFirst++;
        }

        // 2. 전투 통계 누적 (승패 무관하게 누적하여 '평균 퍼포먼스' 측정)
        totalAttacksA += result.statsA.attacks;
        totalCritsA   += result.statsA.crits;
        totalDamageA  += result.statsA.damageDealt;
        
        // A의 방어 통계 (B가 공격한 횟수 중 미스 난 것)
        totalDefensesA += result.statsB.attacks; 
        totalDodgesA   += result.statsB.misses;

        // 3. 승패 관련 통계
        if (result.winnerId === entA.id) {
            winsA++;
            totalOverkillA += result.statsA.overkill;
            winHpDistA.push(result.winnerHp);
        } else if (result.winnerId === entB.id) {
            winHpDistB.push(result.winnerHp);
        }
        
        const t = result.turns;
        turnDist[t] = (turnDist[t] || 0) + 1;
        totalTurns += t;
    }

    // 계산
    const winRate = (winsA / count) * 100;
    const avgTurns = totalTurns / count;
    
    // 선공 승률 (선공 잡은 판이 없으면 0)
    const firstTurnWinRate = totalFirst > 0 ? (winsWhenFirst / totalFirst * 100) : 0;
    
    // 실제 확률 (Realized RNG)
    const realizedCritRate = totalAttacksA > 0 ? (totalCritsA / totalAttacksA * 100) : 0;
    const realizedDodgeRate = totalDefensesA > 0 ? (totalDodgesA / totalDefensesA * 100) : 0;
    
    // DPT (데미지 / 턴) - 여기서는 '라운드(Turn)' 기준
    const avgDpt = totalTurns > 0 ? (totalDamageA / totalTurns) : 0;
    
    // 평균 오버킬 (승리한 판 기준)
    const avgOverkill = winsA > 0 ? (totalOverkillA / winsA) : 0;

    return {
        count,
        winsA,
        winRate,
        avgTurns,
        turnDist,
        winHpDistA,
        winHpDistB,
        // [New Metrics]
        firstTurnWinRate,
        realizedCritRate,
        realizedDodgeRate,
        avgDpt,
        avgOverkill
    };
}

module.exports = { simulateBattle, runBattleBatch, runMonteCarlo };