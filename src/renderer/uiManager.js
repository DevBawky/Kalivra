const DM = require('./dataManager');

function renderEntityCard(ent, index, container, callbacks) {
    const card = document.createElement('div');
    card.className = 'entity-card';
    
    const isLocked = ent.isLocked === true;
    const disabledAttr = isLocked ? 'disabled' : '';
    const lockIcon = isLocked ? '🔒' : '🔓';
    const lockClass = isLocked ? 'locked' : '';
    const bgStyle = isLocked ? 'background-color: #2a2a2a; border: 1px solid #444;' : '';

    let statsHtml = '';
    DM.getRules().stats.forEach(s => {
        const d = ent.stats[s] || {b:0, g:0};
        // [수정] input 이벤트 분리를 위해 data 속성 활용
        statsHtml += `<div style="display:flex; align-items:center; gap:5px; margin-bottom:5px;">
            <span style="width:40px; font-size:0.8em; font-weight:bold; color:#b9bbbe;">${s.toUpperCase()}</span>
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

    // 1. 잠금/삭제
    card.querySelector('.lock-btn').addEventListener('click', () => callbacks.onLock(index));
    if (!isLocked) {
        card.querySelector('.delete-btn').addEventListener('click', () => callbacks.onDelete(index));

        // 2. 일반 속성 (Name, Color, Variance)
        card.querySelectorAll('.prop-input').forEach(i => {
            let tempValue = i.value; // 변경 전 값 저장
            
            // 포커스 시 값 저장
            i.addEventListener('focus', (e) => { tempValue = e.target.value; });

            // 입력 중: 실시간 그래프 갱신 (Undo 없음)
            i.addEventListener('input', (e) => {
                const val = e.target.dataset.key === 'variance' ? parseFloat(e.target.value) : e.target.value;
                ent[e.target.dataset.key] = val; // 데이터는 일단 바꿈
                callbacks.onInput();
            });

            // 변경 완료: Undo 스택에 저장
            i.addEventListener('change', (e) => {
                const val = e.target.dataset.key === 'variance' ? parseFloat(e.target.value) : e.target.value;
                // 이전 값(tempValue)과 새 값(val)을 넘김
                callbacks.onCommit(e.target.dataset.key, tempValue, val);
                tempValue = val; // 갱신
            });
        });

        // 3. 스탯 입력 (Base, Grow)
        card.querySelectorAll('.stat-input').forEach(i => {
            let tempValue = parseFloat(i.value);

            i.addEventListener('focus', (e) => { tempValue = parseFloat(e.target.value); });

            i.addEventListener('input', (e) => {
                const s = e.target.dataset.stat;
                const t = e.target.dataset.type;
                if(!ent.stats[s]) ent.stats[s] = {b:0,g:0};
                ent.stats[s][t] = parseFloat(e.target.value);
                callbacks.onInput();
            });

            i.addEventListener('change', (e) => {
                const s = e.target.dataset.stat;
                const t = e.target.dataset.type;
                const newVal = parseFloat(e.target.value);
                // 스탯 전용 커밋 호출
                callbacks.onStatCommit(ent.stats[s], t, tempValue, newVal);
                tempValue = newVal;
            });
        });
    }
    container.appendChild(card);
}

// 아이템 카드는 기존 로직 유지 (복잡도 낮음)
function renderItemCard(item, index, container, callbacks) {
    // ... (기존 renderItemCard 코드 그대로 사용) ...
    // 단, 여기서 item.name 같은걸 바꿀때도 Undo를 넣고 싶다면 위와 같은 로직이 필요하지만,
    // 일단 엔티티 Undo가 급하므로 기존 코드 사용.
    // 삭제 버튼은 renderer.js에서 처리하므로 여기는 버튼 이벤트만 연결하면 됨.
    
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
    
    // [중요] 삭제 버튼
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