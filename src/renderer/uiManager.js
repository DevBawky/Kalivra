const DM = require('./dataManager');

const getSafeVal = (el) => {
    if (el.type === 'number' || el.dataset.type === 'numberVal') {
        return parseFloat(el.value) || 0;
    }
    return el.value;
};

const attachChangeHandlers = (element, onInput, onCommit) => {
    element.dataset.prev = getSafeVal(element);
    element.addEventListener('input', (e) => { if (onInput) onInput(e); });
    element.addEventListener('change', (e) => {
        const oldVal = element.type === 'number' ? parseFloat(element.dataset.prev) : element.dataset.prev;
        const newVal = getSafeVal(element);
        if (String(oldVal) !== String(newVal)) {
            if (onCommit) onCommit(oldVal, newVal);
            element.dataset.prev = newVal;
        }
    });
};

function renderEntityCard(ent, index, container, callbacks) {
    const card = document.createElement('div');
    card.className = 'entity-card';
    
    const isLocked = ent.isLocked === true;
    const disabledAttr = isLocked ? 'disabled' : '';
    const lockIcon = isLocked ? '🔒' : '🔓';
    const lockClass = isLocked ? 'locked' : '';
    const bgStyle = isLocked ? 'background-color: #2a2a2a; border: 1px solid #444;' : '';

    const rules = DM.getRules(); // 규칙 가져오기

    let statsHtml = '';
    rules.stats.forEach(s => {
        const d = ent.stats[s] || {b:0, g:0};
        
        // [추가] 설명이 있으면 가져오고, 없으면 스탯 이름 그대로 사용
        const desc = rules.descriptions && rules.descriptions[s] ? rules.descriptions[s] : s.toUpperCase();

        // [추가] span에 title 속성과 클래스(stat-label-text) 추가
        statsHtml += `<div style="display:flex; align-items:center; gap:5px; margin-bottom:5px;">
            <span class="stat-label-text" title="${desc}" style="width:40px; font-size:0.8em; font-weight:bold; color:#b9bbbe;">${s.toUpperCase()}</span>
            <input type="number" placeholder="Base" value="${d.b}" class="stat-input" data-stat="${s}" data-type="b" style="width:60px;" ${disabledAttr}>
            <input type="number" placeholder="Grow" value="${d.g}" class="stat-input" data-stat="${s}" data-type="g" style="width:60px;" ${disabledAttr}>
        </div>`;
    });

    card.innerHTML = `
        <div class="entity-header" style="${bgStyle}">
            <div style="display:flex; gap:5px; align-items:center;">
                <button class="lock-btn" style="background:none; border:none; cursor:pointer; font-size:1.2em;">${lockIcon}</button>
                <input type="color" value="${ent.color}" data-key="color" class="prop-input" ${disabledAttr}>
                <input type="text" value="${ent.name}" data-key="name" class="prop-input" style="font-weight:bold; width:100px;" ${disabledAttr}>
            </div>
            <button class="delete-btn" style="${isLocked ? 'display:none' : ''}">✕</button>
        </div>
        <div style="margin-bottom:5px; display:flex; gap:5px;">
            <label style="font-size:0.8em; color:#b9bbbe;">Dmg Var:</label>
            <input type="number" value="${ent.variance||0}" step="0.05" data-key="variance" class="prop-input" style="width:60px;" ${disabledAttr}>
        </div>
        <div class="entity-stats-container ${lockClass}">${statsHtml}</div>
    `;

    card.querySelector('.lock-btn').addEventListener('click', () => callbacks.onLock(index));

    if (!isLocked) {
        card.querySelector('.delete-btn').addEventListener('click', () => callbacks.onDelete(index));

        card.querySelectorAll('.prop-input').forEach(el => {
            attachChangeHandlers(el, 
                (e) => {
                    const key = e.target.dataset.key;
                    ent[key] = getSafeVal(e.target);
                    callbacks.onInput();
                },
                (oldVal, newVal) => {
                    callbacks.onCommit(el.dataset.key, oldVal, newVal);
                }
            );
        });

        card.querySelectorAll('.stat-input').forEach(el => {
            attachChangeHandlers(el,
                (e) => {
                    const s = e.target.dataset.stat;
                    const t = e.target.dataset.type;
                    if(!ent.stats[s]) ent.stats[s] = {b:0,g:0};
                    ent.stats[s][t] = getSafeVal(e.target);
                    callbacks.onInput();
                },
                (oldVal, newVal) => {
                    const s = el.dataset.stat;
                    const t = el.dataset.type;
                    callbacks.onStatCommit(ent.stats[s], t, parseFloat(oldVal), parseFloat(newVal));
                }
            );
        });
    }
    container.appendChild(card);
}

function renderItemCard(item, index, container, callbacks) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.style.opacity = item.active ? '1' : '0.5';

    let targetHtml = '';
    DM.getEntities().forEach(ent => {
        targetHtml += `<label class="target-checkbox" style="border-left:3px solid ${ent.color}">
            <input type="checkbox" class="target-select" data-ent-id="${ent.id}" ${item.targets.includes(ent.id)?'checked':''}><span>${ent.name}</span></label>`;
    });

    let modHtml = '';
    item.modifiers.forEach((mod, midx) => {
        let opts = DM.getRules().stats.map(s => `<option value="${s}" ${mod.stat===s?'selected':''}>${s.toUpperCase()}</option>`).join('');
        modHtml += `<div class="item-stat-row">
            <select class="dark-select mod-input" data-key="stat" data-idx="${midx}" style="width:70px;">${opts}</select>
            <select class="dark-select mod-input" data-key="op" data-idx="${midx}" style="width:50px;"><option value="add" ${mod.op==='add'?'selected':''}>+</option><option value="mult" ${mod.op==='mult'?'selected':''}>×</option></select>
            <input type="number" class="mod-input" data-key="val" data-idx="${midx}" value="${mod.val}" data-type="numberVal" style="width:50px;">
            <button class="remove-stat-btn" data-idx="${midx}">-</button>
        </div>`;
    });

    card.innerHTML = `
        <div class="item-header"><div style="display:flex; gap:8px;"><input type="checkbox" class="item-toggle" ${item.active?'checked':''}>
        <input type="text" value="${item.name}" class="item-name" style="width:100px; font-weight:bold;"></div><button class="delete-item-btn">✕</button></div>
        <div class="item-stats-list">${modHtml}<button class="add-stat-btn">+ Add Stat</button></div>
        <div class="item-targets"><span class="item-targets-label">Apply:</span><div class="item-targets-list">${targetHtml}</div></div>
    `;

    card.querySelector('.item-toggle').addEventListener('change', e => { 
        item.active = e.target.checked; 
        callbacks.onChange(); 
    });

    attachChangeHandlers(card.querySelector('.item-name'),
        (e) => item.name = e.target.value,
        (oldVal, newVal) => callbacks.onNameCommit(oldVal, newVal)
    );

    card.querySelector('.add-stat-btn').addEventListener('click', () => callbacks.onModAdd());
    card.querySelectorAll('.remove-stat-btn').forEach(btn => {
        btn.addEventListener('click', e => callbacks.onModDelete(parseInt(e.target.dataset.idx)));
    });
    card.querySelector('.delete-item-btn').addEventListener('click', () => callbacks.onDelete(index));
    
    card.querySelectorAll('.mod-input').forEach(el => {
        attachChangeHandlers(el,
            (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const key = e.target.dataset.key;
                item.modifiers[idx][key] = getSafeVal(e.target);
                callbacks.onInput();
            },
            (oldVal, newVal) => {
                const idx = parseInt(el.dataset.idx);
                const key = el.dataset.key;
                callbacks.onModCommit(item.modifiers[idx], key, oldVal, newVal);
            }
        );
    });

    card.querySelectorAll('.target-select').forEach(el => el.addEventListener('change', e => {
        const id = parseInt(e.target.dataset.entId);
        item.targets = e.target.checked ? [...item.targets, id] : item.targets.filter(t => t !== id);
        callbacks.onChange();
    }));

    container.appendChild(card);
}

module.exports = { renderEntityCard, renderItemCard };