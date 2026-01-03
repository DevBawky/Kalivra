// 전체 프로젝트 데이터 구조 (기존 유지)
let projectData = {
    meta: {
        projectName: "Untitled Project",
        author: "User",
        description: "",
        version: "1.0.0"
    },
    snapshots: [],
    itemSets: [], 
    current: {
        entities: [],
        items: [],
        gameRules: {
            stats: ['hp', 'atk', 'def', 'acc', 'eva', 'cric', 'crid', 'aspd'],
            defaultValues: {
                hp: { b: 200, g: 20 },
                atk: { b: 20, g: 2 },
                acc: { b: 95, g: 0 }, 
                def: { b: 5, g: 0 },
                aspd: { b: 1.0, g: 0 },
                eva: { b: 20, g: 1 },
                cric: { b: 15, g: 0 },
                crid: { b: 1.5, g: 0 }
            },
            descriptions: {
                hp: "Health Point", 
                atk: "Base Damage", 
                def: "Defense", 
                acc: "Accuracy (명중)",
                eva: "Evasion (회피)", 
                cric: "Critical Chance", 
                crid: "Critical Damage",
                aspd: "Attack Speed"
            },
            dmgFormula: 'a.atk * (100 / (100 + b.def))',
            hitFormula: "(a.acc - b.eva)",
            cpFormula: 'atk * aspd * 10 + hp * 0.5 + def * 1.5 + acc + eva * 2'
        }
    }
};

class CommandManager {
    constructor() { this.undoStack = []; this.redoStack = []; }
    execute(command) { command.execute(); this.undoStack.push(command); this.redoStack = []; }
    undo() { const cmd = this.undoStack.pop(); if (cmd) { cmd.undo(); this.redoStack.push(cmd); return true; } return false; }
    redo() { const cmd = this.redoStack.pop(); if (cmd) { cmd.execute(); this.undoStack.push(cmd); return true; } return false; }
}

class DeleteItemCommand {
    constructor(listArray, index, uiCallback) { this.listArray = listArray; this.index = index; this.uiCallback = uiCallback; this.deletedItem = null; }
    execute() { if (this.index >= 0 && this.index < this.listArray.length) { this.deletedItem = this.listArray.splice(this.index, 1)[0]; if (this.uiCallback) this.uiCallback(); } }
    undo() { if (this.deletedItem) { this.listArray.splice(this.index, 0, this.deletedItem); if (this.uiCallback) this.uiCallback(); } }
}

const commandManager = new CommandManager();

module.exports = {
    // 기존 Getter/Setter (유지)
    getEntities: () => projectData.current.entities,
    getItems: () => projectData.current.items,
    getRules: () => projectData.current.gameRules,
    getMeta: () => projectData.meta,
    setMeta: (newMeta) => { projectData.meta = { ...projectData.meta, ...newMeta }; },
    getSnapshots: () => projectData.snapshots,
    
    createSnapshot: (name) => {
        const snapshot = {
            id: Date.now(),
            name: name || `Snapshot ${projectData.snapshots.length + 1}`,
            date: new Date().toISOString(),
            data: JSON.parse(JSON.stringify(projectData.current)) 
        };
        projectData.snapshots.push(snapshot);
    },
    
    loadSnapshot: (index) => {
        if (index >= 0 && index < projectData.snapshots.length) {
            projectData.current = JSON.parse(JSON.stringify(projectData.snapshots[index].data));
            commandManager.undoStack = [];
            commandManager.redoStack = [];
        }
    },

    deleteSnapshot: (index) => { projectData.snapshots.splice(index, 1); },

    getItemSets: () => projectData.itemSets || [],
    
    addItemSet: (name) => {
        if (!projectData.itemSets) projectData.itemSets = [];
        const newSet = {
            id: Date.now(),
            name: name || `Set ${projectData.itemSets.length + 1}`,
            items: JSON.parse(JSON.stringify(projectData.current.items)) 
        };
        projectData.itemSets.push(newSet);
    },

    deleteItemSet: (index) => {
        if (projectData.itemSets && index >= 0 && index < projectData.itemSets.length) {
            projectData.itemSets.splice(index, 1);
        }
    },

    loadProject: (data) => {
        if (data.meta && data.current) {
            projectData = data;
            if (!projectData.itemSets) projectData.itemSets = [];
        } else {
            projectData.current.entities = data.entities || [];
            projectData.current.items = data.items || [];
            projectData.current.gameRules = data.gameRules || projectData.current.gameRules;
            projectData.snapshots = [];
            projectData.itemSets = [];
        }
    },
    
    getProjectData: () => projectData,

    setEntities: (data) => { projectData.current.entities = data || []; },
    setItems: (data) => { projectData.current.items = data || []; },
    setRules: (data) => { if(data) projectData.current.gameRules = data; },

    addEntity: (ent) => projectData.current.entities.push(ent),
    removeEntity: (idx) => projectData.current.entities.splice(idx, 1),
    addItem: (item) => projectData.current.items.push(item),
    removeItemWithUndo: (idx, uiRefreshFunc) => {
        const cmd = new DeleteItemCommand(projectData.current.items, idx, uiRefreshFunc);
        commandManager.execute(cmd);
    },

    undo: () => commandManager.undo(),
    redo: () => commandManager.redo(),

    // [NEW] Bulk Update Function
    bulkUpdate: (entityIds, stat, op, value) => {
        projectData.current.entities.forEach(ent => {
            if (entityIds.includes(ent.id)) {
                // Ensure stat object exists
                if (!ent.stats[stat]) ent.stats[stat] = { b: 0, g: 0 };
                
                // Base Value update
                let currentVal = ent.stats[stat].b;
                if (op === 'set') currentVal = value;
                else if (op === 'add') currentVal += value;
                else if (op === 'mult') currentVal *= value;
                
                // Rounding for clean numbers (optional)
                ent.stats[stat].b = parseFloat(currentVal.toFixed(2));
            }
        });
    },

    // ===========================================
    // [NEW] 엔진 Export 로직
    // ===========================================

    // 1. Unity용 JSON
    exportForUnity: () => {
        const entities = projectData.current.entities;
        const items = projectData.current.items;
        const rules = projectData.current.gameRules;

        const exportData = {
            entities: entities.map(e => ({
                id: e.id,
                name: e.name,
                variance: e.variance || 0,
                stats: rules.stats.map(s => ({
                    statName: s,
                    baseVal: e.stats[s]?.b || 0,
                    growthVal: e.stats[s]?.g || 0
                })),
                itemIds: items.filter(i => i.targets.includes(e.id)).map(i => i.id)
            })),
            items: items.map(i => ({
                id: i.id,
                name: i.name,
                active: i.active,
                modifiers: i.modifiers.map(m => ({ stat: m.stat, op: m.op, val: m.val })),
                traits: (i.traits || []).map(t => {
                    const trig = t.triggers[0];
                    const cond = trig.conditions[0];
                    const eff = trig.effects[0];
                    return {
                        traitName: t.name,
                        trigger: trig.type,
                        chance: cond.type === 'Chance' ? cond.value : 100,
                        effectType: eff.type,
                        target: eff.target,
                        value: eff.value,
                        stat: eff.stat || "",
                        duration: eff.duration || 0
                    };
                })
            }))
        };
        return JSON.stringify(exportData, null, 2);
    },

    // 2. Unreal용 JSON
    exportForUnreal: () => {
        const entities = projectData.current.entities;
        const items = projectData.current.items;
        const rules = projectData.current.gameRules;

        const entityTable = entities.map(e => {
            const row = {
                Name: e.name,
                Id: e.id,
                Variance: e.variance || 0,
                EquippedItemIds: items.filter(i => i.targets.includes(e.id)).map(i => i.id).join(',')
            };
            rules.stats.forEach(s => {
                const statName = s.toLowerCase();
                row[`${statName}_Base`] = e.stats[s]?.b || 0;
                row[`${statName}_Growth`] = e.stats[s]?.g || 0;
            });
            return row;
        });

        const itemTable = items.map(i => {
            const row = {
                Name: i.name,
                Id: i.id,
                IsActive: i.active,
                Modifiers: i.modifiers.map(m => `${m.stat}:${m.op}:${m.val}`).join(','),
                Traits: (i.traits || []).map(t => {
                    const trig = t.triggers[0];
                    const cond = trig.conditions[0];
                    const eff = trig.effects[0];
                    return `${t.name}|${trig.type}|${cond.value}|${eff.type}|${eff.value}`;
                }).join(';')
            };
            return row;
        });

        return JSON.stringify({
            Entities: entityTable,
            Items: itemTable
        }, null, 2);
    }
};