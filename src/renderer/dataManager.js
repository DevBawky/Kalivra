let entities = [
    { id: 1, name: 'Warrior', color: '#007acc', variance: 0.1, stats: { hp: {b: 200, g: 20}, atk: {b: 20, g: 2}, def: {b: 10, g: 1}, aspd: {b: 1.0, g: 0}, eva: {b: 5, g: 0} } },
    { id: 2, name: 'Assassin', color: '#ff5555', variance: 0.2, stats: { hp: {b: 120, g: 10}, atk: {b: 15, g: 1.5}, def: {b: 2, g: 0.2}, aspd: {b: 2.0, g: 0.05}, eva: {b: 20, g: 0.5} } }
];
let items = [];
let gameRules = {
    stats: ['hp', 'atk', 'def', 'aspd', 'eva'],
    dmgFormula: 'atk * (100 / (100 + def))',
    cpFormula: 'atk * aspd * 10 + hp * 0.5 + def * 1.5 + eva * 2'
};

module.exports = {
    getEntities: () => entities,
    getItems: () => items,
    getRules: () => gameRules,
    setEntities: (data) => entities = data,
    setItems: (data) => items = data,
    setRules: (data) => gameRules = data,
    addEntity: (ent) => entities.push(ent),
    removeEntity: (idx) => entities.splice(idx, 1),
    addItem: (item) => items.push(item),
    removeItem: (idx) => items.splice(idx, 1)
};