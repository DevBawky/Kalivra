class CommandManager {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
    }

    execute(command) {
        this.assertCommand(command);
        command.execute();
        this.undoStack.push(command);
        this.redoStack.length = 0;
    }

    undo() {
        const command = this.undoStack.pop();
        if (!command) return false;
        try {
            command.undo();
            this.redoStack.push(command);
            return true;
        } catch (error) {
            this.undoStack.push(command);
            throw error;
        }
    }

    redo() {
        const command = this.redoStack.pop();
        if (!command) return false;
        try {
            command.execute();
            this.undoStack.push(command);
            return true;
        } catch (error) {
            this.redoStack.push(command);
            throw error;
        }
    }

    clear() {
        this.undoStack.length = 0;
        this.redoStack.length = 0;
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    assertCommand(command) {
        if (!command || typeof command.execute !== 'function' || typeof command.undo !== 'function') {
            throw new TypeError('A command must implement execute() and undo().');
        }
    }
}

module.exports = { CommandManager };
