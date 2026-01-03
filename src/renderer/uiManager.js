const DM = require('./dataManager');

const TRAIT_OPTIONS = {
    triggers: [
        { val: 'OnAttackHit', text: 'On Hit (적중 시)' },
        { val: 'OnBeforeAttack', text: 'Before Atk (공격 전)' },
        { val: 'OnDamageTaken', text: 'On Hit Taken (피격 시)' },
        { val: 'OnEvasion', text: 'On Evasion (회피 성공 시)' },
        { val: 'OnCritical', text: 'On Critical (치명타 발동 시)' },
        { val: 'OnTurnStart', text: 'Turn Start (턴 시작)' },
        { val: 'OnTurnEnd', text: 'Turn End (턴 종료)' },
        { val: 'OnBattleStart', text: 'Battle Start (전투 시작)' }
    ],
    conditions: [
        { val: 'Chance', text: 'Chance (%)' },
        { val: 'HpLessThen', text: 'HP < (%)' },
        { val: 'Always', text: 'Always (조건 없음)' }
    ],
    effects: [
        { val: 'Heal', text: 'Heal HP' },
        { val: 'ModifyDamage', text: 'Dmg Modifier (뎀증)' },
        { val: 'BuffStat', text: 'Buff Stat (스탯증가)' },
        { val: 'DealDamage', text: 'Deal Dmg (추가타)' }
    ],
    targets: [
        { val: 'Self', text: 'Self (자신)' },
        { val: 'Enemy', text: 'Enemy (상대)' }
    ],
    valTypes: [
        { val: 'Fixed', text: 'Fixed Val' },
        { val: 'PercentOfDamage', text: '% of Dmg' }
    ],
    ops: [
        { val: 'multiply', text: 'x (Mult)' },
        { val: 'add', text: '+ (Add)' }
    ]
};

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
    if (!ent.attackType) ent.attackType = 'Melee';
    const isLocked = ent.isLocked === true;
    const disabledAttr = isLocked ? 'disabled' : '';
    const lockIcon = isLocked ? '🔒' : '🔓';
    const lockClass = isLocked ? 'locked' : '';
    const bgStyle = isLocked ? 'background-color: #2a2a2a; border: 1px solid #444;' : '';
    
    const typeIcon = ent.attackType === 'Ranged' ? '🏹' : '⚔️';
    const typeTitle = ent.attackType === 'Ranged' ? 'Ranged (원거리)' : 'Melee (근거리)';
    
    const rules = DM.getRules();
    let statsHtml = '';
    rules.stats.forEach(s => {
        const d = ent.stats[s] || {b:0, g:0};
        const desc = rules.descriptions && rules.descriptions[s] ? rules.descriptions[s] : s.toUpperCase();
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
                <button class="type-btn" title="${typeTitle}" style="background:none; border:1px solid #444; border-radius:4px; cursor:pointer; font-size:1.1em; padding:0 4px; color:#ddd;" ${disabledAttr}>${typeIcon}</button>
                <input type="color" value="${ent.color}" data-key="color" class="prop-input" ${disabledAttr}>
                <input type="text" value="${ent.name}" data-key="name" class="prop-input" style="font-weight:bold; width:90px;" ${disabledAttr}>
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
        const typeBtn = card.querySelector('.type-btn');
        typeBtn.addEventListener('click', () => { 
            ent.attackType = ent.attackType === 'Melee' ? 'Ranged' : 'Melee'; 
            
            typeBtn.innerText = ent.attackType === 'Ranged' ? '🏹' : '⚔️';
            typeBtn.title = ent.attackType === 'Ranged' ? 'Ranged (원거리)' : 'Melee (근거리)';
            
            callbacks.onInput(); 
        });

        card.querySelector('.delete-btn').addEventListener('click', () => callbacks.onDelete(index));
        card.querySelectorAll('.prop-input').forEach(el => { attachChangeHandlers(el, (e) => { const key = e.target.dataset.key; ent[key] = getSafeVal(e.target); callbacks.onInput(); }, (oldVal, newVal) => { callbacks.onCommit(el.dataset.key, oldVal, newVal); }); });
        card.querySelectorAll('.stat-input').forEach(el => { attachChangeHandlers(el, (e) => { const s = e.target.dataset.stat; const t = e.target.dataset.type; if(!ent.stats[s]) ent.stats[s] = {b:0,g:0}; ent.stats[s][t] = getSafeVal(e.target); callbacks.onInput(); }, (oldVal, newVal) => { const s = el.dataset.stat; const t = el.dataset.type; callbacks.onStatCommit(ent.stats[s], t, parseFloat(oldVal), parseFloat(newVal)); }); });
    }
    container.appendChild(card);
}

function renderItemCard(item, index, container, callbacks) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.style.opacity = item.active ? '1' : '0.5';
    const ruleStats = DM.getRules().stats;
    let modHtml = '';
    item.modifiers.forEach((mod, midx) => {
        let opts = ruleStats.map(s => `<option value="${s}" ${mod.stat===s?'selected':''}>${s.toUpperCase()}</option>`).join('');
        modHtml += `<div class="item-stat-row"><select class="dark-select mod-input" data-key="stat" data-idx="${midx}" style="width:70px;">${opts}</select><select class="dark-select mod-input" data-key="op" data-idx="${midx}" style="width:50px;"><option value="add" ${mod.op==='add'?'selected':''}>+</option><option value="mult" ${mod.op==='mult'?'selected':''}>×</option></select><input type="number" class="mod-input" data-key="val" data-idx="${midx}" value="${mod.val}" data-type="numberVal" style="width:50px;"><button class="remove-stat-btn" data-idx="${midx}">-</button></div>`;
    });
    let targetHtml = '';
    DM.getEntities().forEach(ent => {
        targetHtml += `<label class="target-checkbox" style="border-left:3px solid ${ent.color}"><input type="checkbox" class="target-select" data-ent-id="${ent.id}" ${item.targets.includes(ent.id)?'checked':''}><span>${ent.name}</span></label>`;
    });
    if (!item.traits) item.traits = [];
    let traitsHtml = '';
    item.traits.forEach((trait, tIdx) => {
        const trigger = trait.triggers[0]; 
        const condition = (trigger && trigger.conditions && trigger.conditions[0]) ? trigger.conditions[0] : { type: 'Always', value: 0 };
        const effect = (trigger && trigger.effects && trigger.effects[0]) ? trigger.effects[0] : { type: 'Heal', value: 0, target: 'Self' };
        const createOpts = (list, selected) => list.map(o => `<option value="${o.val}" ${o.val===selected?'selected':''}>${o.text}</option>`).join('');
        const createStatOpts = (selected) => ruleStats.map(s => `<option value="${s}" ${s===selected?'selected':''}>${s.toUpperCase()}</option>`).join('');
        const showOp = effect.type === 'ModifyDamage' ? 'block' : 'none';
        const showValType = (effect.type === 'ModifyDamage' || effect.type === 'BuffStat') ? 'none' : 'block';
        const showStat = effect.type === 'BuffStat' ? 'block' : 'none';
        const showDuration = effect.type === 'BuffStat' ? 'block' : 'none';

        traitsHtml += `<div class="trait-row" style="background:#1e1e1e; padding:5px; border-radius:4px; margin-bottom:5px; border:1px solid #333;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px; border-bottom:1px solid #333; padding-bottom:2px;">
                <input type="text" class="trait-name-input" data-idx="${tIdx}" value="${trait.name || 'Effect'}" style="width:120px; font-weight:bold; border:none; background:none; color:#ddd; font-size:0.9em;" placeholder="Name">
                <button class="remove-trait-btn" data-idx="${tIdx}" style="color:#e74c3c; background:none; border:none; cursor:pointer;">✕</button>
            </div>
            <div style="display:flex; gap:5px; margin-bottom:4px; align-items:center;"><span style="color:#5fabff; font-size:0.8em; width:30px; text-align:right;">When</span><select class="dark-select trait-select" data-idx="${tIdx}" data-role="trigger" style="flex:1;">${createOpts(TRAIT_OPTIONS.triggers, trigger.type)}</select></div>
            <div style="display:flex; gap:5px; margin-bottom:4px; align-items:center;"><span style="color:#d29922; font-size:0.8em; width:30px; text-align:right;">If</span><select class="dark-select trait-select" data-idx="${tIdx}" data-role="condType" style="flex:1;">${createOpts(TRAIT_OPTIONS.conditions, condition.type)}</select><input type="number" class="trait-input" data-idx="${tIdx}" data-role="condVal" value="${condition.value}" style="width:50px;" placeholder="Val"></div>
            <div style="display:flex; gap:5px; align-items:center;"><span style="color:#2da44e; font-size:0.8em; width:30px; text-align:right;">Do</span><select class="dark-select trait-select" data-idx="${tIdx}" data-role="effType" style="width:85px;">${createOpts(TRAIT_OPTIONS.effects, effect.type)}</select><select class="dark-select trait-select" data-idx="${tIdx}" data-role="effTarget" style="width:60px;">${createOpts(TRAIT_OPTIONS.targets, effect.target)}</select></div>
            <div style="display:flex; gap:5px; align-items:center; margin-top:2px; padding-left:35px;">
                <input type="number" class="trait-input" data-idx="${tIdx}" data-role="effVal" value="${effect.value}" style="width:50px;" placeholder="Val">
                <select class="dark-select trait-select" data-idx="${tIdx}" data-role="effStat" style="flex:1; display:${showStat};">${createStatOpts(effect.stat || ruleStats[0])}</select>
                <input type="number" class="trait-input" data-idx="${tIdx}" data-role="effDuration" value="${effect.duration || 0}" style="width:60px; display:${showDuration}; border-color:#d29922;" placeholder="Turns (0:∞)" title="Duration in Turns">
                <select class="dark-select trait-select" data-idx="${tIdx}" data-role="effValType" style="flex:1; display:${showValType};">${createOpts(TRAIT_OPTIONS.valTypes, effect.valueType)}</select>
                <select class="dark-select trait-select" data-idx="${tIdx}" data-role="effOp" style="flex:1; display:${showOp};">${createOpts(TRAIT_OPTIONS.ops, effect.op)}</select>
            </div>
        </div>`;
    });
    card.innerHTML = `<div class="item-header"><div style="display:flex; gap:8px;"><input type="checkbox" class="item-toggle" ${item.active?'checked':''}>
        <input type="text" value="${item.name}" class="item-name" style="width:100px; font-weight:bold;"></div><button class="delete-item-btn">✕</button></div>
        <div class="item-stats-list">${modHtml}<button class="add-stat-btn">+ Stat Mod</button></div>
        <div class="item-traits-list" style="margin-top:10px; padding-top:5px; border-top:1px solid #3e3e42;"><label style="font-size:0.75em; color:#888;">Conditional Effects (Traits)</label>${traitsHtml}<button class="add-trait-btn" style="width:100%; background:#2f3136; border:1px dashed #555; margin-top:5px; cursor:pointer; color:#ccc;">+ Add Effect</button></div>
        <div class="item-targets"><span class="item-targets-label">Apply:</span><div class="item-targets-list">${targetHtml}</div></div>`;
    
    card.querySelector('.item-toggle').addEventListener('change', e => { item.active = e.target.checked; callbacks.onChange(); });
    attachChangeHandlers(card.querySelector('.item-name'), (e) => item.name = e.target.value, (oldVal, newVal) => callbacks.onNameCommit(oldVal, newVal));
    card.querySelector('.add-stat-btn').addEventListener('click', () => callbacks.onModAdd());
    card.querySelectorAll('.remove-stat-btn').forEach(btn => btn.addEventListener('click', e => callbacks.onModDelete(parseInt(e.target.dataset.idx))));
    card.querySelector('.delete-item-btn').addEventListener('click', () => callbacks.onDelete(index));
    card.querySelectorAll('.mod-input').forEach(el => { attachChangeHandlers(el, (e) => { const idx = parseInt(e.target.dataset.idx); item.modifiers[idx][e.target.dataset.key] = getSafeVal(e.target); callbacks.onInput(); }, (oldVal, newVal) => { const idx = parseInt(el.dataset.idx); callbacks.onModCommit(item.modifiers[idx], el.dataset.key, oldVal, newVal); }); });
    card.querySelectorAll('.target-select').forEach(el => el.addEventListener('change', e => { const id = parseInt(e.target.dataset.entId); item.targets = e.target.checked ? [...item.targets, id] : item.targets.filter(t => t !== id); callbacks.onChange(); }));
    card.querySelector('.add-trait-btn').addEventListener('click', () => { item.traits.push({ name: "New Effect", triggers: [{ type: "OnAttackHit", conditions: [{ type: "Chance", value: 50, target: "Self" }], effects: [{ type: "Heal", target: "Self", valueType: "Fixed", value: 10, op: "add" }] }] }); callbacks.onUpdate(); });
    card.querySelectorAll('.remove-trait-btn').forEach(btn => { btn.addEventListener('click', (e) => { item.traits.splice(parseInt(e.target.dataset.idx), 1); callbacks.onUpdate(); }); });
    card.querySelectorAll('.trait-name-input').forEach(el => { el.addEventListener('change', (e) => { item.traits[parseInt(e.target.dataset.idx)].name = e.target.value; callbacks.onInput(); }); });
    const updateTraitData = (el) => { const idx = parseInt(el.dataset.idx); const role = el.dataset.role; const val = getSafeVal(el); const trait = item.traits[idx]; const eff = trait.triggers[0].effects[0]; const cond = trait.triggers[0].conditions[0]; const trig = trait.triggers[0];
        switch(role) { case 'trigger': trig.type = val; break; case 'condType': cond.type = val; break; case 'condVal': cond.value = val; break; case 'effType': eff.type = val; if(val === 'BuffStat' && !eff.stat) eff.stat = DM.getRules().stats[0]; callbacks.onUpdate(); return; case 'effTarget': eff.target = val; break; case 'effVal': eff.value = val; break; case 'effValType': eff.valueType = val; break; case 'effOp': eff.op = val; break; case 'effStat': eff.stat = val; break; case 'effDuration': eff.duration = val; break; } callbacks.onInput(); };
    card.querySelectorAll('.trait-select, .trait-input').forEach(el => { el.addEventListener('change', (e) => updateTraitData(e.target)); });
    container.appendChild(card);
}

// [NEW] Bulk Grid Renderer
function renderBulkGrid(container, onSelectionChange) {
    const entities = DM.getEntities();
    const stats = DM.getRules().stats;
    
    let html = `<table class="bulk-table"><thead><tr><th><input type="checkbox" id="selectAllBulk"></th><th>Name</th>`;
    stats.forEach(s => html += `<th>${s.toUpperCase()} (Base)</th>`);
    html += `</tr></thead><tbody>`;

    entities.forEach(ent => {
        html += `<tr data-id="${ent.id}">
            <td><input type="checkbox" class="row-select" data-id="${ent.id}"></td>
            <td>${ent.name}</td>`;
        stats.forEach(s => {
            const val = ent.stats[s]?.b || 0;
            html += `<td>${val}</td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;

    // Grid Listeners
    const rows = container.querySelectorAll('tbody tr');
    const updateSelection = () => {
        const selected = Array.from(container.querySelectorAll('.row-select:checked')).map(el => parseInt(el.dataset.id));
        rows.forEach(r => {
            const isSel = selected.includes(parseInt(r.dataset.id));
            if(isSel) r.classList.add('selected'); else r.classList.remove('selected');
        });
        onSelectionChange(selected);
    };

    container.querySelectorAll('.row-select').forEach(cb => cb.addEventListener('change', updateSelection));
    container.querySelector('#selectAllBulk').addEventListener('change', (e) => {
        container.querySelectorAll('.row-select').forEach(cb => cb.checked = e.target.checked);
        updateSelection();
    });
}

module.exports = { renderEntityCard, renderItemCard, renderBulkGrid };