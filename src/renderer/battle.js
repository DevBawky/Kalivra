const Sim = require('./calculator');

/**
 * 단일 전투 시뮬레이션
 * - 조건부 효과(Traits) 시스템 적용
 * - Hook 포인트: OnBeforeAttack, OnAttackHit 등
 */
function simulateBattle(entA, statsA, entB, statsB, dmgFormula, recordLog = false) {
    // 1. 전투 객체 초기화 (traits 포함)
    const fighterA = { 
        ...entA, currentStats: { ...statsA }, currentHp: statsA.hp || 100, traits: entA.traits || [],
        activeBuffs: [] 
    };
    const fighterB = { 
        ...entB, currentStats: { ...statsB }, currentHp: statsB.hp || 100, traits: entB.traits || [],
        activeBuffs: [] 
    };

    // HP 안전장치
    fighterA.currentHp = fighterA.currentStats.hp = fighterA.currentStats.hp || 100;
    fighterB.currentHp = fighterB.currentStats.hp = fighterB.currentStats.hp || 100;

    const logs = [];
    let turn = 0;
    const MAX_TURNS = 200;
    let winner = null;

    const addLog = (turn, actor, target, action, val, msg) => {
        if (!recordLog) return;
        logs.push({ 
            turn, 
            actor: actor ? actor.name : 'System', 
            target: target ? target.name : null, 
            action, 
            val, 
            msg 
        });
    };

    // ==========================================
    // [Core] Trigger Engine (조건부 효과 처리기)
    // ==========================================
    const BattleSystem = {
        processTriggers: (triggerName, context) => {
            const actor = context.actor;
            if (!actor.traits || actor.traits.length === 0) return;

            actor.traits.forEach(trait => {
                if (!trait.triggers) return;
                
                // 현재 시점(triggerName)에 맞는 트리거 찾기
                const relevantTriggers = trait.triggers.filter(t => t.type === triggerName);

                relevantTriggers.forEach(trig => {
                    // 조건(Conditions)이 모두 맞는지 확인
                    if (BattleSystem.checkConditions(trig.conditions, context)) {
                        // 효과(Effects) 실행
                        BattleSystem.applyEffects(trig.effects, context, trait.name);
                    }
                });
            });
        },

        checkConditions: (conditions, context) => {
            if (!conditions || conditions.length === 0) return true; // 조건 없으면 무조건 통과

            return conditions.every(cond => {
                switch (cond.type) {
                    case "Chance": // 확률 체크
                        return Math.random() * 100 < cond.value;
                    
                    case "HpLessThen": // 체력 % 이하일 때
                        const target = cond.target === "Self" ? context.actor : context.target;
                        if (!target) return false;
                        const hpPercent = (target.currentHp / target.currentStats.hp) * 100;
                        return hpPercent <= cond.value;

                    // 필요하면 여기에 조건 추가 (예: TurnCount 등)
                    default:
                        return true;
                }
            });
        },

        applyEffects: (effects, context, sourceName) => {
            effects.forEach(eff => {
                switch (eff.type) {
                    case "Heal": // 체력 회복
                        const healTarget = eff.target === "Self" ? context.actor : context.target;
                        if (!healTarget) return;

                        let healAmount = 0;
                        if (eff.valueType === "PercentOfDamage") {
                            healAmount = context.damage * (eff.value / 100);
                        } else if (eff.valueType === "Fixed") {
                            healAmount = eff.value;
                        }
                        
                        healAmount = Math.floor(healAmount);
                        if (healAmount > 0) {
                            healTarget.currentHp = Math.min(healTarget.currentHp + healAmount, healTarget.currentStats.hp);
                            addLog(turn, context.actor, healTarget, 'heal', healAmount, `[${sourceName}] Healed ${healAmount} HP`);
                        }
                        break;

                    case "ModifyDamage": // 데미지 배율/추가
                        // context.damageMultiplier 등을 조작
                        if (eff.op === "multiply") context.damageMultiplier *= eff.value;
                        else if (eff.op === "add") context.damageBonus += eff.value;
                        
                        break;

                    case "BuffStat":
                        const buffTarget = eff.target === "Self" ? context.actor : context.target;
                        if (!buffTarget) return;
                        // 1. 스탯 즉시 적용
                        if (!buffTarget.currentStats[eff.stat]) buffTarget.currentStats[eff.stat] = 0;
                        buffTarget.currentStats[eff.stat] += eff.value;

                        addLog(turn, context.actor, buffTarget, 'buff', eff.value, `[${sourceName}] ${eff.stat.toUpperCase()} Up`);

                        // 2. [NEW] 지속시간이 있다면 activeBuffs에 등록
                        if (eff.duration && eff.duration > 0) {
                            buffTarget.activeBuffs.push({
                                stat: eff.stat,
                                val: eff.value,
                                duration: eff.duration,
                                source: sourceName
                            });
                        }
                        break;

                    case "DealDamage":
                        const dmgTarget = eff.target === "Self" ? context.actor : context.target;
                        if (!dmgTarget) return;

                        let dmgVal = eff.value;
                        // 만약 % 데미지라면 (예: 입은 피해의 100% 반사)
                        if (eff.valueType === "PercentOfDamage") {
                            dmgVal = context.damage * (eff.value / 100);
                        }
                        
                        dmgVal = Math.floor(dmgVal);
                        if (dmgVal > 0) {
                            dmgTarget.currentHp -= dmgVal;
                            addLog(turn, context.actor, dmgTarget, 'attack', dmgVal, `[${sourceName}] deals extra damage`);
                        }
                        break;
                    }
            });
        }
    };

    // ==========================================
    // 공격 처리 함수 (Hook 적용됨)
    // ==========================================
    const processAttack = (attacker, defender) => {
        const aStats = attacker.currentStats;
        const bStats = defender.currentStats;

        // 1. 회피(EVA) 체크
        const evaChance = bStats.eva || 0; 
        if (Math.random() * 100 < evaChance) {
            addLog(turn, attacker, defender, 'miss', 0, 'Missed! (Dodged)');
            return;
        }

        // 2. 데미지 계산 컨텍스트(Context) 생성
        // 이 객체가 트리거들을 돌아다니며 데이터를 주고받음
        let context = {
            actor: attacker,
            target: defender,
            damage: 0,            // 최종 데미지 저장용
            damageMultiplier: 1.0, // 데미지 증폭 배율 (기본 1.0)
            damageBonus: 0         // 추가 데미지 (기본 0)
        };

        // [Hook 1] 공격 전 (OnBeforeAttack) 
        // 예: "체력이 낮으면 공격력 2배" 로직이 여기서 damageMultiplier를 수정함
        BattleSystem.processTriggers("OnBeforeAttack", context);

        // 3. 기본 데미지 수식 계산
        let rawDmg = 0;
        try {
            // 수식 계산 시 a와 b 객체 전달
            rawDmg = Sim.calculateValue(dmgFormula, { a: aStats, b: bStats });
        } catch (e) {
            addLog(turn, attacker, defender, 'error', 0, `Formula Error: ${e.message}`);
            rawDmg = 0;
        }

        // 4. 데미지 분산(Variance) 적용
        const variance = attacker.variance || 0;
        if (variance > 0) {
            const mult = 1 + (Math.random() * variance * 2 - variance);
            rawDmg *= mult;
        }

        // 5. 치명타(CRI) 체크
        const criChance = aStats.cric !== undefined ? aStats.cric : (aStats.cri || 0);
        let isCritical = false;
        if (Math.random() * 100 < criChance) {
            isCritical = true;
            rawDmg *= (aStats.crid || 1.5);
        }

        // 6. [중요] 트리거에 의한 데미지 보정 적용
        rawDmg = (rawDmg * context.damageMultiplier) + context.damageBonus;

        let finalDmg = Math.floor(rawDmg);
        if (finalDmg < 0) finalDmg = 0;

        // 실제 데미지 적용
        defender.currentHp -= finalDmg;
        
        // 컨텍스트에 최종 데미지 업데이트 (흡혈 계산 등을 위해)
        context.damage = finalDmg; 

        let msg = `deals ${finalDmg} damage`;
        if (isCritical) msg += " (Critical!)";
        addLog(turn, attacker, defender, 'attack', finalDmg, msg);

        // [Hook 2] 공격 적중 후 (OnAttackHit)
        // 예: "입힌 데미지의 50% 회복" 로직이 여기서 context.damage를 참조해 회복함
        BattleSystem.processTriggers("OnAttackHit", context);
    };

    // ==========================================
    // 메인 전투 루프
    // ==========================================
    while (turn < MAX_TURNS && fighterA.currentHp > 0 && fighterB.currentHp > 0) {
        turn++;
        
        // ASPD 기반 선공권 결정
        const aspdA = fighterA.currentStats.aspd || 1;
        const aspdB = fighterB.currentStats.aspd || 1;
        const totalSpeed = aspdA + aspdB;
        const chanceA = totalSpeed > 0 ? (aspdA / totalSpeed) : 0.5;

        let first, second;
        if (Math.random() < chanceA) {
            first = fighterA; 
            second = fighterB;
        } else {
            first = fighterB; 
            second = fighterA;
        }

        // 1. 선공
        processAttack(first, second);
        // [NEW] 선공자 버프 턴 차감 (행동 끝날 때 차감)
        processBuffDurations(first, turn, addLog); 

        if (second.currentHp <= 0) { winner = first; addLog(turn, second, null, 'die', 0, 'collapsed!'); break; }

        // 2. 후공
        processAttack(second, first);
        // [NEW] 후공자 버프 턴 차감
        processBuffDurations(second, turn, addLog);

        if (first.currentHp <= 0) { winner = second; addLog(turn, first, null, 'die', 0, 'collapsed!'); break; }
    }

    if (!winner) {
        addLog(turn, null, null, 'end', 0, 'Draw (Max Turns)');
    }

    return {
        winnerName: winner ? winner.name : 'Draw',
        winnerId: winner ? winner.id : null,
        turns: turn,
        logs: logs
    };
}

function processBuffDurations(actor, turn, addLogFunc) {
    if (!actor.activeBuffs || actor.activeBuffs.length === 0) return;

    // 만료되지 않은 버프만 남기기 위해 필터링
    // (forEach로 돌면서 duration 깎고, 0 이하면 효과 제거)
    for (let i = actor.activeBuffs.length - 1; i >= 0; i--) {
        const buff = actor.activeBuffs[i];
        
        // 지속시간 감소
        buff.duration--;

        // 만료 체크
        if (buff.duration <= 0) {
            // 스탯 원상복구 (뺄셈)
            if (actor.currentStats[buff.stat]) {
                actor.currentStats[buff.stat] -= buff.val;
            }
            // 로그 출력
            if (addLogFunc) addLogFunc(turn, actor, null, 'buff', 0, `[${buff.source}] Buff Expired (-${buff.val} ${buff.stat.toUpperCase()})`);
            
            // 배열에서 제거
            actor.activeBuffs.splice(i, 1);
        }
    }
}


function runBattleBatch(entA, statsA, entB, statsB, count, dmgFormula) {
    let winsA = 0;
    let totalTurns = 0;
    let allLogs = []; 

    // 메모리 보호: 최대 100판까지만 상세 로그 저장
    const LOG_LIMIT = 100;

    for (let i = 0; i < count; i++) {
        const shouldRecord = (i < LOG_LIMIT);
        const result = simulateBattle(entA, statsA, entB, statsB, dmgFormula, shouldRecord);

        if (shouldRecord) {
            allLogs.push(result.logs);
        }

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

module.exports = {
    simulateBattle,
    runBattleBatch
};