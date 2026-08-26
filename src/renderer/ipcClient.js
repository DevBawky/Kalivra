if (typeof window === 'undefined' || !window.kalivra) {
    throw new Error('Kalivra preload API is unavailable.');
}

module.exports = window.kalivra;
