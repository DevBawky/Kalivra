function createMonotonicIdGenerator(clock = Date.now) {
    let lastId = 0;
    return () => {
        const current = Number(clock());
        if (!Number.isFinite(current)) throw new TypeError('Clock must return a finite number.');
        lastId = Math.max(Math.trunc(current), lastId + 1);
        return lastId;
    };
}

module.exports = { createMonotonicIdGenerator };
