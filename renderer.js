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
    battleStatList: document.getElementById('battleStatList'),
    analysisLog: document.getElementById('analysisLog')
};

// --- Window Controls & Utilities ---
const originalAlert = window.alert;
window.alert = function(message) { originalAlert(message); ipcRenderer.send('force-focus'); };
const originalConfirm = window.confirm;
window.confirm = function(message) { const result = originalConfirm(message); ipcRenderer.send('force-focus'); return result; };

function debounce(func, timeout = 300) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => { func.apply(this, args); }, timeout); };
}

const debouncedSimulation = debounce(() => { runSimulation(); }, 200);

// ==========================================
// 1. Undo / Redo System & Commands
// ==========================================
const undoStack = []; const redoStack = [];
function executeCommand(command) { command.execute(); undoStack.push(command); redoStack.length = 0; }

class PropertyChangeCommand { constructor(t,k,o,n,cb){this.t=t;this.k=k;this.o=o;this.n=n;this.cb=cb;} execute(){this.t[this.k]=this.n;if(this.cb)this.cb();} undo(){this.t[this.k]=this.o;if(this.cb)this.cb();} }
class StatChangeCommand { constructor(s,t,o,n,cb){this.s=s;this.t=t;this.o=o;this.n=n;this.cb=cb;} execute(){this.s[this.t]=this.n;if(this.cb)this.cb();} undo(){this.s[this.t]=this.o;if(this.cb)this.cb();} }
class ItemModChangeCommand { constructor(m,k,o,n,cb){this.m=m;this.k=k;this.o=o;this.n=n;this.cb=cb;} execute(){this.m[this.k]=this.n;if(this.cb)this.cb();} undo(){this.m[this.k]=this.o;if(this.cb)this.cb();} }
class AddItemModCommand { constructor(i,d,cb){this.i=i;this.d=d;this.cb=cb;} execute(){this.i.modifiers.push(this.d);if(this.cb)this.cb();} undo(){this.i.modifiers.pop();if(this.cb)this.cb();} }
class RemoveItemModCommand { constructor(i,idx,cb){this.i=i;this.idx=idx;this.rm=null;this.cb=cb;} execute(){this.rm=this.i.modifiers[this.idx];this.i.modifiers.splice(this.idx,1);if(this.cb)this.cb();} undo(){this.i.modifiers.splice(this.idx,0,this.rm);if(this.cb)this.cb();} }
class RemoveEntityCommand { constructor(i){this.i=i;this.rm=null;} execute(){this.rm=DM.getEntities()[this.i];DM.removeEntity(this.i);refreshAll();runSimulation();} undo(){DM.getEntities().splice(this.i,0,this.rm);refreshAll();runSimulation();} }
class AddEntityCommand { constructor(d){this.d=d;} execute(){DM.addEntity(this.d);refreshAll();runSimulation();} undo(){DM.removeEntity(DM.getEntities().length-1);refreshAll();runSimulation();} }
class RemoveItemCommand { constructor(i){this.i=i;this.rm=null;} execute(){this.rm=DM.getItems()[this.i];DM.getItems().splice(this.i,1);refreshAll();runSimulation();} undo(){DM.getItems().splice(this.i,0,this.rm);refreshAll();runSimulation();} }
class AddItemCommand { constructor(d){this.d=d;} execute(){DM.addItem(this.d);refreshAll();runSimulation();} undo(){DM.getItems().pop();refreshAll();runSimulation();} }

// [FIXED] 누락되었던 키보드 이벤트 리스너 복구
document.addEventListener('keydown', (e) => {
    // Ctrl+Z (Undo)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { 
        if (undoStack.length > 0) { 
            const cmd = undoStack.pop(); 
            cmd.undo(); 
            redoStack.push(cmd); 
        } 
    }
    // Ctrl+Y (Redo)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { 
        if (redoStack.length > 0) { 
            const cmd = redoStack.pop(); 
            cmd.execute(); 
            undoStack.push(cmd); 
        } 
    }
});

// ==========================================
// 2. Core Logic
// ==========================================
function refreshAll() {
    dom.entCont.innerHTML = ''; dom.itemCont.innerHTML = '';
    const updateUI = () => { refreshAll(); runSimulation(); };
    DM.getEntities().forEach((ent, idx) => {
        UI.renderEntityCard(ent, idx, dom.entCont, {
            onInput: () => debouncedSimulation(),
            onCommit: (key, oldVal, newVal) => { if(oldVal!==newVal) executeCommand(new PropertyChangeCommand(ent, key, oldVal, newVal, updateUI)); },
            onStatCommit: (statObj, type, oldVal, newVal) => { if(oldVal!==newVal) executeCommand(new StatChangeCommand(statObj, type, oldVal, newVal, updateUI)); },
            onLock: () => { ent.isLocked = !ent.isLocked; refreshAll(); },
            onDelete: (i) => executeCommand(new RemoveEntityCommand(i))
        });
    });
    DM.getItems().forEach((item, idx) => {
        UI.renderItemCard(item, idx, dom.itemCont, {
            onChange: () => runSimulation(),
            onInput: () => debouncedSimulation(),
            onUpdate: updateUI,
            onNameCommit: (oldVal, newVal) => { if(oldVal !== newVal) executeCommand(new PropertyChangeCommand(item, 'name', oldVal, newVal, updateUI)); },
            onDelete: (i) => executeCommand(new RemoveItemCommand(i)),
            onModAdd: () => { executeCommand(new AddItemModCommand(item, { stat: DM.getRules().stats[0], op:'add', val:0, when: "" }, updateUI)); },
            onModDelete: (modIdx) => { executeCommand(new RemoveItemModCommand(item, modIdx, updateUI)); },
            onModCommit: (mod, key, oldVal, newVal) => { if(oldVal !== newVal) executeCommand(new ItemModChangeCommand(mod, key, oldVal, newVal, updateUI)); }
        });
    });
}

function runSimulation() {
    const max = parseInt(dom.maxLevel.value) || 20;
    const metric = dom.metric.value;
    const rules = DM.getRules();
    
    // 1. 공식 선택
    const formula = metric === 'cp' ? rules.cpFormula : rules.dmgFormula;
    
    const validCheck = Sim.validateFormula(formula, rules.stats);
    // if (!validCheck.valid) return;

    const labels = Array.from({length: max}, (_, i) => `Lv.${i+1}`);
    const datasets = []; 
    const rawData = {}; 

    const dummyTarget = {};
    if (rules.stats) {
        rules.stats.forEach(s => dummyTarget[s] = 0);
    }

    DM.getEntities().forEach(ent => {
        const data = [];
        for(let lv=1; lv<=max; lv++) {
            // 해당 레벨의 스탯 가져오기
            const stats = Sim.getStatsAtLevel(ent, lv, DM.getItems(), rules);
            
            let calculatedVal = 0;
            try {
                if (metric === 'cp') {
                    calculatedVal = Sim.calculateValue(formula, stats);
                } else {
                    calculatedVal = Sim.calculateValue(formula, { a: stats, b: dummyTarget });
                }
            } catch (err) {
                console.warn(`Calculation error at Lv.${lv}:`, err.message);
                calculatedVal = 0;
            }
            
            data.push(calculatedVal);
        }
        
        datasets.push({ 
            label: ent.name, 
            data, 
            borderColor: ent.color, 
            backgroundColor: ent.color+'20', 
            borderWidth:2, 
            tension:0.3 
        });
        rawData[ent.id] = { name: ent.name, data, color: ent.color };
    });

    if (Charts && Charts.renderMainChart) {
        Charts.renderMainChart(document.getElementById('balanceChart').getContext('2d'), labels, datasets);
    }
    
    const crossovers = Sim.analyzeCrossovers(rawData, max);
    dom.analysisLog.innerHTML = crossovers.length ? '' : '<div class="log-item placeholder">No crossover points detected.</div>';
    crossovers.forEach(c => { 
        dom.analysisLog.innerHTML += `<div class="log-item"><span class="log-level">Lv.${c.lv-1}->${c.lv}</span>: <b style="color:${c.wColor}">${c.winnerName}</b> overtakes <b style="color:${c.lColor}">${c.loserName}</b></div>`; 
    });
}

// ==========================================
// 3. Config, Snapshots
// ==========================================
const configModal = document.getElementById('configModal');
document.getElementById('configBtn').addEventListener('click', () => {
    const rules = DM.getRules(); const meta = DM.getMeta();
    document.getElementById('metaProjectName').value = meta.projectName || '';
    document.getElementById('metaAuthor').value = meta.author || '';
    document.getElementById('metaDesc').value = meta.description || '';
    document.getElementById('dmgFormula').value = rules.dmgFormula;
    document.getElementById('cpFormula').value = rules.cpFormula;
    document.getElementById('statDefinitions').value = rules.stats.join(', ');
    let descText = ""; if (rules.descriptions) descText = Object.entries(rules.descriptions).map(([k, v]) => `${k}: ${v}`).join('\n');
    document.getElementById('statDescInput').value = descText;
    document.getElementById('dmgFormula').classList.remove('input-error'); document.getElementById('cpFormula').classList.remove('input-error');
    configModal.style.display = 'block';
});
document.querySelector('.close-modal').addEventListener('click', () => configModal.style.display = 'none');
document.getElementById('applyConfigBtn').addEventListener('click', () => {
    const dmgInput = document.getElementById('dmgFormula');
    const cpInput = document.getElementById('cpFormula');
    const statInput = document.getElementById('statDefinitions');
    
    const newStats = statInput.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (newStats.length === 0) { cpInput.classList.add('input-error'); return; }

    const dmgCheck = Sim.validateFormula(dmgInput.value, newStats);
    if (!dmgCheck.valid) { 
        dmgInput.classList.add('input-error'); 
        // return;
        console.warn("데미지 수식 경고: " + dmgCheck.error);
    } else { 
        dmgInput.classList.remove('input-error'); 
    }

    // 3. 전투력 공식 검사
    const cpCheck = Sim.validateFormula(cpInput.value, newStats);
    if (!cpCheck.valid) { 
        cpInput.classList.add('input-error'); 
        // return;
        console.warn("전투력 수식 경고: " + cpCheck.error);
    } else { 
        cpInput.classList.remove('input-error'); 
    }

    const rawDesc = document.getElementById('statDescInput').value; 
    const descriptions = {};
    rawDesc.split('\n').forEach(line => { const parts = line.split(':'); if (parts.length >= 2) descriptions[parts[0].trim()] = parts.slice(1).join(':').trim(); });
    
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
        item.querySelector('.load-btn').addEventListener('click', (e) => { e.stopPropagation(); if(confirm(`Load snapshot "${snap.name}"?`)) { DM.loadSnapshot(idx); undoStack.length=0; redoStack.length=0; refreshAll(); runSimulation(); snapshotModal.style.display='none'; setTimeout(() => window.focus(), 50); } else { setTimeout(() => window.focus(), 50); } });
        item.querySelector('.del-btn').addEventListener('click', (e) => { e.stopPropagation(); if(confirm('Delete snapshot?')) { DM.deleteSnapshot(idx); renderSnapshots(); setTimeout(() => window.focus(), 50); } else { setTimeout(() => window.focus(), 50); } });
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
    for(let lv=1; lv<=parseInt(dom.maxLevel.value); lv++){ csv += lv + "," + DM.getEntities().map(e => Sim.calculateValue(DM.getRules().cpFormula, Sim.getStatsAtLevel(e, lv, DM.getItems(), DM.getRules()))).join(',') + "\n"; }
    ipcRenderer.send('export-csv', csv);
});
ipcRenderer.on('load-finished', (e, data) => { DM.loadProject(data); undoStack.length=0; redoStack.length=0; refreshAll(); runSimulation(); });
ipcRenderer.on('save-finished', (e, msg) => alert(msg));
ipcRenderer.on('export-finished', (e, msg) => alert(msg));
document.getElementById('calcBtn').addEventListener('click', runSimulation);
dom.metric.addEventListener('change', runSimulation);
document.getElementById('addBtn').addEventListener('click', () => { const color = '#' + Math.floor(Math.random()*16777215).toString(16); executeCommand(new AddEntityCommand({ id: Date.now(), name: 'New Unit', color, stats:{}, variance:0, isLocked: false })); });
document.getElementById('addItemBtn').addEventListener('click', () => { executeCommand(new AddItemCommand({ id: Date.now(), name: 'New Item', active: true, targets: DM.getEntities().map(e=>e.id), modifiers: [{ stat: DM.getRules().stats[0], op: "add", val: 10, when: "" }], traits: [] })); });
['min','max','close'].forEach(a => { const btn = document.getElementById(a+'Btn'); if(btn) btn.addEventListener('click', () => ipcRenderer.send(a+'-app')); });
document.body.addEventListener('focusout', (e) => {
    const target = e.target;
    if (target.tagName === 'INPUT' && (target.type === 'text' || target.type === 'number')) {
        const val = target.value; if (!val) return;
        try { new Function('return ' + val.replace(/[a-zA-Z_]\w*/g, '1')); } catch (err) { flashErrorOnLabel(target); }
    }
});
function flashErrorOnLabel(inputElement) {
    let label = inputElement.previousElementSibling; if (!label || label.tagName !== 'LABEL') { const parent = inputElement.parentElement; if (parent) label = parent.querySelector('label'); }
    if (label) { const originalText = label.getAttribute('data-original-text') || label.innerText; if (!label.getAttribute('data-original-text')) label.setAttribute('data-original-text', originalText); label.innerText = "⚠ ERR"; label.classList.add('label-error'); setTimeout(() => { label.innerText = originalText; label.classList.remove('label-error'); }, 2000); }
}


// ==========================================
// 4. Battle Logic & Log Navigation
// ==========================================
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
    const entA = DM.getEntities().find(e => e.id === idA);
    const lv = parseInt(document.getElementById('battleLevel').value);
    
    if (!entA) return alert("Select Attacker!");
    
    // 1. 기본 스탯 계산
    let statsA;
    try { statsA = Sim.getStatsAtLevel(entA, lv, DM.getItems(), DM.getRules()); } catch (e) { return alert("Error statsA: " + e.message); }

    // ▼ [추가/수정] A의 특성(Traits) 병합하기 (본인 특성 + 착용 아이템 특성)
    const activeItemsA = DM.getItems().filter(i => i.active && i.targets.includes(entA.id));
    const itemTraitsA = activeItemsA.flatMap(i => i.traits || []);
    // 원본 훼손 방지를 위해 새로운 객체 생성
    const battleEntA = { 
        ...entA, 
        traits: [...(entA.traits || []), ...itemTraitsA] 
    };

    const results = [];
    const idB = document.getElementById('battleEntB').value;
    
    let targets = [];
    if (idB === 'all') targets = DM.getEntities().filter(e => e.id !== idA);
    else { const t = DM.getEntities().find(e => e.id == parseInt(idB)); if (t) targets.push(t); }
    if (targets.length === 0) return alert("Target not found");

    dom.battleLog.innerHTML = '<div style="padding:10px; text-align:center; color:#fee75c;">Simulating...</div>';
    dom.battleStatList.innerHTML = '';

    setTimeout(() => {
        try {
            let allBattleResults = [];

            targets.forEach(entB => {
                const statsB = Sim.getStatsAtLevel(entB, lv, DM.getItems(), DM.getRules());
                
                // ▼ [추가/수정] B도 똑같이 특성 병합
                const activeItemsB = DM.getItems().filter(i => i.active && i.targets.includes(entB.id));
                const itemTraitsB = activeItemsB.flatMap(i => i.traits || []);
                const battleEntB = { 
                    ...entB, 
                    traits: [...(entB.traits || []), ...itemTraitsB] 
                };

                // ▼ 수정된 battleEntA, battleEntB를 전달
                const batchResult = Battle.runBattleBatch(
                    battleEntA, statsA, battleEntB, statsB, 
                    parseInt(document.getElementById('battleCount').value), 
                    DM.getRules().dmgFormula
                );
                
                results.push(batchResult);
                allBattleResults.push({ opponent: entB, statsB: statsB, result: batchResult });
            });

            // (이하 차트/로그 렌더링 코드는 동일)
            Charts.renderBattleChart(document.getElementById('battleResultChart').getContext('2d'), results);
            renderBattleLog(allBattleResults, entA.name);
            document.getElementById('statDisplayLevel').innerText = lv;
            renderBattleStats(entA, statsA, allBattleResults);

        } catch (err) {
            console.error(err);
            dom.battleLog.innerHTML = `<div style="padding:10px; color:#ff5555;">⛔ Error: ${err.message}</div>`;
        }
    }, 50);
});

// [UPDATED] Log Renderer with Navigation & Numeric Avg Turns
function renderBattleLog(allResults, heroName) {
    if (!allResults || allResults.length === 0) return;

    dom.battleLog.innerHTML = '';
    
    // 안내 문구 (최대 100판 제한 알림)
    const countVal = parseInt(document.getElementById('battleCount').value);
    
    allResults.forEach((item, index) => {
        const { opponent, result } = item;
        const allLogs = result.allLogs || [];
        const winRate = result.winRate.toFixed(1);
        const avgTurns = result.avgTurns.toFixed(1); // [NEW] 숫자만 표시
        const isWin = result.winRate >= 50;
        const tagClass = isWin ? 'tag-win' : 'tag-lose';
        
        // 1. Log Group Container
        const group = document.createElement('div');
        group.className = 'log-group';
        
        // 2. Header
        const header = document.createElement('div');
        header.className = 'log-header';
        // [NEW] Avg Turns explicitly shown
        header.innerHTML = `
            <span>VS ${opponent.name}</span>
            <div style="display:flex; gap:10px; align-items:center;">
                <span style="font-size:0.8em; color:#ccc;">Avg Turns: <span style="color:#fee75c;">${avgTurns}</span></span>
                <span class="win-tag ${tagClass}">Win ${winRate}%</span>
            </div>
        `;
        
        // 3. Content Area
        const content = document.createElement('div');
        content.className = 'log-content';
        
        // 내부: 네비게이션 + 로그 텍스트 영역
        const navContainer = document.createElement('div');
        navContainer.style.display = 'flex';
        navContainer.style.justifyContent = 'space-between';
        navContainer.style.alignItems = 'center';
        navContainer.style.marginBottom = '10px';
        navContainer.style.paddingBottom = '10px';
        navContainer.style.borderBottom = '1px solid #3e3e42';

        const logTextBox = document.createElement('div');
        logTextBox.className = 'log-text-box';
        
        let currentLogIdx = 0; // 현재 보고 있는 로그 인덱스

        // 로그 렌더링 함수 (내부 클로저)
        const updateLogDisplay = () => {
            const logs = allLogs[currentLogIdx];
            navContainer.innerHTML = `
                <button class="nav-btn prev-log-btn" style="background:none; border:none; color:#ccc; cursor:pointer; font-weight:bold;">◀</button>
                <span style="font-size:0.9em; font-weight:bold; color:#5fabff;">Battle ${currentLogIdx + 1} / ${allLogs.length}</span>
                <button class="nav-btn next-log-btn" style="background:none; border:none; color:#ccc; cursor:pointer; font-weight:bold;">▶</button>
            `;

            // 버튼 이벤트 연결 (innerHTML로 덮어쓰므로 매번 재연결)
            navContainer.querySelector('.prev-log-btn').onclick = (e) => {
                e.stopPropagation();
                currentLogIdx = (currentLogIdx - 1 + allLogs.length) % allLogs.length; // Loop back
                updateLogDisplay();
            };
            navContainer.querySelector('.next-log-btn').onclick = (e) => {
                e.stopPropagation();
                currentLogIdx = (currentLogIdx + 1) % allLogs.length; // Loop forward
                updateLogDisplay();
            };

            // 로그 텍스트 생성
            if (logs && logs.length > 0) {
                let html = '';
                let currentTurn = 0;
                logs.forEach(log => {
                    if (log.turn !== currentTurn) { 
                        currentTurn = log.turn; 
                        html += `<div class="log-turn-divider">Turn ${currentTurn}</div>`; 
                    }
                    const isHero = (log.actor === heroName);
                    const actorClass = isHero ? 'log-actor-hero' : 'log-actor-enemy';
                    const valClass = log.action === 'attack' ? 'log-val-dmg' : 'log-val-heal';
                    
                    let msg = '';
                    if (log.action === 'attack') {
                        msg = `<span class="${actorClass}">${log.actor}</span> <span style="color:#aaa;">attacked</span> <span class="log-target">${log.target}</span> → <span class="${valClass}">-${log.val} HP</span>`;
                    } else if (log.action === 'die') {
                        msg = `<span class="${actorClass}">${log.actor}</span> <span style="color:#888;">${log.msg}</span>`;
                    } else if (log.action === 'miss') {
                        msg = `<span class="${actorClass}">${log.actor}</span>: <span style="color:#aaa;">Missed!</span>`;
                    } else {
                        msg = `<span class="${actorClass}">${log.actor}</span>: ${log.msg}`;
                    }
                    html += `<div class="log-item-detail">${msg}</div>`;
                });
                html += `<div class="log-footer">Simulation End</div>`;
                logTextBox.innerHTML = html;
            } else {
                logTextBox.innerHTML = '<div style="color:#666; text-align:center;">No log data available</div>';
            }
        };

        if (allLogs.length > 0) {
            content.appendChild(navContainer);
            content.appendChild(logTextBox);
            updateLogDisplay(); // 초기 실행
        } else {
            content.innerHTML = '<div style="color:#666; text-align:center; padding:10px;">Logs disabled for huge counts</div>';
        }

        // 4. Toggle Event
        header.addEventListener('click', () => { content.classList.toggle('open'); });
        group.appendChild(header);
        group.appendChild(content);
        dom.battleLog.appendChild(group);

        if (index === 0) content.classList.add('open');
    });
}

function renderBattleStats(attacker, statsA, allResults) {
    const container = dom.battleStatList;
    const createCard = (name, color, stats) => {
        let rows = '';
        for (const [key, val] of Object.entries(stats)) {
            if (typeof val === 'number') {
                const displayVal = Number.isInteger(val) ? val : val.toFixed(2);
                rows += `<div class="stat-row"><span class="stat-name">${key.toUpperCase()}</span><span class="stat-val">${displayVal}</span></div>`;
            }
        }
        return `<div class="stat-card" style="border-left-color: ${color}"><div class="stat-card-header">${name}</div><div class="stat-grid">${rows}</div></div>`;
    };
    let html = createCard(attacker.name, attacker.color, statsA);
    allResults.forEach(item => { const { opponent, statsB } = item; html += createCard(opponent.name, opponent.color, statsB); });
    container.innerHTML = html;
}

Utils.initResizer(document.getElementById('resizerLeft'), document.getElementById('leftSidebar'), 'left', Charts.resizeCharts);
Utils.initResizer(document.getElementById('resizerRight'), document.getElementById('rightSidebar'), 'right', Charts.resizeCharts);
Utils.initResizer(document.getElementById('resizerVertical'), document.getElementById('analysisPanel'), 'vertical', Charts.resizeCharts);
document.body.addEventListener('focusout', (e) => {
    const target = e.target;
    if (target.tagName === 'INPUT' && (target.type === 'text' || target.type === 'number')) {
        const val = target.value; if (!val) return;
        try { new Function('return ' + val.replace(/[a-zA-Z_]\w*/g, '1')); } catch (err) { flashErrorOnLabel(target); }
    }
});
function flashErrorOnLabel(inputElement) {
    let label = inputElement.previousElementSibling; if (!label || label.tagName !== 'LABEL') { const parent = inputElement.parentElement; if (parent) label = parent.querySelector('label'); }
    if (label) { const originalText = label.getAttribute('data-original-text') || label.innerText; if (!label.getAttribute('data-original-text')) label.setAttribute('data-original-text', originalText); label.innerText = "⚠ ERR"; label.classList.add('label-error'); setTimeout(() => { label.innerText = originalText; label.classList.remove('label-error'); }, 2000); }
}

function initProject() {
    // 1. 기본 스탯 정의 (cric, crid 추가됨)
    const defaultStats = ['hp', 'atk', 'def', 'aspd', 'eva', 'cric', 'crid'];
    
    // 2. 스탯 설명 정의
    const defaultDescriptions = {
        hp: "Health Point",
        atk: "Base Damage",
        def: "Defense",
        aspd: "Attack Speed",
        eva: "Evasion",
        cric: "Critical Chance",
        crid: "Critical Damage"
    };

    // 3. DM(DataManager)에 규칙 설정
    // 만약 로드된 데이터가 없다면 이 기본값을 사용
    if (!DM.hasProjectData()) {
        DM.setRules({
            stats: defaultStats,
            descriptions: defaultDescriptions,
            // [중요] battle.js 수정에 맞춰 공식도 a.atk, b.def로 변경 권장
            dmgFormula: "atk * (100 / (100 + def))", 
            cpFormula: "hp * 0.5 + atk * 2 + def + aspd * 5"
        });
    }
    
    refreshAll();
}
initProject();


refreshAll();
runSimulation();