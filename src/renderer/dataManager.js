// 전체 프로젝트 데이터 구조
let projectData = {
    meta: {
        projectName: "Untitled Project",
        author: "User",
        description: "",
        version: "1.0.0"
    },
    snapshots: [], // { name, date, data: { entities, items, rules } }
    current: {
        entities: [],
        items: [],
        gameRules: {
            stats: ['hp', 'atk', 'def', 'aspd', 'eva'],
            descriptions: {},
            dmgFormula: 'atk * (100 / (100 + def))',
            cpFormula: 'atk * aspd * 10 + hp * 0.5 + def * 1.5 + eva * 2'
        }
    }
};

// ==========================================
// Command Pattern (기존 유지)
// ==========================================
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
    // [Getter] 현재 작업중인 데이터 반환
    getEntities: () => projectData.current.entities,
    getItems: () => projectData.current.items,
    getRules: () => projectData.current.gameRules,
    
    // [Meta & Snapshot]
    getMeta: () => projectData.meta,
    setMeta: (newMeta) => { projectData.meta = { ...projectData.meta, ...newMeta }; },
    
    getSnapshots: () => projectData.snapshots,
    
    // 스냅샷 생성 (현재 상태 저장)
    createSnapshot: (name) => {
        const snapshot = {
            id: Date.now(),
            name: name || `Snapshot ${projectData.snapshots.length + 1}`,
            date: new Date().toISOString(),
            data: JSON.parse(JSON.stringify(projectData.current)) // Deep Copy
        };
        projectData.snapshots.push(snapshot);
    },
    
    // 스냅샷 불러오기 (현재 상태 덮어쓰기)
    loadSnapshot: (index) => {
        if (index >= 0 && index < projectData.snapshots.length) {
            // 현재 상태 백업 후 로드? (Undo 지원하려면 복잡해지므로 일단 덮어쓰기)
            projectData.current = JSON.parse(JSON.stringify(projectData.snapshots[index].data));
            // 로드 후 Undo 스택 초기화 권장
            commandManager.undoStack = [];
            commandManager.redoStack = [];
        }
    },

    deleteSnapshot: (index) => {
        projectData.snapshots.splice(index, 1);
    },

    // [Load / Init] - 파일 로드 시 호출
    loadProject: (data) => {
        if (data.meta && data.current) {
            // 신규 구조 로드
            projectData = data;
        } else {
            // 구버전 파일 호환성 (entities, items 등이 최상위에 있는 경우)
            projectData.current.entities = data.entities || [];
            projectData.current.items = data.items || [];
            projectData.current.gameRules = data.gameRules || projectData.current.gameRules;
            projectData.snapshots = []; // 구버전은 스냅샷 없음
        }
    },
    
    // [Save] - 파일 저장용 전체 데이터 반환
    getProjectData: () => projectData,

    // [Setter] (기존 호환성 유지)
    setEntities: (data) => { projectData.current.entities = data || []; },
    setItems: (data) => { projectData.current.items = data || []; },
    setRules: (data) => { if(data) projectData.current.gameRules = data; },

    // [CRUD Operations]
    addEntity: (ent) => projectData.current.entities.push(ent),
    removeEntity: (idx) => projectData.current.entities.splice(idx, 1),
    addItem: (item) => projectData.current.items.push(item),
    removeItemWithUndo: (idx, uiRefreshFunc) => {
        const cmd = new DeleteItemCommand(projectData.current.items, idx, uiRefreshFunc);
        commandManager.execute(cmd);
    },

    undo: () => commandManager.undo(),
    redo: () => commandManager.redo()
};