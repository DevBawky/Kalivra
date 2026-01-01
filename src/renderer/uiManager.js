const DM = require('./dataManager');

function renderEntityCard(ent, index, container, callbacks) {
    const card = document.createElement('div');
    card.className = 'entity-card';
    let statsHtml = '';
    DM.getRules().stats.forEach(s => {
        const d = ent.stats[s] || {b:0, g:0};
        statsHtml += `<div style="display:flex; align-items:center; gap:5px; margin-bottom:5px;">
            <span style="width:40px; font-size:0.8em; font-weight:bold; color:#b9bbbe;">${s.toUpperCase()}</span>
            <input type="number" placeholder="Base" value="${d.b}" class="stat-input" data-stat="${s}" data-type="b" style="width:60px;">
            <input type="number" placeholder="Grow" value="${d.g}" class="stat-input" data-stat="${s}" data-type="g" style="width:60px;">
        </div>`;
    });

    card.innerHTML = `
        <div class="entity-header">
            <input type="color" value="${ent.color}" data-key="color">
            <input type="text" value="${ent.name}" data-key="name" style="font-weight:bold;">
            <button class="delete-btn">✕</button>
        </div>
        <div style="margin-bottom:5px; display:flex; gap:5px;"><label style="font-size:0.8em; color:#b9bbbe;">Dmg Var:</label><input type="number" value="${ent.variance||0}" step="0.05" data-key="variance" style="width:60px;"></div>
        <div class="entity-stats-container">${statsHtml}</div>
    `;

    card.querySelectorAll('input[data-key]').forEach(i => i.addEventListener('input', e => {
        ent[e.target.dataset.key] = e.target.dataset.key === 'variance' ? parseFloat(e.target.value) : e.target.value;
        callbacks.onChange();
    }));
    card.querySelectorAll('.stat-input').forEach(i => i.addEventListener('input', e => {
        if(!ent.stats[e.target.dataset.stat]) ent.stats[e.target.dataset.stat] = {b:0,g:0};
        ent.stats[e.target.dataset.stat][e.target.dataset.type] = parseFloat(e.target.value);
        callbacks.onChange();
    }));
    card.querySelector('.delete-btn').addEventListener('click', () => callbacks.onDelete(index));
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
            <select class="dark-select mod-stat" data-idx="${midx}" style="width:70px;">${opts}</select>
            <select class="dark-select mod-op" data-idx="${midx}" style="width:50px;"><option value="add" ${mod.op==='add'?'selected':''}>+</option><option value="mult" ${mod.op==='mult'?'selected':''}>×</option></select>
            <input type="number" class="mod-val" data-idx="${midx}" value="${mod.val}" style="width:50px;">
            <button class="remove-stat-btn" data-idx="${midx}">-</button>
        </div>`;
    });

    card.innerHTML = `
        <div class="item-header"><div style="display:flex; gap:8px;"><input type="checkbox" class="item-toggle" ${item.active?'checked':''}>
        <input type="text" value="${item.name}" class="item-name" style="width:100px; font-weight:bold;"></div><button class="delete-item-btn">✕</button></div>
        <div class="item-stats-list">${modHtml}<button class="add-stat-btn">+ Add Stat</button></div>
        <div class="item-targets"><span class="item-targets-label">Apply:</span><div class="item-targets-list">${targetHtml}</div></div>
    `;

    card.querySelector('.item-toggle').addEventListener('change', e => { item.active = e.target.checked; callbacks.onChange(); });
    card.querySelector('.item-name').addEventListener('input', e => item.name = e.target.value);
    card.querySelector('.add-stat-btn').addEventListener('click', () => { item.modifiers.push({stat:DM.getRules().stats[0], op:'add', val:0}); callbacks.onUpdate(); });
    card.querySelector('.delete-item-btn').addEventListener('click', () => callbacks.onDelete(index));
    
    card.querySelectorAll('.mod-stat').forEach(el => el.addEventListener('change', e => { item.modifiers[e.target.dataset.idx].stat = e.target.value; callbacks.onChange(); }));
    card.querySelectorAll('.mod-op').forEach(el => el.addEventListener('change', e => { item.modifiers[e.target.dataset.idx].op = e.target.value; callbacks.onChange(); }));
    card.querySelectorAll('.mod-val').forEach(el => el.addEventListener('input', e => { item.modifiers[e.target.dataset.idx].val = parseFloat(e.target.value); callbacks.onChange(); }));
    card.querySelectorAll('.remove-stat-btn').forEach(el => el.addEventListener('click', e => { item.modifiers.splice(e.target.dataset.idx, 1); callbacks.onUpdate(); }));
    
    card.querySelectorAll('.target-select').forEach(el => el.addEventListener('change', e => {
        const id = parseInt(e.target.dataset.entId);
        item.targets = e.target.checked ? [...item.targets, id] : item.targets.filter(t => t !== id);
        callbacks.onChange();
    }));

    container.appendChild(card);
}

module.exports = { renderEntityCard, renderItemCard };