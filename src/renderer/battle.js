const Sim = require('./calculator');

/**
 * 단일 전투 시뮬레이션
 * - ASPD(선공 확률), EVA(회피), CRI(치명타), Variance(분산) 적용
 */
function simulateBattle(entA, statsA, entB, statsB, dmgFormula, recordLog = false) {
    // 1. 전투 객체 초기화 (Deep Copy)
    const fighterA = { ...entA, currentStats: { ...statsA }, currentHp: statsA.hp || 100 };
    const fighterB = { ...entB, currentStats: { ...statsB }, currentHp: statsB.hp || 100 };
    
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

    const createBattleContext = (attackerStats, defenderStats) => {
        return {
            ...attackerStats, 
            a: attackerStats, 
            b: defenderStats
        };
    };

    // 공격 처리 함수
    const processAttack = (attacker, defender) => {
        const aStats = attacker.currentStats;
        const bStats = defender.currentStats;

        // 1. 회피(EVA) 체크
        const evaChance = bStats.eva || 0; 
        if (Math.random() * 100 < evaChance) {
            addLog(turn, attacker, defender, 'miss', 0, 'Missed! (Dodged)');
            return;
        }

        // 2. 기본 데미지 계산
        const context = createBattleContext(aStats, bStats);
        let rawDmg = 0;
        try {
            rawDmg = Sim.calculateValue(dmgFormula, context);
        } catch (e) {
            console.error("Formula Error:", e);
            rawDmg = 0;
        }
        
        // 3. 데미지 분산(Variance) 적용
        const variance = attacker.variance || 0;
        if (variance > 0) {
            // 예: var 0.1 -> 0.9 ~ 1.1배
            const mult = 1 + (Math.random() * variance * 2 - variance);
            rawDmg *= mult;
        }

        // 4. 치명타(CRI) 체크
        const criChance = aStats.cric || aStats.cri || 0;
        let isCritical = false;
        if (Math.random() * 100 < criChance) {
            isCritical = true;
            const criMult = aStats.crid || 1.5; 
            rawDmg *= criMult;
        }

        let finalDmg = Math.floor(rawDmg);
        

        defender.currentHp -= finalDmg;

        let msg = `deals ${finalDmg} damage`;
        if (isCritical) msg += " (Critical!)";
        
        addLog(turn, attacker, defender, 'attack', finalDmg, msg);
    };

    // --- Battle Loop ---
    while (turn < MAX_TURNS && fighterA.currentHp > 0 && fighterB.currentHp > 0) {
        turn++;
        
        // [NEW] ASPD 기반 선공권 결정 로직
        const aspdA = fighterA.currentStats.aspd || 1;
        const aspdB = fighterB.currentStats.aspd || 1;
        const totalSpeed = aspdA + aspdB;

        // A가 선공을 가져갈 확률 = A공속 / 전체공속
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
        if (second.currentHp <= 0) {
            winner = first;
            addLog(turn, second, null, 'die', 0, 'collapsed!');
            break;
        }

        // 2. 후공 (선공자가 적을 못 죽였을 때만)
        processAttack(second, first);
        if (first.currentHp <= 0) {
            winner = second;
            addLog(turn, first, null, 'die', 0, 'collapsed!');
            break;
        }
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

/**
 * 대량 시뮬레이션 배치
 */
function runBattleBatch(entA, statsA, entB, statsB, count, dmgFormula) {
    let winsA = 0;
    let totalTurns = 0;
    let allLogs = []; // 모든 로그 저장용 배열

    // 메모리 보호를 위해 최대 100판까지만 상세 로그 저장
    const LOG_LIMIT = 100;

    for (let i = 0; i < count; i++) {
        // 제한 횟수 내에서는 로그 기록 (true)
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
        avgTurns: totalTurns / count, // TTK 대신 Turn 반환
        allLogs: allLogs 
    };
}

module.exports = {
    simulateBattle,
    runBattleBatch
};