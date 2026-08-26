function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

class SetPropertyCommand {
    constructor(target, property, oldValue, newValue, onChange) {
        this.target = target;
        this.property = property;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.onChange = onChange;
    }

    apply(value) {
        this.target[this.property] = value;
        if (this.onChange) this.onChange();
    }

    execute() { this.apply(this.newValue); }
    undo() { this.apply(this.oldValue); }
}

class AppendToCollectionCommand {
    constructor(collection, value, onChange) {
        this.collection = collection;
        this.value = value;
        this.index = collection.length;
        this.onChange = onChange;
    }

    execute() {
        this.collection.splice(this.index, 0, this.value);
        if (this.onChange) this.onChange();
    }

    undo() {
        this.collection.splice(this.index, 1);
        if (this.onChange) this.onChange();
    }
}

class RemoveFromCollectionCommand {
    constructor(collection, index, onChange) {
        this.collection = collection;
        this.index = index;
        this.removed = undefined;
        this.onChange = onChange;
    }

    execute() {
        [this.removed] = this.collection.splice(this.index, 1);
        if (this.onChange) this.onChange();
    }

    undo() {
        this.collection.splice(this.index, 0, this.removed);
        if (this.onChange) this.onChange();
    }
}

class ReplaceAtIndexCommand {
    constructor(collection, index, oldValue, newValue, onChange) {
        this.collection = collection;
        this.index = index;
        this.oldValue = clone(oldValue);
        this.newValue = clone(newValue);
        this.onChange = onChange;
    }

    apply(value) {
        this.collection[this.index] = clone(value);
        if (this.onChange) this.onChange();
    }

    execute() { this.apply(this.newValue); }
    undo() { this.apply(this.oldValue); }
}

class ReplaceValueCommand {
    constructor(accessor, newValue, onChange) {
        if (!accessor || typeof accessor.read !== 'function' || typeof accessor.write !== 'function') {
            throw new TypeError('ReplaceValueCommand requires read and write functions.');
        }
        this.accessor = accessor;
        this.oldValue = clone(accessor.read());
        this.newValue = clone(newValue);
        this.onChange = onChange;
    }

    apply(value) {
        this.accessor.write(clone(value));
        if (this.onChange) this.onChange();
    }

    execute() { this.apply(this.newValue); }
    undo() { this.apply(this.oldValue); }
}

class BulkStatChangeCommand {
    constructor(entities, ids, stat, operation, value, onChange) {
        if (!['set', 'add', 'mult'].includes(operation)) throw new TypeError(`Unsupported bulk operation: ${operation}`);
        if (!Number.isFinite(value)) throw new TypeError('Bulk value must be finite.');
        this.entities = entities;
        this.ids = new Set(ids);
        this.stat = stat;
        this.operation = operation;
        this.value = value;
        this.history = [];
        this.onChange = onChange;
    }

    execute() {
        this.history = [];
        this.entities.forEach(entity => {
            if (!this.ids.has(entity.id)) return;
            const hadStat = Object.prototype.hasOwnProperty.call(entity.stats, this.stat);
            if (!entity.stats[this.stat]) entity.stats[this.stat] = { b: 0, g: 0 };
            const oldValue = Number(entity.stats[this.stat].b) || 0;
            let newValue = this.value;
            if (this.operation === 'add') newValue = oldValue + this.value;
            if (this.operation === 'mult') newValue = oldValue * this.value;
            this.history.push({ entity, oldValue, hadStat });
            entity.stats[this.stat].b = Number(newValue.toFixed(2));
        });
        if (this.onChange) this.onChange();
    }

    undo() {
        this.history.forEach(({ entity, oldValue, hadStat }) => {
            if (hadStat) entity.stats[this.stat].b = oldValue;
            else delete entity.stats[this.stat];
        });
        if (this.onChange) this.onChange();
    }
}

module.exports = {
    AppendToCollectionCommand,
    BulkStatChangeCommand,
    RemoveFromCollectionCommand,
    ReplaceAtIndexCommand,
    ReplaceValueCommand,
    SetPropertyCommand
};
