// 데이터 저장소
let entities = [];
let items = [];
let gameRules = {
    stats: ['hp', 'atk', 'def', 'aspd', 'eva'],
    dmgFormula: 'atk * (100 / (100 + def))',
    cpFormula: 'atk * aspd * 10 + hp * 0.5 + def * 1.5 + eva * 2'
};

// ==========================================
// Command Pattern for Undo/Redo
// ==========================================
class CommandManager {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
    }

    execute(command) {
        command.execute();
        this.undoStack.push(command);
        this.redoStack = []; // 새 명령 실행 시 Redo 스택 초기화
    }

    undo() {
        const command = this.undoStack.pop();
        if (command) {
            command.undo();
            this.redoStack.push(command);
            return true;
        }
        return false;
    }

    redo() {
        const command = this.redoStack.pop();
        if (command) {
            command.execute();
            this.undoStack.push(command);
            return true;
        }
        return false;
    }
}


class DeleteItemCommand {
    constructor(listArray, index, uiCallback) {
        this.listArray = listArray;
        this.index = index;
        this.uiCallback = uiCallback;
        this.deletedItem = null;
    }

    execute() {
        // 인덱스 유효성 검사 강화
        if (this.index !== undefined && this.index >= 0 && this.index < this.listArray.length) {
            this.deletedItem = this.listArray.splice(this.index, 1)[0];
            if (this.uiCallback) this.uiCallback();
        } else {
            console.error("삭제 실패: 잘못된 인덱스입니다.", this.index);
        }
    }

    undo() {
        if (this.deletedItem) {
            this.listArray.splice(this.index, 0, this.deletedItem);
            if (this.uiCallback) this.uiCallback();
        }
    }
}

const commandManager = new CommandManager();

module.exports = {
    getEntities: () => entities,
    getItems: () => items,
    getRules: () => gameRules,

    // [Load / Init]
    setEntities: (data) => { entities = data || []; },
    setItems: (data) => { items = data || []; },
    setRules: (data) => { if(data) gameRules = data; },

    // [Entity CRUD]
    addEntity: (ent) => entities.push(ent),
    removeEntity: (idx) => entities.splice(idx, 1),
    
    // [Item CRUD with Undo]
    addItem: (item) => items.push(item),
    
    // 아이템 삭제 시 이 함수를 호출 (UI에서 uiRefreshFunc를 넘겨줘야 함)
    removeItemWithUndo: (idx, uiRefreshFunc) => {
        const cmd = new DeleteItemCommand(items, idx, uiRefreshFunc);
        commandManager.execute(cmd);
    },

    // Undo/Redo 노출
    undo: () => commandManager.undo(),
    redo: () => commandManager.redo()
};