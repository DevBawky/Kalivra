const ProjectDocument = require('../domain/projectDocument');

let projectData = {
    meta: {
        projectName: "Kalivra Alpha Project",
        author: "Bawky",
        description: "Initial balancing project with default entities",
        version: "1.0.0"
    },
    snapshots: [],
    itemSets: [], 
    current: {
        entities: [
            {
                id: 1001,
                name: 'Chicken',
                color: '#ffcc00',
                stats: {
                    hp: { b: 150, g: 15 },
                    atk: { b: 25, g: 5 },
                    def: { b: 2, g: 0.5 },
                    acc: { b: 100, g: 0 },
                    eva: { b: 30, g: 2 },
                    cric: { b: 20, g: 0 },
                    crid: { b: 2.0, g: 0 },
                    aspd: { b: 1.5, g: 0.1 }
                },
                variance: 0.1,
                isLocked: false,
                attackType: 'Melee'
            },
            {
                id: 1002,
                name: 'Godzilla',
                color: '#4ecca3',
                stats: {
                    hp: { b: 500, g: 100 },
                    atk: { b: 50, g: 10 },
                    def: { b: 20, g: 5 },
                    acc: { b: 80, g: 0 },
                    eva: { b: 5, g: 0 },
                    cric: { b: 10, g: 0 },
                    crid: { b: 1.5, g: 0 },
                    aspd: { b: 0.5, g: 0.02 }
                },
                variance: 0.2,
                isLocked: false,
                attackType: 'Ranged'
            }
        ],
        items: [
            {
                id: 2001,
                name: 'Bawky',
                active: true,
                targets: [1001],
                modifiers: [
                    { stat: 'atk', op: 'mult', val: 1.1 },
                    { stat: 'aspd', op: 'add', val: 0.5 }
                ],
                traits: [
                    {
                        name: "Golden Egg",
                        triggers: [{
                            type: "OnCritical",
                            conditions: [{ type: "Chance", value: 30 }],
                            effects: [{ type: "Heal", target: "Self", valueType: "PercentOfDamage", value: 20 }]
                        }]
                    }
                ]
            }
        ],
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

projectData = ProjectDocument.normalizeProjectDocument(projectData);

const DM = {
    getEntities: () => projectData.current.entities,
    getItems: () => projectData.current.items,
    getRules: () => projectData.current.gameRules,
    getMeta: () => projectData.meta,
    setMeta: (newMeta) => { projectData.meta = { ...projectData.meta, ...newMeta }; },
    getSnapshots: () => projectData.snapshots,
    
    createSnapshot: (name, { clock = Date.now } = {}) => {
        const timestamp = clock();
        const snapshot = {
            id: timestamp,
            name: name || `Snapshot ${projectData.snapshots.length + 1}`,
            date: new Date(timestamp).toISOString(),
            data: JSON.parse(JSON.stringify(projectData.current)) 
        };
        projectData.snapshots.push(snapshot);
    },
    
    loadSnapshot: (index) => {
        if (index >= 0 && index < projectData.snapshots.length) {
            projectData.current = JSON.parse(JSON.stringify(projectData.snapshots[index].data));
        }
    },

    deleteSnapshot: (index) => { projectData.snapshots.splice(index, 1); },

    getItemSets: () => projectData.itemSets || [],
    
    addItemSet: (name, { clock = Date.now } = {}) => {
        if (!projectData.itemSets) projectData.itemSets = [];
        const newSet = {
            id: clock(),
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
        projectData = ProjectDocument.normalizeProjectDocument(data, projectData);
        return projectData;
    },

    hasProjectData: () => {
        return projectData && projectData.current;
    },
    
    getProjectData: () => projectData,

    setEntities: (data) => { projectData.current.entities = data || []; },
    setItems: (data) => { projectData.current.items = data || []; },
    setRules: (data) => { if(data) projectData.current.gameRules = data; },

    addEntity: (ent) => projectData.current.entities.push(ent),
    removeEntity: (idx) => projectData.current.entities.splice(idx, 1),
    addItem: (item) => projectData.current.items.push(item),
    bulkUpdate: (entityIds, stat, op, value) => {
        projectData.current.entities.forEach(ent => {
            if (entityIds.includes(ent.id)) {
                if (!ent.stats[stat]) ent.stats[stat] = { b: 0, g: 0 };
                let currentVal = ent.stats[stat].b;
                if (op === 'set') currentVal = value;
                else if (op === 'add') currentVal += value;
                else if (op === 'mult') currentVal *= value;
                ent.stats[stat].b = parseFloat(currentVal.toFixed(2));
            }
        });
    },

    exportForUnity: () => {
        const entities = projectData.current.entities.map(e => ({
            id: e.id,
            name: e.name,
            variance: e.variance || 0,
            stats: projectData.current.gameRules.stats.map(s => ({
                statName: s,
                baseVal: e.stats[s]?.b || 0,
                growthVal: e.stats[s]?.g || 0
            })),
            itemIds: projectData.current.items.filter(i => i.targets.includes(e.id)).map(i => i.id)
        }));
        const items = projectData.current.items.map(i => ({
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
        }));
        return JSON.stringify({ entities, items }, null, 2);
    },

    exportForUnreal: () => {
        const entities = projectData.current.entities.map(e => {
            const row = {
                Name: e.name,
                Id: e.id,
                Variance: e.variance || 0,
                EquippedItemIds: projectData.current.items.filter(i => i.targets.includes(e.id)).map(i => i.id).join(',')
            };
            projectData.current.gameRules.stats.forEach(s => {
                const statName = s.toLowerCase();
                row[`${statName}_Base`] = e.stats[s]?.b || 0;
                row[`${statName}_Growth`] = e.stats[s]?.g || 0;
            });
            return row;
        });
        const items = projectData.current.items.map(i => {
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
        return JSON.stringify({ Entities: entities, Items: items }, null, 2);
    }
};

module.exports = DM;
