const { ipcRenderer } = require('electron');
const DM = require('./src/renderer/dataManager');
const Sim = require('./src/renderer/calculator');
const UI = require('./src/renderer/uiManager');
const Charts = require('./src/renderer/chartManager');
const Utils = require('./src/renderer/utils');
const Battle = require('./src/renderer/battle');

// ========================================================
// [Custom Modal System] 네이티브 Alert/Confirm 대체
// ========================================================
const ModalSystem = {
    init() {
        if (document.getElementById('custom-modal-overlay')) return;
        
        const css = `
            #custom-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 20000; display: none; align-items: center; justify-content: center; backdrop-filter: blur(2px); }
            #custom-modal-box { background: #252526; border: 1px solid #454545; padding: 20px; width: 320px; border-radius: 8px; box-shadow: 0 10px 20px rgba(0,0,0,0.5); text-align: center; display: flex; flex-direction: column; gap: 15px; }
            #custom-modal-msg { color: #eee; font-size: 14px; white-space: pre-wrap; line-height: 1.5; }
            #custom-modal-actions { display: flex; justify-content: center; gap: 10px; margin-top: 5px; }
            .custom-modal-btn { background: #3e3e42; color: #fff; border: 1px solid #555; padding: 6px 16px; cursor: pointer; border-radius: 4px; font-size: 13px; min-width: 70px; transition: background 0.2s; }
            .custom-modal-btn:hover { background: #505055; }
            .custom-modal-btn.primary { background: #0e639c; border-color: #1177bb; font-weight: bold; }
            .custom-modal-btn.primary:hover { background: #1177bb; }
            .custom-modal-btn.danger { background: #8b0000; border-color: #a00; }
            .custom-modal-btn.danger:hover { background: #a00; }
            /* 에러 플래시 효과용 스타일 */
            .label-error { color: #ff6b6b !important; font-weight: bold; transition: color 0.2s; }
            .input-error { border-color: #ff6b6b !important; background-color: rgba(255, 107, 107, 0.1) !important; }
        `;
        const style = document.createElement('style'); 
        style.textContent = css; 
        document.head.appendChild(style);

        const overlay = document.createElement('div'); 
        overlay.id = 'custom-modal-overlay';
        overlay.innerHTML = `
            <div id="custom-modal-box">
                <div id="custom-modal-msg"></div>
                <div id="custom-modal-actions"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        this.overlay = overlay;
        this.msgEl = overlay.querySelector('#custom-modal-msg');
        this.actionsEl = overlay.querySelector('#custom-modal-actions');
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.style.display === 'flex') {
                this.close();
            }
        });
    },

    show(msg, type, onConfirm, onCancel) {
        this.msgEl.textContent = msg;
        this.actionsEl.innerHTML = '';

        const okBtn = document.createElement('button');
        okBtn.className = 'custom-modal-btn primary';
        okBtn.textContent = type === 'confirm' ? 'Yes' : 'OK';
        okBtn.onclick = () => {
            this.close();
            if (onConfirm) onConfirm();
        };

        if (type === 'confirm') {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'custom-modal-btn';
            cancelBtn.textContent = 'No';
            cancelBtn.onclick = () => {
                this.close();
                if (onCancel) onCancel();
            };
            if (msg.toLowerCase().includes('delete') || msg.toLowerCase().includes('remove')) {
                okBtn.className = 'custom-modal-btn danger';
            }
            this.actionsEl.appendChild(okBtn);
            this.actionsEl.appendChild(cancelBtn);
            cancelBtn.focus();
        } else {
            this.actionsEl.appendChild(okBtn);
            okBtn.focus();
        }

        this.overlay.style.display = 'flex';
    },

    close() {
        this.overlay.style.display = 'none';
        window.focus(); 
    },

    alert(msg, callback) {
        this.show(msg, 'alert', callback);
    },

    confirm(msg, yesCallback, noCallback) {
        this.show(msg, 'confirm', yesCallback, noCallback);
    }
};

// ========================================================
// [Helper] UI Flash Error
// ========================================================
function flashErrorOnLabel(inputElement, customMsg = "⚠ ERR") { 
    let label = inputElement.previousElementSibling; 
    if (!label || label.tagName !== 'LABEL') { 
        const parent = inputElement.parentElement; 
        if (parent) label = parent.querySelector('label'); 
    } 
    
    if (label) { 
        if (!label.getAttribute('data-original-text')) {
            label.setAttribute('data-original-text', label.innerText);
        }
        
        const originalText = label.getAttribute('data-original-text');
        
        label.innerText = customMsg; 
        label.classList.add('label-error'); 
        inputElement.classList.add('input-error');

        setTimeout(() => { 
            label.innerText = originalText; 
            label.classList.remove('label-error'); 
            inputElement.classList.remove('input-error');
        }, 2000); 
    } else {
        inputElement.classList.add('input-error');
        setTimeout(() => inputElement.classList.remove('input-error'), 2000);
    }
}

const checkFormula = (formula) => {
    if (!formula || formula.trim() === "") return { valid: false, error: "Empty" };

    let depth = 0;
    for (let char of formula) {
        if (char === '(') depth++; else if (char === ')') depth--;
        if (depth < 0) return { valid: false, error: "Too many ')'" };
    }
    if (depth !== 0) return { valid: false, error: "Unmatched '('" };

    if (/[\+\-\*\/]\s*$/.test(formula)) {
        return { valid: false, error: "Ends with Op" };
    }

    try {
        const dummyFormula = formula.replace(/[a-zA-Z_][a-zA-Z0-9_.]*/g, '1');
        
        const fn = new Function('return ' + dummyFormula);
        fn(); 
    } catch (err) {
        if (err.message.includes('Unexpected token')) return { valid: false, error: "Bad Syntax (*+ etc)" };
        return { valid: false, error: "Invalid Formula" };
    }

    return { valid: true };
};

// ========================================================
// C# Templates
// ========================================================
const CS_ENTITY_SO = `using UnityEngine; using System.Collections.Generic; public class EntitySO : ScriptableObject { public int id; public string unitName; public float variance; [System.Serializable] public struct StatData { public string stat; public float baseVal; public float growthVal; } public List<StatData> stats = new List<StatData>(); public List<ItemSO> equippedItems = new List<ItemSO>(); }`;
const CS_ITEM_SO = `using UnityEngine; using System.Collections.Generic; public class ItemSO : ScriptableObject { public int id; public string itemName; public bool active; [System.Serializable] public struct ModifierData { public string stat; public string op; public float val; } public List<ModifierData> modifiers = new List<ModifierData>(); [System.Serializable] public struct SimpleTrait { public string traitName; public string trigger; public float chance; public string effectType; public string target; public float value; public string stat; public int duration; } public List<SimpleTrait> traits = new List<SimpleTrait>(); }`;
const CS_IMPORTER = `using UnityEngine; using UnityEditor; using System.Collections.Generic; using System.IO; using System.Linq; [System.Serializable] public class StatRaw { public string statName; public float baseVal; public float growthVal; } [System.Serializable] public class ModRaw { public string stat; public string op; public float val; } [System.Serializable] public class TraitRaw { public string traitName; public string trigger; public float chance; public string effectType; public string target; public float value; public string stat; public int duration; } [System.Serializable] public class ItemRaw { public int id; public string name; public bool active; public List<ModRaw> modifiers; public List<TraitRaw> traits; } [System.Serializable] public class EntityRaw { public int id; public string name; public float variance; public List<StatRaw> stats; public List<int> itemIds; } [System.Serializable] public class KalivraJsonRoot { public List<EntityRaw> entities; public List<ItemRaw> items; } public class KalivraImporter : AssetPostprocessor { private const string FILE_NAME = "KalivraData.json"; private const string ENTITY_PATH = "Assets/Resources/KalivraData/Entities"; private const string ITEM_PATH = "Assets/Resources/KalivraData/Items"; [MenuItem("Kalivra/Force Import JSON")] public static void ManualImport() { string[] guids = AssetDatabase.FindAssets("KalivraData t:TextAsset"); if (guids.Length == 0) return; ExecuteImport(AssetDatabase.GUIDToAssetPath(guids[0])); } static void ExecuteImport(string jsonPath) { string jsonContent = File.ReadAllText(jsonPath); KalivraJsonRoot data = JsonUtility.FromJson<KalivraJsonRoot>(jsonContent); if (data == null) return; if (!Directory.Exists(ENTITY_PATH)) Directory.CreateDirectory(ENTITY_PATH); if (!Directory.Exists(ITEM_PATH)) Directory.CreateDirectory(ITEM_PATH); Dictionary<int, ItemSO> itemMap = new Dictionary<int, ItemSO>(); foreach (var i in data.items) { string path = ITEM_PATH + "/" + i.name.Replace(" ", "_") + ".asset"; ItemSO asset = GetOrCreateAsset<ItemSO>(path); asset.id = i.id; asset.itemName = i.name; asset.active = i.active; asset.modifiers = i.modifiers.Select(m => new ItemSO.ModifierData { stat = m.stat, op = m.op, val = m.val }).ToList(); asset.traits = i.traits.Select(t => new ItemSO.SimpleTrait { traitName = t.traitName, trigger = t.trigger, chance = t.chance, effectType = t.effectType, target = t.target, value = t.value, stat = t.stat, duration = t.duration }).ToList(); EditorUtility.SetDirty(asset); itemMap[i.id] = asset; } foreach (var ent in data.entities) { string path = ENTITY_PATH + "/" + ent.name.Replace(" ", "_") + ".asset"; EntitySO asset = GetOrCreateAsset<EntitySO>(path); asset.id = ent.id; asset.unitName = ent.name; asset.variance = ent.variance; asset.stats = ent.stats.Select(s => new EntitySO.StatData { stat = s.statName, baseVal = s.baseVal, growthVal = s.growthVal }).ToList(); asset.equippedItems.Clear(); if(ent.itemIds != null) { foreach(int id in ent.itemIds) if(itemMap.ContainsKey(id)) asset.equippedItems.Add(itemMap[id]); } EditorUtility.SetDirty(asset); } AssetDatabase.SaveAssets(); AssetDatabase.Refresh(); } static T GetOrCreateAsset<T>(string path) where T : ScriptableObject { T asset = AssetDatabase.LoadAssetAtPath<T>(path); if (asset == null) { asset = ScriptableObject.CreateInstance<T>(); AssetDatabase.CreateAsset(asset, path); } return asset; } }`;

// ========================================================
// DOM & State
// ========================================================
const dom = {
    entCont: document.getElementById('entityContainer'),
    itemCont: document.getElementById('itemContainer'),
    maxLevel: document.getElementById('maxLevel'),
    metric: document.getElementById('graphMetric'),
    battleLog: document.getElementById('battleLog'),
    battleStatList: document.getElementById('battleStatList'),
    analysisLog: document.getElementById('analysisLog'),
    bulkModal: document.getElementById('bulkModal'),
    gridCont: document.getElementById('gridContainer'),
    selCount: document.getElementById('selectedCount')
};

let selectedEntityIds = [];

const detailModal = document.getElementById('detailModal');
const btnDetail = document.getElementById('btnDetail');
const closeDetail = document.querySelector('.close-detail');
const leagueModal = document.getElementById('leagueModal');
const btnLeague = document.getElementById('openLeagueBtn');
const closeLeague = document.querySelector('.close-league');
const btnRunLeague = document.getElementById('runLeagueBtn');
const leagueContainer = document.getElementById('leagueContainer');
const itemSetModal = document.getElementById('itemSetModal');
const btnItemSet = document.getElementById('btnItemSet'); 
const closeItemSet = document.querySelector('.close-itemset');
const saveItemSetBtn = document.getElementById('saveItemSetBtn');
const itemSetList = document.getElementById('itemSetList');

// ========================================================
// Logic & Commands
// ========================================================

function debounce(func, timeout = 300) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => { func.apply(this, args); }, timeout); };
}
const debouncedSimulation = debounce(() => { runSimulation(); }, 200);

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
class LoadItemSetCommand {
    constructor(newItems) {
        this.newItems = JSON.parse(JSON.stringify(newItems)); 
        this.oldItems = JSON.parse(JSON.stringify(DM.getItems())); 
    }
    execute() { DM.setItems(this.newItems); refreshAll(); runSimulation(); }
    undo() { DM.setItems(this.oldItems); refreshAll(); runSimulation(); }
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { if (undoStack.length > 0) { const cmd = undoStack.pop(); cmd.undo(); redoStack.push(cmd); } }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { if (redoStack.length > 0) { const cmd = redoStack.pop(); cmd.execute(); undoStack.push(cmd); } }
});

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
    const formula = metric === 'cp' ? rules.cpFormula : rules.dmgFormula;
    const labels = Array.from({length: max}, (_, i) => `Lv.${i+1}`);
    const datasets = []; 
    const rawData = {}; 
    const dummyTarget = {};
    if (rules.stats) rules.stats.forEach(s => dummyTarget[s] = 0);

    DM.getEntities().forEach(ent => {
        const data = [];
        for(let lv=1; lv<=max; lv++) {
            const stats = Sim.getStatsAtLevel(ent, lv, DM.getItems(), rules);
            let calculatedVal = 0;
            try {
                if (metric === 'cp') calculatedVal = Sim.calculateValue(formula, stats);
                else calculatedVal = Sim.calculateValue(formula, { a: stats, b: dummyTarget });
            } catch (err) { calculatedVal = 0; }
            data.push(calculatedVal);
        }
        datasets.push({ label: ent.name, data, borderColor: ent.color, backgroundColor: ent.color+'20', borderWidth:2, tension:0.3 });
        rawData[ent.id] = { name: ent.name, data, color: ent.color };
    });

    if (Charts && Charts.renderMainChart) Charts.renderMainChart(document.getElementById('balanceChart').getContext('2d'), labels, datasets);
    const crossovers = Sim.analyzeCrossovers(rawData, max);
    dom.analysisLog.innerHTML = crossovers.length ? '' : '<div class="log-item placeholder">No crossover points detected.</div>';
    crossovers.forEach(c => { 
        dom.analysisLog.innerHTML += `<div class="log-item"><span class="log-level">Lv.${c.lv-1}->${c.lv}</span>: <b style="color:${c.wColor}">${c.winnerName}</b> overtakes <b style="color:${c.lColor}">${c.loserName}</b></div>`; 
    });
}

// ========================================================
// Modal & Events
// ========================================================

const configModal = document.getElementById('configModal');
document.getElementById('configBtn').addEventListener('click', () => {
    const rules = DM.getRules(); const meta = DM.getMeta();
    document.getElementById('metaProjectName').value = meta.projectName || '';
    document.getElementById('metaAuthor').value = meta.author || '';
    document.getElementById('metaDesc').value = meta.description || '';
    document.getElementById('dmgFormula').value = rules.dmgFormula;
    document.getElementById('hitFormula').value = rules.hitFormula || "(a.acc - b.eva)";
    document.getElementById('cpFormula').value = rules.cpFormula;
    document.getElementById('statDefinitions').value = rules.stats.join(', ');
    let descText = ""; if (rules.descriptions) descText = Object.entries(rules.descriptions).map(([k, v]) => `${k}: ${v}`).join('\n');
    document.getElementById('statDescInput').value = descText;
    configModal.style.display = 'flex';
});

document.querySelector('.close-bulk').addEventListener('click', () => dom.bulkModal.style.display = 'none');
document.querySelector('.close-modal').addEventListener('click', () => configModal.style.display = 'none');
document.querySelector('.close-snapshot').addEventListener('click', () => snapshotModal.style.display = 'none');
document.querySelector('.close-battle').addEventListener('click', () => battleModal.style.display = 'none');
document.querySelector('.close-detail').addEventListener('click', () => detailModal.style.display = 'none');
document.querySelector('.close-league').addEventListener('click', () => leagueModal.style.display = 'none');
if(closeItemSet) closeItemSet.addEventListener('click', () => itemSetModal.style.display = 'none');

// [NEW] 설정 저장 시 검사 (기존 로직 유지, checkFormula 재사용)
document.getElementById('applyConfigBtn').addEventListener('click', () => {
    const dmgInput = document.getElementById('dmgFormula');
    const cpInput = document.getElementById('cpFormula');
    const hitInput = document.getElementById('hitFormula');
    const statInput = document.getElementById('statDefinitions');
    
    const newStats = statInput.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (newStats.length === 0) { 
        flashErrorOnLabel(statInput, "Min 1 stat req");
        return; 
    }

    // 전역으로 뺀 checkFormula 함수 사용
    const dmgRes = checkFormula(dmgInput.value);
    if (!dmgRes.valid) { flashErrorOnLabel(dmgInput, dmgRes.error); return; }
    
    const cpRes = checkFormula(cpInput.value);
    if (!cpRes.valid) { flashErrorOnLabel(cpInput, cpRes.error); return; }
    
    const hitRes = checkFormula(hitInput.value);
    if (!hitRes.valid) { flashErrorOnLabel(hitInput, hitRes.error); return; }

    const rawDesc = document.getElementById('statDescInput').value; 
    const descriptions = {};
    rawDesc.split('\n').forEach(line => { const parts = line.split(':'); if (parts.length >= 2) descriptions[parts[0].trim()] = parts.slice(1).join(':').trim(); });
    
    DM.setMeta({ projectName: document.getElementById('metaProjectName').value, author: document.getElementById('metaAuthor').value, description: document.getElementById('metaDesc').value });
    DM.setRules({ stats: newStats, descriptions: descriptions, dmgFormula: dmgInput.value, hitFormula: hitInput.value, cpFormula: cpInput.value });
    
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
        item.innerHTML = `<div class="snapshot-info"><span class="snapshot-name">${snap.name}</span><span class="snapshot-date">${new Date(snap.date).toLocaleString()}</span></div><div class="snapshot-actions"><button class="load-btn" data-idx="${idx}">Load</button><button class="del-btn" data-idx="${idx}">✕</button></div>`;
        item.querySelector('.load-btn').addEventListener('click', (e) => { 
            e.stopPropagation(); 
            ModalSystem.confirm(`Load "${snap.name}"?`, () => {
                DM.loadSnapshot(idx); undoStack.length=0; redoStack.length=0; refreshAll(); runSimulation(); snapshotModal.style.display='none'; 
            });
        });
        item.querySelector('.del-btn').addEventListener('click', (e) => { 
            e.stopPropagation(); 
            ModalSystem.confirm('Delete this snapshot?', () => {
                DM.deleteSnapshot(idx); renderSnapshots(); 
            });
        });
        snapshotListCont.appendChild(item);
    });
}
document.getElementById('snapshotBtn').addEventListener('click', () => { renderSnapshots(); snapshotModal.style.display = 'flex'; });
document.getElementById('createSnapshotBtn').addEventListener('click', () => { const name = document.getElementById('newSnapshotName').value.trim(); DM.createSnapshot(name); document.getElementById('newSnapshotName').value=''; renderSnapshots(); });

function renderItemSets() {
    const sets = DM.getItemSets();
    itemSetList.innerHTML = '';
    if (sets.length === 0) { itemSetList.innerHTML = '<div style="padding:10px; color:#666; text-align:center;">No saved sets.</div>'; return; }
    sets.forEach((set, idx) => {
        const el = document.createElement('div');
        el.className = 'snapshot-item'; 
        el.innerHTML = `<div class="snapshot-info"><span class="snapshot-name">${set.name}</span><span style="font-size:0.8em; color:#777;">${set.items.length} items</span></div><div class="snapshot-actions"><button class="load-btn">Load</button><button class="del-btn">✕</button></div>`;
        el.querySelector('.load-btn').addEventListener('click', () => { 
            ModalSystem.confirm(`Replace current items with "${set.name}"?`, () => {
                executeCommand(new LoadItemSetCommand(set.items)); itemSetModal.style.display = 'none'; 
            });
        });
        el.querySelector('.del-btn').addEventListener('click', () => { 
            ModalSystem.confirm('Delete this set?', () => {
                DM.deleteItemSet(idx); renderItemSets(); 
            });
        });
        itemSetList.appendChild(el);
    });
}
if(btnItemSet) btnItemSet.addEventListener('click', () => { renderItemSets(); itemSetModal.style.display = 'flex'; });
if(saveItemSetBtn) saveItemSetBtn.addEventListener('click', () => { 
    const name = document.getElementById('newItemSetName').value.trim(); 
    if(!name) return ModalSystem.alert("Please enter a name."); 
    DM.addItemSet(name); 
    document.getElementById('newItemSetName').value = ''; 
    renderItemSets(); 
    ipcRenderer.send('save-kal', DM.getProjectData()); 
});

document.getElementById('saveBtn').addEventListener('click', () => ipcRenderer.send('save-kal', DM.getProjectData()));
document.getElementById('loadBtn').addEventListener('click', () => ipcRenderer.send('load-kal'));
document.getElementById('exportBtn').addEventListener('click', () => {
    let csv = "Level," + DM.getEntities().map(e=>e.name).join(',') + "\n";
    for(let lv=1; lv<=parseInt(dom.maxLevel.value); lv++){ csv += lv + "," + DM.getEntities().map(e => Sim.calculateValue(DM.getRules().cpFormula, Sim.getStatsAtLevel(e, lv, DM.getItems(), DM.getRules()))).join(',') + "\n"; }
    ipcRenderer.send('export-csv', csv);
});

// ========================================================
// Engine Exports
// ========================================================
function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

document.getElementById('unityBtn').addEventListener('click', () => {
    if (!window.JSZip) return ModalSystem.alert("JSZip library not loaded.");
    const zip = new JSZip();
    zip.file("KalivraData.json", DM.exportForUnity());
    zip.file("EntitySO.cs", CS_ENTITY_SO);
    zip.file("ItemSO.cs", CS_ITEM_SO);
    zip.file("KalivraImporter.cs", CS_IMPORTER);
    zip.generateAsync({type:"blob"}).then(function(content) { triggerDownload(content, "Kalivra_Unity_Export.zip"); });
});

document.getElementById('unrealBtn').addEventListener('click', () => {
    if (!window.JSZip) return ModalSystem.alert("JSZip library not loaded.");
    const zip = new JSZip();
    const jsonData = DM.exportForUnreal();
    zip.file("KalivraData_Unreal.json", jsonData);
    const readmeContent = `[Kalivra Unreal Engine Import Guide]\n(Same as previous instructions...)`;
    zip.file("Readme_Unreal.txt", readmeContent);
    zip.generateAsync({type:"blob"}).then(function(content) { triggerDownload(content, "Kalivra_Unreal_Export.zip"); });
});

// ========================================================
// Bulk Edit
// ========================================================
document.getElementById('bulkEditBtn').addEventListener('click', () => {
    dom.bulkModal.style.display = 'flex';
    initBulkOptions();
    refreshGrid();
});

function initBulkOptions() {
    const statSelect = document.getElementById('bulkStatSelect');
    statSelect.innerHTML = DM.getRules().stats.map(s => `<option value="${s}">${s.toUpperCase()}</option>`).join('');
}

function refreshGrid() {
    UI.renderBulkGrid(dom.gridCont, (selectedIds) => {
        selectedEntityIds = selectedIds;
        dom.selCount.innerText = selectedIds.length;
    });
}

document.getElementById('applyBulkBtn').addEventListener('click', () => {
    if (selectedEntityIds.length === 0) return ModalSystem.alert("Select entities first!"); 
    const stat = document.getElementById('bulkStatSelect').value;
    const op = document.getElementById('bulkOpSelect').value;
    const val = parseFloat(document.getElementById('bulkValueInput').value) || 0;

    DM.bulkUpdate(selectedEntityIds, stat, op, val);
    
    refreshGrid();
    refreshAll();
    runSimulation();
    
    const btn = document.getElementById('applyBulkBtn');
    const originalText = btn.innerText;
    btn.innerText = "Applied!";
    setTimeout(() => btn.innerText = originalText, 1000);
});

// ... (IPC Events) ...
ipcRenderer.on('load-finished', (e, data) => { DM.loadProject(data); undoStack.length=0; redoStack.length=0; refreshAll(); runSimulation(); });
ipcRenderer.on('save-finished', (e, msg) => ModalSystem.alert(msg));
ipcRenderer.on('export-finished', (e, msg) => ModalSystem.alert(msg));

document.getElementById('calcBtn').addEventListener('click', runSimulation);
dom.metric.addEventListener('change', runSimulation);
document.getElementById('addBtn').addEventListener('click', () => {
    const color = '#' + Math.floor(Math.random() * 16777215).toString(16);
    const rules = DM.getRules();
    const defaults = rules.defaultValues || {}; 
    const newStats = {};
    rules.stats.forEach(s => { newStats[s] = defaults[s] ? { ...defaults[s] } : { b: 0, g: 0 }; });
    executeCommand(new AddEntityCommand({ id: Date.now(), name: 'New Unit', color, stats: newStats, variance: 0, isLocked: false }));
});
document.getElementById('addItemBtn').addEventListener('click', () => { executeCommand(new AddItemCommand({ id: Date.now(), name: 'New Item', active: true, targets: DM.getEntities().map(e=>e.id), modifiers: [{ stat: DM.getRules().stats[0], op: "add", val: 10, when: "" }], traits: [] })); });
['min','max','close'].forEach(a => { const btn = document.getElementById(a+'Btn'); if(btn) btn.addEventListener('click', () => ipcRenderer.send(a+'-app')); });

// ========================================================
// Battle Simulation
// ========================================================
const battleModal = document.getElementById('battleModal');
document.getElementById('openBattleBtn').addEventListener('click', () => {
    const sA = document.getElementById('battleEntA'), sB = document.getElementById('battleEntB');
    sA.innerHTML = ''; sB.innerHTML = '<option value="all">ALL (League)</option>';
    DM.getEntities().forEach(e => { sA.add(new Option(e.name, e.id)); sB.add(new Option(e.name, e.id)); });
    battleModal.style.display = 'flex';
});

document.getElementById('runBattleBtn').addEventListener('click', () => {
    const idA = parseInt(document.getElementById('battleEntA').value);
    const entA = DM.getEntities().find(e => e.id === idA);
    const lv = parseInt(document.getElementById('battleLevel').value);
    if (!entA) return ModalSystem.alert("Select Attacker!"); 
    let statsA; try { statsA = Sim.getStatsAtLevel(entA, lv, DM.getItems(), DM.getRules()); } catch (e) { return ModalSystem.alert(`Error getting Stats A: ${e.message}`); }
    const itemsA = DM.getItems().filter(i => i.active && i.targets.includes(entA.id));
    const battleEntA = { ...entA, traits: [...(entA.traits||[]), ...itemsA.flatMap(i=>i.traits||[])] };
    const results = [];
    const idB = document.getElementById('battleEntB').value;
    let targets = [];
    if (idB === 'all') targets = DM.getEntities().filter(e => e.id !== idA);
    else { const t = DM.getEntities().find(e => e.id == parseInt(idB)); if (t) targets.push(t); }
    if (targets.length === 0) return ModalSystem.alert("Target not found"); 
    dom.battleLog.innerHTML = '<div style="padding:10px; text-align:center; color:#fee75c;">Simulating...</div>';
    dom.battleStatList.innerHTML = '';
    setTimeout(() => {
        try {
            let allBattleResults = [];
            const battleCount = parseInt(document.getElementById('battleCount').value) || 100;
            const rules = DM.getRules();
            targets.forEach(entB => {
                const statsB = Sim.getStatsAtLevel(entB, lv, DM.getItems(), rules);
                const itemsB = DM.getItems().filter(i => i.active && i.targets.includes(entB.id));
                const battleEntB = { ...entB, traits: [...(entB.traits||[]), ...itemsB.flatMap(i=>i.traits||[])] };
                const batchResult = Battle.runBattleBatch(battleEntA, statsA, battleEntB, statsB, battleCount, rules);
                results.push(batchResult);
                allBattleResults.push({ opponent: entB, statsB: statsB, result: batchResult });
            });
            Charts.renderBattleChart(document.getElementById('battleResultChart').getContext('2d'), results);
            renderBattleLog(allBattleResults, entA.name);
            document.getElementById('statDisplayLevel').innerText = lv;
            renderBattleStats(entA, statsA, allBattleResults);
        } catch (err) { console.error(err); dom.battleLog.innerHTML = `<div style="padding:10px; text-align:center; color:#e74c3c;"><strong>Simulation Error!</strong><br>${err.message}</div>`; ModalSystem.alert(`Simulation Failed:\n${err.message}`); } 
    }, 50);
});

function runDetailAnalysis(idA, idB, lv) {
    const entA = DM.getEntities().find(e => e.id === idA);
    const entB = DM.getEntities().find(e => e.id === idB);
    if (!entA || !entB) return ModalSystem.alert("Entities not found.");
    let statsA, statsB, battleEntA, battleEntB;
    try {
        statsA = Sim.getStatsAtLevel(entA, lv, DM.getItems(), DM.getRules());
        const itemsA = DM.getItems().filter(i => i.active && i.targets.includes(entA.id));
        battleEntA = { ...entA, traits: [...(entA.traits||[]), ...itemsA.flatMap(i=>i.traits||[])] };
        statsB = Sim.getStatsAtLevel(entB, lv, DM.getItems(), DM.getRules());
        const itemsB = DM.getItems().filter(i => i.active && i.targets.includes(entB.id));
        battleEntB = { ...entB, traits: [...(entB.traits||[]), ...itemsB.flatMap(i=>i.traits||[])] };
    } catch (e) { return ModalSystem.alert(e.message); } 
    detailModal.style.display = 'flex';
    detailModal.style.zIndex = "9999"; 
    const titleEl = document.getElementById('detailTitle') || document.querySelector('#detailModal h2');
    if (titleEl) { titleEl.innerText = `${entA.name} vs ${entB.name}`; }
    document.getElementById('detailStats').innerText = "Running M.C Simulation (10,000 runs)...";
    setTimeout(() => {
        const startTime = performance.now();
        const result = Battle.runMonteCarlo(battleEntA, statsA, battleEntB, statsB, 10000, DM.getRules());
        const endTime = performance.now();
        Charts.renderDetailCharts(document.getElementById('detailTurnChart').getContext('2d'), document.getElementById('detailHpChart').getContext('2d'), result);
        const fwr = result.firstTurnWinRate.toFixed(1);
        const fwrColor = result.firstTurnWinRate > 60 ? '#e74c3c' : (result.firstTurnWinRate < 40 ? '#e74c3c' : '#2da44e');
        document.getElementById('detailStats').innerHTML = `<style>.stat-grid-item { background: #252526; padding: 10px; border-radius: 4px; text-align: center; border: 1px solid #3e3e42; } .stat-label { font-size: 0.8em; color: #888; display: block; margin-bottom: 4px; } .stat-value { font-size: 1.2em; font-weight: bold; color: #ddd; }</style><div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px;"><div class="stat-grid-item"><span class="stat-label">Total Win Rate</span><span class="stat-value" style="color:${result.winRate>50?'#2da44e':'#e74c3c'}">${result.winRate.toFixed(2)}%</span></div><div class="stat-grid-item" style="border-color:${fwrColor}40"><span class="stat-label">Win% (When 1st)</span><span class="stat-value" style="color:${fwrColor}">${fwr}%</span></div><div class="stat-grid-item"><span class="stat-label">Avg Turns</span><span class="stat-value" style="color:#d29922">${result.avgTurns.toFixed(2)}</span></div><div class="stat-grid-item"><span class="stat-label">Sim Time</span><span class="stat-value" style="color:#777">${(endTime-startTime).toFixed(0)}ms</span></div><div class="stat-grid-item"><span class="stat-label">Realized Crit %</span><span class="stat-value" style="color:#5fabff">${result.realizedCritRate.toFixed(1)}%</span></div><div class="stat-grid-item"><span class="stat-label">Realized Dodge %</span><span class="stat-value" style="color:#b9bbbe">${result.realizedDodgeRate.toFixed(1)}%</span></div><div class="stat-grid-item"><span class="stat-label">Avg DPT</span><span class="stat-value" style="color:#e74c3c">${Math.round(result.avgDpt)}</span></div><div class="stat-grid-item"><span class="stat-label">Avg Overkill</span><span class="stat-value" style="color:#e67e22">${Math.round(result.avgOverkill)}</span></div></div>`;
    }, 50);
}
if(btnDetail) { btnDetail.addEventListener('click', () => { const idA = parseInt(document.getElementById('battleEntA').value); const idB = document.getElementById('battleEntB').value; const lv = parseInt(document.getElementById('battleLevel').value); if (idB === 'all') return ModalSystem.alert("Select a single opponent for M.C."); runDetailAnalysis(idA, parseInt(idB), lv); }); }
if (btnLeague) { btnLeague.addEventListener('click', () => { document.getElementById('leagueLevel').value = document.getElementById('maxLevel').value; leagueModal.style.display = 'flex'; }); }
if (btnRunLeague) {
    btnRunLeague.addEventListener('click', () => {
        const entities = DM.getEntities(); if (entities.length < 2) return ModalSystem.alert("Need at least 2 entities."); 
        const lv = parseInt(document.getElementById('leagueLevel').value) || 20;
        leagueContainer.innerHTML = '<div style="color:#fee75c;">Simulating League... This may take a moment.</div>';
        setTimeout(() => {
            const count = 100; const size = entities.length; const matrix = [];
            for (let i = 0; i < size; i++) {
                const row = []; const entA = entities[i];
                const statsA = Sim.getStatsAtLevel(entA, lv, DM.getItems(), DM.getRules());
                const itemsA = DM.getItems().filter(item => item.active && item.targets.includes(entA.id));
                const battleEntA = { ...entA, traits: [...(entA.traits||[]), ...itemsA.flatMap(it=>it.traits||[])] };
                for (let j = 0; j < size; j++) {
                    const entB = entities[j]; if (i === j) { row.push(null); continue; }
                    const statsB = Sim.getStatsAtLevel(entB, lv, DM.getItems(), DM.getRules());
                    const itemsB = DM.getItems().filter(item => item.active && item.targets.includes(entB.id));
                    const battleEntB = { ...entB, traits: [...(entB.traits||[]), ...itemsB.flatMap(it=>it.traits||[])] };
                    const res = Battle.runBattleBatch(battleEntA, statsA, battleEntB, statsB, count, DM.getRules());
                    row.push(res.winRate);
                }
                matrix.push(row);
            }
            const totalCols = size + 1; leagueContainer.innerHTML = '';
            const grid = document.createElement('div'); grid.className = 'matrix-container';
            grid.style.gridTemplateColumns = `120px repeat(${size}, 60px)`; grid.style.gridTemplateRows = `40px repeat(${size}, 40px)`;
            const emptyCorner = document.createElement('div'); emptyCorner.className = 'matrix-header matrix-row-header matrix-col-header'; emptyCorner.innerText = "ATK \\ DEF"; grid.appendChild(emptyCorner);
            entities.forEach(ent => { const h = document.createElement('div'); h.className = 'matrix-header matrix-col-header'; h.innerText = ent.name; h.style.color = ent.color; h.style.writingMode = 'vertical'; grid.appendChild(h); });
            for (let i = 0; i < size; i++) {
                const h = document.createElement('div'); h.className = 'matrix-header matrix-row-header'; h.innerText = entities[i].name; h.style.color = entities[i].color; grid.appendChild(h);
                for (let j = 0; j < size; j++) {
                    const cell = document.createElement('div'); cell.className = 'matrix-cell';
                    const winRate = matrix[i][j];
                    if (winRate === null) { cell.style.backgroundColor = '#222'; cell.innerText = '-'; } 
                    else { if (winRate > 60) cell.style.backgroundColor = 'rgba(45, 164, 78, 0.6)'; else if (winRate < 40) cell.style.backgroundColor = 'rgba(231, 76, 60, 0.6)'; else cell.style.backgroundColor = 'rgba(210, 153, 34, 0.6)'; cell.innerText = Math.round(winRate) + '%'; cell.addEventListener('click', () => { runDetailAnalysis(entities[i].id, entities[j].id, lv); }); cell.title = `${entities[i].name} vs ${entities[j].name}\nWin Rate: ${winRate.toFixed(1)}%`; }
                    grid.appendChild(cell);
                }
            }
            leagueContainer.appendChild(grid);
        }, 50);
    });
}
function renderBattleLog(allResults, heroName) {
    if (!allResults || allResults.length === 0) return;
    dom.battleLog.innerHTML = '';
    allResults.forEach((item, index) => {
        const { opponent, result } = item;
        const allLogs = result.allLogs || [];
        const winRate = result.winRate.toFixed(1);
        const avgTurns = result.avgTurns.toFixed(1);
        const isWin = result.winRate >= 50;
        const tagClass = isWin ? 'tag-win' : 'tag-lose';
        const group = document.createElement('div'); group.className = 'log-group';
        const header = document.createElement('div'); header.className = 'log-header';
        header.innerHTML = `<span>VS ${opponent.name}</span><div style="display:flex; gap:10px; align-items:center;"><span style="font-size:0.8em; color:#ccc;">Avg Turns: <span style="color:#fee75c;">${avgTurns}</span></span><span class="win-tag ${tagClass}">Win ${winRate}%</span></div>`;
        const content = document.createElement('div'); content.className = 'log-content';
        const navContainer = document.createElement('div'); navContainer.style.display = 'flex'; navContainer.style.justifyContent = 'space-between'; navContainer.style.alignItems = 'center'; navContainer.style.marginBottom = '10px'; navContainer.style.paddingBottom = '10px'; navContainer.style.borderBottom = '1px solid #3e3e42';
        const logTextBox = document.createElement('div'); logTextBox.className = 'log-text-box';
        let currentLogIdx = 0; 
        const updateLogDisplay = () => {
            const logs = allLogs[currentLogIdx];
            navContainer.innerHTML = `<button class="nav-btn prev-log-btn" style="background:none; border:none; color:#ccc; cursor:pointer; font-weight:bold;">◀</button><span style="font-size:0.9em; font-weight:bold; color:#5fabff;">Battle ${currentLogIdx + 1} / ${allLogs.length}</span><button class="nav-btn next-log-btn" style="background:none; border:none; color:#ccc; cursor:pointer; font-weight:bold;">▶</button>`;
            navContainer.querySelector('.prev-log-btn').onclick = (e) => { e.stopPropagation(); currentLogIdx = (currentLogIdx - 1 + allLogs.length) % allLogs.length; updateLogDisplay(); };
            navContainer.querySelector('.next-log-btn').onclick = (e) => { e.stopPropagation(); currentLogIdx = (currentLogIdx + 1) % allLogs.length; updateLogDisplay(); };
            if (logs && logs.length > 0) {
                let html = ''; let currentTurn = 0;
                logs.forEach(log => {
                    if (log.turn !== currentTurn) { currentTurn = log.turn; html += `<div class="log-turn-divider">Turn ${currentTurn}</div>`; }
                    const isHero = (log.actor === heroName); const actorClass = isHero ? 'log-actor-hero' : 'log-actor-enemy'; const valClass = log.action === 'attack' ? 'log-val-dmg' : 'log-val-heal';
                    let msg = '';
                    if (log.action === 'attack') msg = `<span class="${actorClass}">${log.actor}</span> <span style="color:#aaa;">attacked</span> <span class="log-target">${log.target}</span> → <span class="${valClass}">-${log.val} HP</span>`;
                    else if (log.action === 'die') msg = `<span class="${actorClass}">${log.actor}</span> <span style="color:#888;">${log.msg}</span>`;
                    else if (log.action === 'miss') msg = `<span class="${actorClass}">${log.actor}</span>: <span style="color:#aaa;">Missed!</span>`;
                    else msg = `<span class="${actorClass}">${log.actor}</span>: ${log.msg}`;
                    html += `<div class="log-item-detail">${msg}</div>`;
                });
                html += `<div class="log-footer">Simulation End</div>`; logTextBox.innerHTML = html;
            } else { logTextBox.innerHTML = '<div style="color:#666; text-align:center;">No log data available</div>'; }
        };
        if (allLogs.length > 0) { content.appendChild(navContainer); content.appendChild(logTextBox); updateLogDisplay(); } else { content.innerHTML = '<div style="color:#666; text-align:center; padding:10px;">Logs disabled for huge counts</div>'; }
        header.addEventListener('click', () => { content.classList.toggle('open'); });
        group.appendChild(header); group.appendChild(content); dom.battleLog.appendChild(group);
        if (index === 0) content.classList.add('open');
    });
}
function renderBattleStats(attacker, statsA, allResults) {
    const container = dom.battleStatList;
    const createCard = (name, color, stats) => {
        let rows = '';
        for (const [key, val] of Object.entries(stats)) { if (typeof val === 'number') { const displayVal = Number.isInteger(val) ? val : val.toFixed(2); rows += `<div class="stat-row"><span class="stat-name">${key.toUpperCase()}</span><span class="stat-val">${displayVal}</span></div>`; } }
        return `<div class="stat-card" style="border-left-color: ${color}"><div class="stat-card-header">${name}</div><div class="stat-grid">${rows}</div></div>`;
    };
    let html = createCard(attacker.name, attacker.color, statsA);
    allResults.forEach(item => { const { opponent, statsB } = item; html += createCard(opponent.name, opponent.color, statsB); });
    container.innerHTML = html;
}

Utils.initResizer(document.getElementById('resizerLeft'), document.getElementById('leftSidebar'), 'left', Charts.resizeCharts);
Utils.initResizer(document.getElementById('resizerRight'), document.getElementById('rightSidebar'), 'right', Charts.resizeCharts);
Utils.initResizer(document.getElementById('resizerVertical'), document.getElementById('analysisPanel'), 'vertical', Charts.resizeCharts);

// [MOD] 실시간 검사 강화: 숫자뿐만 아니라 수식 칸(ID 확인)도 체크하도록 변경
document.body.addEventListener('focusout', (e) => { 
    const target = e.target; 
    const formulaIds = ['dmgFormula', 'cpFormula', 'hitFormula'];

    // 1. 수식 입력칸 체크 (괄호 등 문법 검사)
    if (formulaIds.includes(target.id)) {
         const res = checkFormula(target.value);
         if (!res.valid) {
             flashErrorOnLabel(target, res.error);
         }
    }
    // 2. 일반 숫자 입력칸 체크 (NaN 등)
    else if (target.tagName === 'INPUT' && target.type === 'number') { 
        const val = target.value; 
        if (!val) return; 
        if (isNaN(Number(val))) {
             flashErrorOnLabel(target, "NaN"); 
        }
    } 
});

function initProject() {
    ModalSystem.init();
    const defaultStats = ['hp', 'atk', 'def', 'acc', 'eva', 'cric', 'crid', 'aspd'];
    const defaultDescriptions = { hp: "Health Point", atk: "Base Damage", def: "Defense", acc: "Accuracy (명중)", eva: "Evasion (회피)", cric: "Critical Chance", crid: "Critical Damage", aspd: "Attack Speed" };
    const defaultValues = { hp: { b: 200, g: 20 }, atk: { b: 20, g: 2 }, acc: { b: 95, g: 0 }, def: { b: 5, g: 0 }, aspd: { b: 1.0, g: 0 }, eva: { b: 20, g: 1 }, cric: { b: 15, g: 0 }, crid: { b: 1.5, g: 0 } };
    if (!DM.hasProjectData()) { DM.setRules({ stats: defaultStats, descriptions: defaultDescriptions, defaultValues: defaultValues, dmgFormula: "atk * (100 / (100 + def))", hitFormula: "(a.acc - b.eva)", cpFormula: "hp * 0.5 + atk * 2 + def + acc + eva + aspd * 5" }); }
    refreshAll();
}
initProject();
refreshAll();
runSimulation();