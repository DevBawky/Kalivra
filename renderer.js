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

const originalAlert = window.alert;
const originalConfirm = window.confirm;

window.alert = function(message) {
    originalAlert(message);
    ipcRenderer.send('force-focus');
};

window.confirm = function(message) {
    const result = originalConfirm(message);
    ipcRenderer.send('force-focus');
    return result;
};

function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// 시뮬레이션을 디바운싱 처리
const debouncedSimulation = debounce(() => {
    runSimulation();
}, 200);


// ==========================================
// 1. Undo / Redo System
// ==========================================
const undoStack = [];
const redoStack = [];

function executeCommand(command) {
    command.execute();
    undoStack.push(command);
    redoStack.length = 0;
}

// Command Classes
class PropertyChangeCommand { constructor(t,k,o,n,cb){this.t=t;this.k=k;this.o=o;this.n=n;this.cb=cb;} execute(){this.t[this.k]=this.n;if(this.cb)this.cb();} undo(){this.t[this.k]=this.o;if(this.cb)this.cb();} }
class StatChangeCommand { constructor(s,t,o,n,cb){this.s=s;this.t=t;this.o=o;this.n=n;this.cb=cb;} execute(){this.s[this.t]=this.n;if(this.cb)this.cb();} undo(){this.s[this.t]=this.o;if(this.cb)this.cb();} }
class ItemModChangeCommand { constructor(m,k,o,n,cb){this.m=m;this.k=k;this.o=o;this.n=n;this.cb=cb;} execute(){this.m[this.k]=this.n;if(this.cb)this.cb();} undo(){this.m[this.k]=this.o;if(this.cb)this.cb();} }
class AddItemModCommand { constructor(i,d,cb){this.i=i;this.d=d;this.cb=cb;} execute(){this.i.modifiers.push(this.d);if(this.cb)this.cb();} undo(){this.i.modifiers.pop();if(this.cb)this.cb();} }
class RemoveItemModCommand { constructor(i,idx,cb){this.i=i;this.idx=idx;this.rm=null;this.cb=cb;} execute(){this.rm=this.i.modifiers[this.idx];this.i.modifiers.splice(this.idx,1);if(this.cb)this.cb();} undo(){this.i.modifiers.splice(this.idx,0,this.rm);if(this.cb)this.cb();} }
class RemoveEntityCommand { constructor(i){this.i=i;this.rm=null;} execute(){this.rm=DM.getEntities()[this.i];DM.removeEntity(this.i);refreshAll();runSimulation();} undo(){DM.getEntities().splice(this.i,0,this.rm);refreshAll();runSimulation();} }
class AddEntityCommand { constructor(d){this.d=d;} execute(){DM.addEntity(this.d);refreshAll();runSimulation();} undo(){DM.removeEntity(DM.getEntities().length-1);refreshAll();runSimulation();} }
class RemoveItemCommand { constructor(i){this.i=i;this.rm=null;} execute(){this.rm=DM.getItems()[this.i];DM.getItems().splice(this.i,1);refreshAll();runSimulation();} undo(){DM.getItems().splice(this.i,0,this.rm);refreshAll();runSimulation();} }
class AddItemCommand { constructor(d){this.d=d;} execute(){DM.addItem(this.d);refreshAll();runSimulation();} undo(){DM.getItems().pop();refreshAll();runSimulation();} }

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { if (undoStack.length > 0) { const cmd = undoStack.pop(); cmd.undo(); redoStack.push(cmd); } }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') { if (redoStack.length > 0) { const cmd = redoStack.pop(); cmd.execute(); undoStack.push(cmd); } }
});

// ==========================================
// 2. Core Logic
// ==========================================
function refreshAll() {
    dom.entCont.innerHTML = '';
    dom.itemCont.innerHTML = '';
    
    const updateUI = () => { refreshAll(); runSimulation(); };

    // Entities
    DM.getEntities().forEach((ent, idx) => {
        UI.renderEntityCard(ent, idx, dom.entCont, {
            onInput: () => debouncedSimulation(),
            onCommit: (key, oldVal, newVal) => { if(oldVal!==newVal) executeCommand(new PropertyChangeCommand(ent, key, oldVal, newVal, updateUI)); },
            onStatCommit: (statObj, type, oldVal, newVal) => { if(oldVal!==newVal) executeCommand(new StatChangeCommand(statObj, type, oldVal, newVal, updateUI)); },
            onLock: () => { ent.isLocked = !ent.isLocked; refreshAll(); },
            onDelete: (i) => executeCommand(new RemoveEntityCommand(i))
        });
    });

    // Items
    DM.getItems().forEach((item, idx) => {
        UI.renderItemCard(item, idx, dom.itemCont, {
            onChange: () => runSimulation(),
            onInput: () => debouncedSimulation(),
            onUpdate: updateUI,
            onNameCommit: (oldVal, newVal) => { if(oldVal !== newVal) executeCommand(new PropertyChangeCommand(item, 'name', oldVal, newVal, updateUI)); },
            onDelete: (i) => executeCommand(new RemoveItemCommand(i)),
            onModAdd: () => { const newMod = {stat: DM.getRules().stats[0], op:'add', val:0}; executeCommand(new AddItemModCommand(item, newMod, updateUI)); },
            onModDelete: (modIdx) => { executeCommand(new RemoveItemModCommand(item, modIdx, updateUI)); },
            onModCommit: (mod, key, oldVal, newVal) => { if(oldVal !== newVal) executeCommand(new ItemModChangeCommand(mod, key, oldVal, newVal, updateUI)); }
        });
    });
}

function runSimulation() {
    const max = parseInt(dom.maxLevel.value) || 20;
    const metric = dom.metric.value;
    const rules = DM.getRules();
    const formula = metric === 'cp' ? rules.cpFormula : rules.dmgFormula;
    
    const validCheck = Sim.validateFormula(formula, rules.stats);
    if (!validCheck.valid) {
        // formula가 틀렸을 때의 처리는 focusout 이벤트 리스너가 담당하므로 여기선 return
        return; 
    }

    const labels = Array.from({length: max}, (_, i) => `Lv.${i+1}`);
    const datasets = [];
    const rawData = {}; 

    DM.getEntities().forEach(ent => {
        const data = [];
        for(let lv=1; lv<=max; lv++) {
            const stats = Sim.getStatsAtLevel(ent, lv, DM.getItems(), rules);
            data.push(Sim.calculateValue(formula, stats));
        }
        datasets.push({ label: ent.name, data, borderColor: ent.color, backgroundColor: ent.color+'20', borderWidth:2, tension:0.3 });
        rawData[ent.id] = { name: ent.name, data, color: ent.color };
    });

    if (Charts && Charts.renderMainChart) {
        const ctx = document.getElementById('balanceChart').getContext('2d');
        Charts.renderMainChart(ctx, labels, datasets);
    }
    
    const crossovers = Sim.analyzeCrossovers(rawData, max);
    dom.analysisLog.innerHTML = crossovers.length ? '' : '<div class="log-item placeholder">No crossover points detected.</div>';
    crossovers.forEach(c => {
        dom.analysisLog.innerHTML += `<div class="log-item"><span class="log-level">Lv.${c.lv-1}->${c.lv}</span>: <b style="color:${c.wColor}">${c.winnerName}</b> overtakes <b style="color:${c.lColor}">${c.loserName}</b></div>`;
    });
}

// ==========================================
// 3. Config & Meta Info & Snapshots
// ==========================================
const configModal = document.getElementById('configModal');
document.getElementById('configBtn').addEventListener('click', () => {
    const rules = DM.getRules();
    const meta = DM.getMeta();
    document.getElementById('metaProjectName').value = meta.projectName || '';
    document.getElementById('metaAuthor').value = meta.author || '';
    document.getElementById('metaDesc').value = meta.description || '';
    document.getElementById('dmgFormula').value = rules.dmgFormula;
    document.getElementById('cpFormula').value = rules.cpFormula;
    document.getElementById('statDefinitions').value = rules.stats.join(', ');
    
    let descText = "";
    if (rules.descriptions) descText = Object.entries(rules.descriptions).map(([k, v]) => `${k}: ${v}`).join('\n');
    document.getElementById('statDescInput').value = descText;

    document.getElementById('dmgFormula').classList.remove('input-error');
    document.getElementById('cpFormula').classList.remove('input-error');
    configModal.style.display = 'block';
});
document.querySelector('.close-modal').addEventListener('click', () => configModal.style.display = 'none');


document.getElementById('applyConfigBtn').addEventListener('click', () => {
    const dmgInput = document.getElementById('dmgFormula');
    const cpInput = document.getElementById('cpFormula');
    const statInput = document.getElementById('statDefinitions');

    const rawStats = statInput.value;
    const newStats = rawStats.split(',').map(s => s.trim()).filter(s => s.length > 0);

    const showError = (msg, targetInput) => {
        alert(msg);
        ipcRenderer.send('force-focus'); 
        setTimeout(() => { if(targetInput) targetInput.focus(); }, 50);
    };

    if (newStats.length === 0) { cpInput.classList.add('input-error');  return; }

    const dmgCheck = Sim.validateFormula(dmgInput.value, newStats);
    if (!dmgCheck.valid) { 
        dmgInput.classList.add('input-error'); 
        return; 
    } else { 
        dmgInput.classList.remove('input-error'); 
    }

    const cpCheck = Sim.validateFormula(cpInput.value, newStats);
    if (!cpCheck.valid) { 
        cpInput.classList.add('input-error'); 
        return; 
    } else { 
        cpInput.classList.remove('input-error'); 
    }

    const rawDesc = document.getElementById('statDescInput').value;
    const descriptions = {};
    rawDesc.split('\n').forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) descriptions[parts[0].trim()] = parts.slice(1).join(':').trim();
    });

    DM.setMeta({ projectName: document.getElementById('metaProjectName').value, author: document.getElementById('metaAuthor').value, description: document.getElementById('metaDesc').value });
    DM.setRules({ stats: newStats, descriptions: descriptions, dmgFormula: dmgInput.value, cpFormula: cpInput.value });
    DM.getEntities().forEach(ent => { newStats.forEach(stat => { if (!ent.stats[stat]) ent.stats[stat] = { b: 0, g: 0 }; }); });

    configModal.style.display = 'none';
    refreshAll(); 
    runSimulation();
});

const snapshotModal = document.getElementById('snapshotModal');
const snapshotListCont = document.getElementById('snapshotListContainer');
function renderSnapshots() {
    const snapshots = DM.getSnapshots();
    snapshotListCont.innerHTML = '';
    if (snapshots.length === 0) { snapshotListCont.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No snapshots saved.</div>'; return; }
    snapshots.forEach((snap, idx) => {
        const item = document.createElement('div');
        item.className = 'snapshot-item';
        const dateStr = new Date(snap.date).toLocaleString();
        item.innerHTML = `<div class="snapshot-info"><span class="snapshot-name">${snap.name}</span><span class="snapshot-date">${dateStr}</span></div><div class="snapshot-actions"><button class="load-btn" data-idx="${idx}">Load</button><button class="del-btn" data-idx="${idx}">✕</button></div>`;
        item.querySelector('.load-btn').addEventListener('click', (e) => { 
            e.stopPropagation(); 
            if(confirm(`Load snapshot "${snap.name}"?`)) { 
                DM.loadSnapshot(idx); 
                undoStack.length=0; 
                redoStack.length=0; 
                refreshAll(); 
                runSimulation(); 
                snapshotModal.style.display='none'; 
                setTimeout(() => window.focus(), 50);
            } 
            else{
                setTimeout(() => window.focus(), 50);
            }
        });
        item.querySelector('.del-btn').addEventListener('click', (e) => { 
            e.stopPropagation(); 
            if(confirm('Delete snapshot?')) { 
                DM.deleteSnapshot(idx); 
                renderSnapshots(); 
                setTimeout(() => window.focus(), 50);
            } else {
                setTimeout(() => window.focus(), 50);
            }
        });
        snapshotListCont.appendChild(item);
    });
}
document.getElementById('snapshotBtn').addEventListener('click', () => { renderSnapshots(); snapshotModal.style.display = 'block'; });
document.querySelector('.close-snapshot').addEventListener('click', () => snapshotModal.style.display = 'none');
document.getElementById('createSnapshotBtn').addEventListener('click', () => { const name = document.getElementById('newSnapshotName').value.trim(); DM.createSnapshot(name); document.getElementById('newSnapshotName').value=''; renderSnapshots(); });

document.getElementById('saveBtn').addEventListener('click', () => ipcRenderer.send('save-kal', DM.getProjectData()));
document.getElementById('loadBtn').addEventListener('click', () => ipcRenderer.send('load-kal'));
document.getElementById('exportBtn').addEventListener('click', () => {
    let csv = "Level," + DM.getEntities().map(e=>e.name).join(',') + "\n";
    for(let lv=1; lv<=parseInt(dom.maxLevel.value); lv++){
        csv += lv + "," + DM.getEntities().map(e => Sim.calculateValue(DM.getRules().cpFormula, Sim.getStatsAtLevel(e, lv, DM.getItems(), DM.getRules()))).join(',') + "\n";
    }
    ipcRenderer.send('export-csv', csv);
});

ipcRenderer.on('load-finished', (e, data) => {
    DM.loadProject(data);
    undoStack.length = 0; 
    redoStack.length = 0;
    const meta = DM.getMeta();
    if(meta.projectName) document.title = `Kalivra - ${meta.projectName}`;
    refreshAll(); 
    runSimulation();
    console.log(`Project Loaded: ${meta.projectName || 'Untitled'}`);
    setTimeout(() => {
        window.focus();
        const focusTarget = document.querySelector('input, select, textarea');
        if (focusTarget) {
            focusTarget.focus();
            if (focusTarget.type === 'text' || focusTarget.type === 'number') {
                focusTarget.select(); 
            }
        }
    }, 100);
});
ipcRenderer.on('save-finished', (e, msg) => {
    alert(msg);
    setTimeout(() => window.focus(), 50);
});

ipcRenderer.on('export-finished', (e, msg) => {
    alert(msg);
    setTimeout(() => window.focus(), 50);
});

document.getElementById('calcBtn').addEventListener('click', runSimulation);
dom.metric.addEventListener('change', runSimulation);
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
['min','max','close'].forEach(a => { const btn = document.getElementById(a+'Btn'); if(btn) btn.addEventListener('click', () => ipcRenderer.send(a+'-app')); });

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

// ==========================================
// [NEW] 4. Global Input Validation with Red Title
// ==========================================
// 모든 텍스트 입력창에서 포커스가 빠져나갈 때(blur/focusout) 수식을 검증하고
// 오류 시 타이틀 텍스트를 빨갛게 변경합니다.

document.body.addEventListener('focusout', (e) => {
    const target = e.target;
    
    // 텍스트나 숫자 인풋만 대상 (컬러피커 등 제외)
    if (target.tagName === 'INPUT' && (target.type === 'text' || target.type === 'number')) {
        const val = target.value;
        if (!val) return; // 빈 값은 패스

        try {
            // 간단한 문법 체크 (변수명은 모두 1로 치환해서 문법 오류만 잡음)
            // ex: "10 + *" -> Syntax Error 발생
            const testFormula = val.replace(/[a-zA-Z_]\w*/g, '1');
            new Function('return ' + testFormula);
        } catch (err) {
            flashErrorOnLabel(target);
        }
    }
});

function flashErrorOnLabel(inputElement) {
    // 1. 인풋 바로 위의 형제(previousSibling)가 라벨인지 확인
    let label = inputElement.previousElementSibling;
    
    // 2. 아니면 부모의 첫번째 라벨을 찾음
    if (!label || label.tagName !== 'LABEL') {
        const parent = inputElement.parentElement;
        if (parent) label = parent.querySelector('label');
    }

    if (label) {
        // 원래 텍스트 저장 (data 속성 활용)
        const originalText = label.getAttribute('data-original-text') || label.innerText;
        if (!label.getAttribute('data-original-text')) {
            label.setAttribute('data-original-text', originalText);
        }

        // 에러 표시
        label.innerText = "⚠ ERR";
        label.classList.add('label-error'); // components.css에 정의됨

        // 2초 후 복구
        setTimeout(() => {
            label.innerText = originalText;
            label.classList.remove('label-error');
        }, 2000);
    }
}

// 초기 실행
refreshAll();
runSimulation();