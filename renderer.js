const { ipcRenderer } = require('electron');
const DM = require('./src/renderer/dataManager');
const Sim = require('./src/renderer/calculator');
const UI = require('./src/renderer/uiManager');
const Charts = require('./src/renderer/chartManager');
const Utils = require('./src/renderer/utils');
const Battle = require('./src/renderer/battle');

// DOM Elements
const dom = {
    entCont: document.getElementById('entityContainer'),
    itemCont: document.getElementById('itemContainer'),
    maxLevel: document.getElementById('maxLevel'),
    metric: document.getElementById('graphMetric'),
    battleLog: document.getElementById('battleLog'),
    analysisLog: document.getElementById('analysisLog')
};

// ==========================================
// 1. Undo / Redo System (완벽 구현)
// ==========================================
const undoStack = [];
const redoStack = [];

function executeCommand(command) {
    command.execute();
    undoStack.push(command);
    redoStack.length = 0; // 새로운 명령 실행 시 Redo 스택 초기화
}

// [Command] 값 변경
class PropertyChangeCommand {
    constructor(targetObj, key, oldVal, newVal, callback) {
        this.target = targetObj; this.key = key; this.oldVal = oldVal; this.newVal = newVal; this.callback = callback;
    }
    execute() { this.target[this.key] = this.newVal; if(this.callback) this.callback(); }
    undo() { this.target[this.key] = this.oldVal; if(this.callback) this.callback(); }
}

// [Command] 스탯 변경
class StatChangeCommand {
    constructor(statObj, type, oldVal, newVal, callback) {
        this.statObj = statObj; this.type = type; this.oldVal = oldVal; this.newVal = newVal; this.callback = callback;
    }
    execute() { this.statObj[this.type] = this.newVal; if(this.callback) this.callback(); }
    undo() { this.statObj[this.type] = this.oldVal; if(this.callback) this.callback(); }
}

// [Command] 엔티티 관리
class RemoveEntityCommand {
    constructor(index) { this.index = index; this.removedData = null; }
    execute() { this.removedData = DM.getEntities()[this.index]; DM.removeEntity(this.index); refreshAll(); runSimulation(); }
    undo() { DM.getEntities().splice(this.index, 0, this.removedData); refreshAll(); runSimulation(); }
}
class AddEntityCommand {
    constructor(entityData) { this.entityData = entityData; }
    execute() { DM.addEntity(this.entityData); refreshAll(); runSimulation(); }
    undo() { DM.removeEntity(DM.getEntities().length - 1); refreshAll(); runSimulation(); }
}

// [Command] 아이템 관리
class RemoveItemCommand {
    constructor(index) { this.index = index; this.removedData = null; }
    execute() { 
        this.removedData = DM.getItems()[this.index];
        DM.getItems().splice(this.index, 1); 
        refreshAll(); 
        runSimulation(); 
    }
    undo() { 
        DM.getItems().splice(this.index, 0, this.removedData);
        refreshAll(); 
        runSimulation(); 
    }
}
class AddItemCommand {
    constructor(itemData) { this.itemData = itemData; }
    execute() { DM.addItem(this.itemData); refreshAll(); runSimulation(); }
    undo() { DM.getItems().pop(); refreshAll(); runSimulation(); }
}

// [수정] 단축키 이벤트 리스너 (Redo 로직 추가됨)
document.addEventListener('keydown', (e) => {
    // Undo (Ctrl+Z)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (undoStack.length > 0) {
            const cmd = undoStack.pop();
            cmd.undo();
            redoStack.push(cmd); // [버그수정] 스택 전체가 아니라 명령어 하나만 push
            runSimulation();
        }
    }
    // Redo (Ctrl+Y)
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        if (redoStack.length > 0) {
            const cmd = redoStack.pop();
            cmd.execute(); // 다시 실행
            undoStack.push(cmd); // 다시 Undo 스택으로 이동
            runSimulation();
        }
    }
});

// ==========================================
// 2. Core Logic
// ==========================================
function refreshAll() {
    dom.entCont.innerHTML = '';
    dom.itemCont.innerHTML = '';
    
    // Entities
    DM.getEntities().forEach((ent, idx) => {
        UI.renderEntityCard(ent, idx, dom.entCont, {
            onInput: () => runSimulation(),
            onCommit: (key, oldVal, newVal) => { if (oldVal !== newVal) executeCommand(new PropertyChangeCommand(ent, key, oldVal, newVal, runSimulation)); },
            onStatCommit: (statObj, type, oldVal, newVal) => { if (oldVal !== newVal) executeCommand(new StatChangeCommand(statObj, type, oldVal, newVal, runSimulation)); },
            onLock: () => { ent.isLocked = !ent.isLocked; refreshAll(); },
            onDelete: (i) => executeCommand(new RemoveEntityCommand(i))
        });
    });

    // Items
    DM.getItems().forEach((item, idx) => {
        UI.renderItemCard(item, idx, dom.itemCont, {
            onChange: runSimulation,
            onUpdate: () => { refreshAll(); runSimulation(); },
            onDelete: (i) => executeCommand(new RemoveItemCommand(i))
        });
    });
}

function runSimulation() {
    const max = parseInt(dom.maxLevel.value) || 20;
    const metric = dom.metric.value;
    const formula = metric === 'cp' ? DM.getRules().cpFormula : DM.getRules().dmgFormula;
    
    const labels = Array.from({length: max}, (_, i) => `Lv.${i+1}`);
    const datasets = [];
    const rawData = {}; 

    DM.getEntities().forEach(ent => {
        const data = [];
        for(let lv=1; lv<=max; lv++) {
            const stats = Sim.getStatsAtLevel(ent, lv, DM.getItems(), DM.getRules());
            data.push(Sim.calculateValue(formula, stats));
        }
        datasets.push({ label: ent.name, data, borderColor: ent.color, backgroundColor: ent.color+'20', borderWidth:2, tension:0.3 });
        rawData[ent.id] = { name: ent.name, data, color: ent.color };
    });

    Charts.renderMainChart(document.getElementById('balanceChart').getContext('2d'), labels, datasets);
    
    const crossovers = Sim.analyzeCrossovers(rawData, max);
    dom.analysisLog.innerHTML = crossovers.length ? '' : '<div class="log-item placeholder">No crossover points detected.</div>';
    crossovers.forEach(c => {
        dom.analysisLog.innerHTML += `<div class="log-item"><span class="log-level">Lv.${c.lv-1}->${c.lv}</span>: <b style="color:${c.wColor}">${c.winnerName}</b> overtakes <b style="color:${c.lColor}">${c.loserName}</b></div>`;
    });
}

// Config Modal
const configModal = document.getElementById('configModal');
document.getElementById('configBtn').addEventListener('click', () => {
    const rules = DM.getRules();
    document.getElementById('dmgFormula').value = rules.dmgFormula;
    document.getElementById('cpFormula').value = rules.cpFormula;
    document.getElementById('statDefinitions').value = rules.stats.join(',');
    configModal.style.display = 'block';
});
document.querySelector('.close-modal').addEventListener('click', () => configModal.style.display = 'none');
document.getElementById('applyConfigBtn').addEventListener('click', () => {
    const newStats = document.getElementById('statDefinitions').value.split(',').map(s=>s.trim()).filter(s=>s);
    DM.setRules({ stats: newStats, dmgFormula: document.getElementById('dmgFormula').value, cpFormula: document.getElementById('cpFormula').value });
    configModal.style.display = 'none';
    refreshAll(); runSimulation();
});

// Event Listeners
document.getElementById('addBtn').addEventListener('click', () => {
    const color = '#' + Math.floor(Math.random()*16777215).toString(16);
    let stats = {}; DM.getRules().stats.forEach(s => stats[s] = {b:10, g:1});
    const newEnt = { id: Date.now(), name: 'New Unit', color, stats, variance:0, isLocked: false };
    executeCommand(new AddEntityCommand(newEnt));
});

document.getElementById('addItemBtn').addEventListener('click', () => {
    const newItem = { id: Date.now(), name: 'New Item', active: true, targets: DM.getEntities().map(e=>e.id), modifiers: [{stat: DM.getRules().stats[0], op:'add', val:10}] };
    executeCommand(new AddItemCommand(newItem));
});

document.getElementById('calcBtn').addEventListener('click', runSimulation);
dom.metric.addEventListener('change', runSimulation);

['min','max','close'].forEach(a => {
    const btn = document.getElementById(a+'Btn');
    if(btn) btn.addEventListener('click', () => ipcRenderer.send(a+'-app'));
});

ipcRenderer.on('load-finished', (e, data) => {
    if(data.entities) DM.setEntities(data.entities);
    if(data.items) DM.setItems(data.items);
    if(data.gameRules) DM.setRules(data.gameRules);
    if(data.maxLevel) dom.maxLevel.value = data.maxLevel;
    undoStack.length = 0; redoStack.length = 0;
    refreshAll(); runSimulation();
    alert('Project Loaded!');
});

ipcRenderer.on('save-finished', (e, msg) => alert(msg));
ipcRenderer.on('export-finished', (e, msg) => alert(msg));

document.getElementById('saveBtn').addEventListener('click', () => {
    ipcRenderer.send('save-kal', { maxLevel: dom.maxLevel.value, entities: DM.getEntities(), items: DM.getItems(), gameRules: DM.getRules() });
});

document.getElementById('loadBtn').addEventListener('click', () => ipcRenderer.send('load-kal'));
document.getElementById('exportBtn').addEventListener('click', () => {
    let csv = "Level," + DM.getEntities().map(e=>e.name).join(',') + "\n";
    for(let lv=1; lv<=parseInt(dom.maxLevel.value); lv++){
        csv += lv + "," + DM.getEntities().map(e => Sim.calculateValue(DM.getRules().cpFormula, Sim.getStatsAtLevel(e, lv, DM.getItems(), DM.getRules()))).join(',') + "\n";
    }
    ipcRenderer.send('export-csv', csv);
});

// Battle Modal
const battleModal = document.getElementById('battleModal');
document.getElementById('openBattleBtn').addEventListener('click', () => {
    const sA = document.getElementById('battleEntA'), sB = document.getElementById('battleEntB');
    sA.innerHTML = ''; sB.innerHTML = '<option value="all">ALL (League)</option>';
    DM.getEntities().forEach(e => { sA.add(new Option(e.name, e.id)); sB.add(new Option(e.name, e.id)); });
    battleModal.style.display = 'flex';
});
document.querySelector('.close-battle').addEventListener('click', () => battleModal.style.display = 'none');
document.getElementById('runBattleBtn').addEventListener('click', () => {
    const idA = parseInt(document.getElementById('battleEntA').value);
    const entA = DM.getEntities().find(e=>e.id===idA);
    const lv = parseInt(document.getElementById('battleLevel').value);
    const statsA = Sim.getStatsAtLevel(entA, lv, DM.getItems(), DM.getRules());
    const results = [];
    const idB = document.getElementById('battleEntB').value;
    const targets = idB === 'all' ? DM.getEntities().filter(e=>e.id!==idA) : [DM.getEntities().find(e=>e.id==idB)];
    dom.battleLog.innerHTML = 'Running...';
    targets.forEach(entB => {
        const statsB = Sim.getStatsAtLevel(entB, lv, DM.getItems(), DM.getRules());
        results.push(Battle.runBattleBatch(entA, statsA, entB, statsB, parseInt(document.getElementById('battleCount').value), DM.getRules().dmgFormula));
    });
    Charts.renderBattleChart(document.getElementById('battleResultChart').getContext('2d'), results);
    dom.battleLog.innerHTML = results.map(r => `<div>VS ${r.opponentName}: ${r.winRate.toFixed(1)}% Win</div>`).join('');
});

Utils.initResizer(document.getElementById('resizerLeft'), document.getElementById('leftSidebar'), 'left', Charts.resizeCharts);
Utils.initResizer(document.getElementById('resizerRight'), document.getElementById('rightSidebar'), 'right', Charts.resizeCharts);
Utils.initResizer(document.getElementById('resizerVertical'), document.getElementById('analysisPanel'), 'vertical', Charts.resizeCharts);

refreshAll();
runSimulation();