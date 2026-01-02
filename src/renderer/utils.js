function initResizer(resizer, target, direction, onResize) {
    let start = 0, size = 0;
    const isV = direction === 'vertical';

    resizer.addEventListener('mousedown', (e) => {
        start = isV ? e.clientY : e.clientX;
        size = parseInt(window.getComputedStyle(target)[isV ? 'height' : 'width'], 10);
        document.body.classList.add(isV ? 'resizing-v' : 'resizing');
        resizer.classList.add('active');
        
        const move = (ev) => {
            const diff = (isV ? ev.clientY : ev.clientX) - start;
            if (isV) target.style.height = `${size - diff}px`;
            else target.style.width = `${size + (direction === 'left' ? diff : -diff)}px`;
            if (onResize) onResize();
        };
        const up = () => {
            document.body.classList.remove(isV ? 'resizing-v' : 'resizing');
            resizer.classList.remove('active');
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
    });
}
module.exports = { initResizer };