const { ipcRenderer } = require('electron');

document.getElementById('minBtn').addEventListener('click', () => {
    ipcRenderer.send('minimize-app');
});
document.getElementById('maxBtn').addEventListener('click', () => {
    ipcRenderer.send('maximize-app');
});
document.getElementById('closeBtn').addEventListener('click', () => {
    ipcRenderer.send('close-app');
});

const dom = {
    container: document.getElementById('entityContainer'),
    maxLevel: document.getElementById('maxLevel'),
    addBtn: document.getElementById('addBtn'),
    calcBtn: document.getElementById('calcBtn'),
    exportBtn: document.getElementById('exportBtn'),
    saveBtn: document.getElementById('saveBtn'),
    loadBtn: document.getElementById('loadBtn'),
    itemContainer: document.getElementById('itemContainer'),
    addItemBtn: document.getElementById('addItemBtn'),
    configBtn: document.getElementById('configBtn'),
    configModal: document.getElementById('configModal'),
    closeModal: document.querySelector('.close-modal'),
    applyConfigBtn: document.getElementById('applyConfigBtn'),
    dmgFormulaInput: document.getElementById('dmgFormula'),
    cpFormulaInput: document.getElementById('cpFormula'),
    statDefinitionsInput: document.getElementById('statDefinitions'),
    graphMetric: document.getElementById('graphMetric'),
    openBattleBtn: document.getElementById('openBattleBtn'),
    battleModal: document.getElementById('battleModal'),
    closeBattle: document.querySelector('.close-battle'),
    battleEntA: document.getElementById('battleEntA'),
    battleEntB: document.getElementById('battleEntB'),
    battleLevel: document.getElementById('battleLevel'),
    battleCount: document.getElementById('battleCount'),
    runBattleBtn: document.getElementById('runBattleBtn'),
    battleLog: document.getElementById('battleLog'),
    battleResultChartCanvas: document.getElementById('battleResultChart')
};

const resizerLeft = document.getElementById('resizerLeft');
const resizerRight = document.getElementById('resizerRight');
const leftSidebar = document.getElementById('leftSidebar');
const rightSidebar = document.getElementById('rightSidebar');
const resizerVertical = document.getElementById('resizerVertical');
const analysisPanel = document.getElementById('analysisPanel');

let myChart = null;
let battleChart = null;

let gameRules = {
    stats: ['hp', 'atk', 'def', 'aspd', 'eva'],
    dmgFormula: 'atk * (100 / (100 + def))',
    cpFormula: 'atk * aspd * 10 + hp * 0.5 + def * 1.5 + eva * 2'
};

let entities = [
    { 
        id: 1, 
        name: 'Warrior', 
        color: '#007acc',
        variance: 0.1,
        stats: {
            hp: { b: 200, g: 20 },
            atk: { b: 20, g: 2 },
            def: { b: 10, g: 1 },
            aspd: { b: 1.0, g: 0 },
            eva: { b: 5, g: 0 }
        }
    },
    { 
        id: 2, 
        name: 'Assassin', 
        color: '#ff5555',
        variance: 0.2,
        stats: {
            hp: { b: 120, g: 10 },
            atk: { b: 15, g: 1.5 },
            def: { b: 2, g: 0.2 },
            aspd: { b: 2.0, g: 0.05 },
            eva: { b: 20, g: 0.5 }
        }
    }
];

let items = [];

function renderUI() {
    dom.container.innerHTML = '';

    entities.forEach((ent, index) => {
        const card = document.createElement('div');
        card.className = 'entity-card';

        let statsHtml = '';
        gameRules.stats.forEach(statName => {
            const statData = ent.stats[statName] || { b: 0, g: 0 };
            statsHtml += `
                <div style="display:flex; align-items:center; gap:5px; margin-bottom:5px;">
                    <span style="width:40px; font-size:0.8em; font-weight:bold; color:#b9bbbe;">${statName.toUpperCase()}</span>
                    <input type="number" placeholder="Base" value="${statData.b}" 
                           class="stat-input" data-stat="${statName}" data-type="b" style="width:60px;">
                    <input type="number" placeholder="Grow" value="${statData.g}" 
                           class="stat-input" data-stat="${statName}" data-type="g" style="width:60px;">
                </div>
            `;
        });

        card.innerHTML = `
            <div class="entity-header">
                <input type="color" value="${ent.color}" data-key="color">
                <input type="text" value="${ent.name}" placeholder="Name" data-key="name" style="font-weight:bold;">
                <button class="delete-btn">✕</button>
            </div>
            <div style="margin-bottom:5px; display:flex; align-items:center; gap:5px;">
                <label style="font-size:0.8em; color:#b9bbbe;">Dmg Var:</label>
                <input type="number" value="${ent.variance || 0}" step="0.05" data-key="variance" style="width:60px;">
            </div>
            <div class="entity-stats-container">
                ${statsHtml}
            </div>
        `;

        card.querySelectorAll('input[data-key]').forEach(input => {
            input.addEventListener('input', (e) => {
                const key = e.target.getAttribute('data-key');
                const val = e.target.value;
                entities[index][key] = (key === 'variance') ? parseFloat(val) : val;
                runSimulation();
            });
        });

        card.querySelectorAll('.stat-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const statName = e.target.dataset.stat;
                const type = e.target.dataset.type;
                if (!entities[index].stats[statName]) entities[index].stats[statName] = {b:0, g:0};
                entities[index].stats[statName][type] = parseFloat(e.target.value);
                runSimulation();
            });
        });

        card.querySelector('.delete-btn').addEventListener('click', () => {
            entities.splice(index, 1);
            renderUI();
            renderItemUI();
            runSimulation();
        });

        dom.container.appendChild(card);
    });
}

function renderItemUI() {
    dom.itemContainer.innerHTML = '';

    items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.style.opacity = item.active ? '1' : '0.5';

        let targetHtml = '';
        entities.forEach(ent => {
            const isChecked = item.targets.includes(ent.id) ? 'checked' : '';
            targetHtml += `
                <label class="target-checkbox" style="border-left: 3px solid ${ent.color}">
                    <input type="checkbox" class="target-select" data-ent-id="${ent.id}" ${isChecked}>
                    <span>${ent.name}</span>
                </label>
            `;
        });

        let modifiersHtml = '';
        item.modifiers.forEach((mod, modIndex) => {
            let statOptions = '';
            gameRules.stats.forEach(s => {
                statOptions += `<option value="${s}" ${mod.stat === s ? 'selected' : ''}>${s.toUpperCase()}</option>`;
            });

            modifiersHtml += `
                <div class="item-stat-row">
                    <select class="dark-select mod-stat" data-mod-index="${modIndex}" style="width:70px;">${statOptions}</select>
                    <select class="dark-select mod-op" data-mod-index="${modIndex}" style="width:50px;">
                        <option value="add" ${mod.op === 'add' ? 'selected' : ''}>+</option>
                        <option value="mult" ${mod.op === 'mult' ? 'selected' : ''}>×</option>
                    </select>
                    <input type="number" class="mod-val" data-mod-index="${modIndex}" value="${mod.val}" style="width:50px;">
                    <button class="remove-stat-btn" data-mod-index="${modIndex}">-</button>
                </div>
            `;
        });

        card.innerHTML = `
            <div class="item-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" class="item-toggle" ${item.active ? 'checked' : ''}>
                    <input type="text" value="${item.name}" data-key="name" style="width:100px; font-weight:bold;">
                </div>
                <button class="delete-item-btn" style="color:#ff5555; background:none; border:none; cursor:pointer;">✕</button>
            </div>
            
            <div class="item-stats-list">
                ${modifiersHtml}
                <button class="add-stat-btn">+ Add Stat</button>
            </div>

            <div class="item-targets">
                <span class="item-targets-label">Apply to:</span>
                <div class="item-targets-list">
                    ${targetHtml}
                </div>
            </div>
        `;

        card.querySelector('.item-toggle').addEventListener('change', (e) => {
            items[index].active = e.target.checked;
            renderItemUI();
            runSimulation();
        });
        card.querySelector('input[type="text"]').addEventListener('input', (e) => {
            items[index].name = e.target.value;
        });

        card.querySelectorAll('.mod-stat').forEach(el => {
            el.addEventListener('change', (e) => {
                items[index].modifiers[e.target.dataset.modIndex].stat = e.target.value;
                runSimulation();
            });
        });
        card.querySelectorAll('.mod-op').forEach(el => {
            el.addEventListener('change', (e) => {
                items[index].modifiers[e.target.dataset.modIndex].op = e.target.value;
                runSimulation();
            });
        });
        card.querySelectorAll('.mod-val').forEach(el => {
            el.addEventListener('input', (e) => {
                items[index].modifiers[e.target.dataset.modIndex].val = parseFloat(e.target.value);
                runSimulation();
            });
        });

        card.querySelector('.add-stat-btn').addEventListener('click', () => {
            items[index].modifiers.push({ stat: gameRules.stats[0], op: 'add', val: 0 });
            renderItemUI();
            runSimulation();
        });
        card.querySelectorAll('.remove-stat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modIdx = parseInt(e.target.dataset.modIndex);
                items[index].modifiers.splice(modIdx, 1);
                renderItemUI();
                runSimulation();
            });
        });

        card.querySelectorAll('.target-select').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const entId = parseInt(e.target.dataset.entId);
                if (e.target.checked) {
                    if (!items[index].targets.includes(entId)) items[index].targets.push(entId);
                } else {
                    items[index].targets = items[index].targets.filter(id => id !== entId);
                }
                runSimulation();
            });
        });

        card.querySelector('.delete-item-btn').addEventListener('click', () => {
            items.splice(index, 1);
            renderItemUI();
            runSimulation();
        });

        dom.itemContainer.appendChild(card);
    });
}

dom.addItemBtn.addEventListener('click', () => {
    const allEntityIds = entities.map(e => e.id);
    const firstStat = gameRules.stats[0] || 'hp';
    
    items.push({
        id: Date.now(),
        name: 'New Item',
        active: true,
        targets: allEntityIds,
        modifiers: [
            { stat: firstStat, op: 'add', val: 10 }
        ]
    });
    renderItemUI();
    runSimulation();
});

dom.addBtn.addEventListener('click', () => {
    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16);
    let defaultStats = {};
    gameRules.stats.forEach(s => defaultStats[s] = { b: 10, g: 1 });

    entities.push({
        id: Date.now(),
        name: `New Unit`,
        color: randomColor,
        stats: defaultStats,
        variance: 0.0
    });
    renderUI();
    renderItemUI();
    runSimulation();
});

function getStatsAtLevel(ent, lv) {
    let currentStats = {};
    
    gameRules.stats.forEach(statName => {
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

function calculateValue(formula, statsSnapshot) {
    try {
        const keys = Object.keys(statsSnapshot);
        const values = Object.values(statsSnapshot);
        const func = new Function(...keys, `return ${formula};`);
        return func(...values);
    } catch (e) {
        return 0;
    }
}

function runSimulation() {
    const maxLv = parseInt(dom.maxLevel.value);
    const labels = [];
    const datasets = [];
    const rawData = {}; 
    const metric = dom.graphMetric ? dom.graphMetric.value : 'cp';
    const formula = metric === 'cp' ? gameRules.cpFormula : gameRules.dmgFormula;

    for (let i = 1; i <= maxLv; i++) labels.push(`Lv.${i}`);

    entities.forEach(ent => {
        let data = [];
        
        for (let lv = 1; lv <= maxLv; lv++) {
            let currentStats = getStatsAtLevel(ent, lv);
            let val = calculateValue(formula, currentStats);
            data.push(val);
        }

        datasets.push({
            label: ent.name,
            data: data,
            borderColor: ent.color,
            backgroundColor: ent.color + '20',
            borderWidth: 2,
            tension: 0.3
        });
        rawData[ent.name] = { id: ent.id, data: data, color: ent.color };
    });

    renderChart(labels, datasets);
    analyzeCrossovers(rawData, maxLv);
}

function renderChart(labels, datasets) {
    const ctx = document.getElementById('balanceChart').getContext('2d');
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { ticks: { color: '#ccc' }, grid: { color: '#3e3e42' } },
                y: { beginAtZero: true, ticks: { color: '#ccc' }, grid: { color: '#3e3e42' } }
            },
            plugins: {
                legend: { labels: { color: '#fff' } }
            }
        }
    });
}

function analyzeCrossovers(rawData, maxLv) {
    const logContainer = document.getElementById('analysisLog');
    logContainer.innerHTML = '';

    const names = Object.keys(rawData);
    if (names.length < 2) {
        logContainer.innerHTML = '<div class="log-item placeholder">No crossover points detected.</div>';
        return;
    }

    let crossoverFound = false;

    for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
            const charA = names[i];
            const charB = names[j];
            const dataA = rawData[charA].data;
            const dataB = rawData[charB].data;
            const colorA = rawData[charA].color;
            const colorB = rawData[charB].color;

            let currentWinner = null;
            if (dataA[0] > dataB[0]) currentWinner = charA;
            else if (dataB[0] > dataA[0]) currentWinner = charB;
            else currentWinner = 'tie';

            for (let k = 1; k < maxLv; k++) {
                const lv = k + 1;
                
                let newWinner = null;
                if (dataA[k] > dataB[k]) newWinner = charA;
                else if (dataB[k] > dataA[k]) newWinner = charB;
                else newWinner = 'tie';

                if (newWinner !== 'tie' && currentWinner !== 'tie' && newWinner !== currentWinner) {
                    crossoverFound = true;
                    
                    const winnerColor = newWinner === charA ? colorA : colorB;
                    const loserColor = newWinner === charA ? colorB : colorA;
                    const loserName = newWinner === charA ? charB : charA;

                    const logItem = document.createElement('div');
                    logItem.className = 'log-item';
                    
                    logItem.innerHTML = `
                        <span class="log-tag">CROSSOVER</span>
                        <span class="log-level">Lv.${lv-1} -> Lv.${lv}</span>
                        <span>: 
                            <b style="color:${winnerColor}">${newWinner}</b> overtakes <b style="color:${loserColor}">${loserName}</b>
                        </span>
                    `;
                    logContainer.appendChild(logItem);
                    
                    currentWinner = newWinner;
                } 
                else if (currentWinner === 'tie' && newWinner !== 'tie') {
                    currentWinner = newWinner; 
                }
            }
        }
    }

    if (!crossoverFound) {
        logContainer.innerHTML = '<div class="log-item placeholder">No crossover points detected.</div>';
    }
}

dom.configBtn.addEventListener('click', () => {
    dom.dmgFormulaInput.value = gameRules.dmgFormula;
    dom.cpFormulaInput.value = gameRules.cpFormula;
    dom.statDefinitionsInput.value = gameRules.stats.join(', ');
    dom.configModal.style.display = 'flex';
});

dom.closeModal.addEventListener('click', () => dom.configModal.style.display = 'none');

dom.applyConfigBtn.addEventListener('click', () => {
    gameRules.dmgFormula = dom.dmgFormulaInput.value;
    gameRules.cpFormula = dom.cpFormulaInput.value;
    
    const newStats = dom.statDefinitionsInput.value.split(',').map(s => s.trim()).filter(s => s);
    
    entities.forEach(ent => {
        if (!ent.stats) ent.stats = {};
        newStats.forEach(statName => {
            if (!ent.stats[statName]) {
                ent.stats[statName] = { b: 10, g: 1 };
            }
        });
    });
    gameRules.stats = newStats;

    dom.configModal.style.display = 'none';
    renderUI();
    renderItemUI();
    runSimulation();
});

dom.graphMetric.addEventListener('change', runSimulation);

dom.openBattleBtn.addEventListener('click', () => {
    updateBattleSelects();
    dom.battleModal.style.display = 'flex';
});
dom.closeBattle.addEventListener('click', () => dom.battleModal.style.display = 'none');

function updateBattleSelects() {
    dom.battleEntA.innerHTML = '';
    dom.battleEntB.innerHTML = '<option value="all">ALL (League)</option>';
    
    entities.forEach(ent => {
        const optA = new Option(ent.name, ent.id);
        dom.battleEntA.add(optA);
        
        const optB = new Option(ent.name, ent.id);
        dom.battleEntB.add(optB);
    });
    if (entities.length > 1) dom.battleEntB.selectedIndex = 1;
}

dom.runBattleBtn.addEventListener('click', () => {
    const idA = parseInt(dom.battleEntA.value);
    const idB_val = dom.battleEntB.value;
    const lv = parseInt(dom.battleLevel.value);
    const count = parseInt(dom.battleCount.value) || 1;

    const entA = entities.find(e => e.id === idA);
    if (!entA) return;
    const statsA = getStatsAtLevel(entA, lv);

    let opponents = [];
    if (idB_val === 'all') {
        opponents = entities.filter(e => e.id !== idA);
    } else {
        const entB = entities.find(e => e.id === parseInt(idB_val));
        if (entB) opponents.push(entB);
    }

    if (opponents.length === 0) return;

    const results = [];
    dom.battleLog.innerHTML = `Running ${count} simulations...<br><hr>`;

    opponents.forEach(entB => {
        const statsB = getStatsAtLevel(entB, lv);
        const simResult = runBattleBatch(entA, statsA, entB, statsB, count, lv);
        results.push(simResult);
        
        logBattle(`<b>VS ${entB.name}</b>: Win Rate ${simResult.winRate.toFixed(1)}% (Avg TTK: ${simResult.avgTTK.toFixed(2)}s)`);
    });

    renderBattleChart(results);
});

function runBattleBatch(entA, statsA, entB, statsB, count, lv) {
    let wins = 0;
    let totalTTK = 0;
    
    const getBaseDmg = (attacker, defenderStats) => {
        const context = { ...attacker, def: defenderStats.def || 0 }; 
        return calculateValue(gameRules.dmgFormula, context);
    };
    
    const baseDmgA = getBaseDmg(statsA, statsB);
    const baseDmgB = getBaseDmg(statsB, statsA);
    const intervalA = 1 / (statsA.aspd || 1);
    const intervalB = 1 / (statsB.aspd || 1);
    const evaA = statsA.eva || 0;
    const evaB = statsB.eva || 0;

    for (let i = 0; i < count; i++) {
        let hpA = statsA.hp;
        let hpB = statsB.hp;
        let time = 0;
        let cooldownA = 0;
        let cooldownB = 0;
        const tick = 0.1;

        while (time < 120) {
            time += tick;

            if (time >= cooldownA) {
                if (Math.random() * 100 >= evaB) {
                    const variance = entA.variance || 0;
                    const mult = 1 + (Math.random() * variance * 2 - variance);
                    hpB -= baseDmgA * mult;
                }
                if (hpB <= 0) { wins++; totalTTK += time; break; }
                cooldownA += intervalA;
            }

            if (time >= cooldownB) {
                if (Math.random() * 100 >= evaA) {
                    const variance = entB.variance || 0;
                    const mult = 1 + (Math.random() * variance * 2 - variance);
                    hpA -= baseDmgB * mult;
                }
                if (hpA <= 0) { break; }
                cooldownB += intervalB;
            }
        }
    }

    return {
        opponentName: entB.name,
        winRate: (wins / count) * 100,
        avgTTK: wins > 0 ? (totalTTK / wins) : 0
    };
}

function renderBattleChart(results) {
    if (battleChart) battleChart.destroy();
    
    const labels = results.map(r => r.opponentName);
    const winRates = results.map(r => r.winRate);
    const ttks = results.map(r => r.avgTTK);

    const ctx = dom.battleResultChartCanvas.getContext('2d');
    battleChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Win Rate (%)',
                    data: winRates,
                    backgroundColor: '#2da44e',
                    yAxisID: 'y',
                },
                {
                    label: 'Avg TTK (s)',
                    data: ttks,
                    backgroundColor: '#d29922',
                    yAxisID: 'y1',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'Win Rate %', color: '#ccc' },
                    ticks: { color: '#ccc' },
                    grid: { color: '#444' }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    title: { display: true, text: 'Time (s)', color: '#ccc' },
                    ticks: { color: '#ccc' },
                    grid: { drawOnChartArea: false }
                },
                x: { ticks: { color: '#ccc' }, grid: { display: false } }
            },
            plugins: { legend: { labels: { color: '#ccc' } } }
        }
    });
}

function logBattle(msg) {
    const div = document.createElement('div');
    div.className = 'log-item';
    div.innerHTML = msg;
    dom.battleLog.appendChild(div);
    dom.battleLog.scrollTop = dom.battleLog.scrollHeight;
}

function initVerticalResizer(resizer, bottomPanel) {
    let y = 0;
    let h = 0;

    const mouseDownHandler = function (e) {
        y = e.clientY;
        const styles = window.getComputedStyle(bottomPanel);
        h = parseInt(styles.height, 10);

        document.body.classList.add('resizing-v');
        resizer.classList.add('active');

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = function (e) {
        const dy = e.clientY - y;
        const newHeight = h - dy;

        if (newHeight > 50 && newHeight < 600) {
            bottomPanel.style.height = `${newHeight}px`;
        }
        if (myChart) myChart.resize();
    };

    const mouseUpHandler = function () {
        document.body.classList.remove('resizing-v');
        resizer.classList.remove('active');
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    };

    resizer.addEventListener('mousedown', mouseDownHandler);
}

function initResizer(resizer, sidebar, direction) {
    let x = 0;
    let w = 0;

    const mouseDownHandler = function (e) {
        x = e.clientX;
        const styles = window.getComputedStyle(sidebar);
        w = parseInt(styles.width, 10);

        document.body.classList.add('resizing');
        resizer.classList.add('active');

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = function (e) {
        const dx = e.clientX - x;

        if (direction === 'left') {
            sidebar.style.width = `${w + dx}px`;
        } else {
            sidebar.style.width = `${w - dx}px`;
        }
        if(myChart) myChart.resize();
    };

    const mouseUpHandler = function () {
        document.body.classList.remove('resizing');
        resizer.classList.remove('active');
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    };

    resizer.addEventListener('mousedown', mouseDownHandler);
}

initVerticalResizer(resizerVertical, analysisPanel);
initResizer(resizerLeft, leftSidebar, 'left');
initResizer(resizerRight, rightSidebar, 'right');

dom.calcBtn.addEventListener('click', runSimulation);
dom.exportBtn.addEventListener('click', () => {
    const maxLv = parseInt(dom.maxLevel.value);
    let header = ['Level'];
    entities.forEach(e => header.push(e.name));
    let csvContent = header.join(',') + "\n";
    const metric = dom.graphMetric ? dom.graphMetric.value : 'cp';
    const formula = metric === 'cp' ? gameRules.cpFormula : gameRules.dmgFormula;

    for (let lv = 1; lv <= maxLv; lv++) {
        let row = [lv];
        entities.forEach(ent => {
            let currentStats = getStatsAtLevel(ent, lv);
            let val = calculateValue(formula, currentStats);
            row.push(val);
        });
        csvContent += row.join(',') + "\n";
    }
    ipcRenderer.send('export-csv', csvContent);
});

dom.saveBtn.addEventListener('click', () => {
    ipcRenderer.send('save-json', { maxLevel: dom.maxLevel.value, entities: entities, gameRules: gameRules, items: items });
});
dom.loadBtn.addEventListener('click', () => ipcRenderer.send('load-json'));

ipcRenderer.on('load-finished', (event, data) => {
    if(data.maxLevel) dom.maxLevel.value = data.maxLevel;
    if(data.entities) entities = data.entities;
    if(data.gameRules) gameRules = data.gameRules;
    if(data.items) items = data.items;
    
    renderUI();
    renderItemUI();
    runSimulation();
    alert('Loaded!');
});

ipcRenderer.on('export-finished', (event, msg) => alert(msg));
ipcRenderer.on('save-finished', (event, msg) => alert(msg));

renderUI();
renderItemUI();
runSimulation();