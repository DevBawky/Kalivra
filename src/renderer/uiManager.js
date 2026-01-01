const DM = require('./dataManager');

// [헬퍼] 값 안전하게 읽기 (숫자 필드는 float 변환, 나머지는 문자열)
const getSafeVal = (el) => {
    if (el.type === 'number' || el.dataset.type === 'numberVal') {
        return parseFloat(el.value) || 0;
    }
    return el.value;
};

// [헬퍼] 변경 감지 및 커밋 로직 (Focus 의존성 제거)
const attachChangeHandlers = (element, onInput, onCommit) => {
    // 1. 렌더링 시점의 값을 'data-prev'에 저장 (초기값 기억)
    element.dataset.prev = getSafeVal(element);

    // 2. 입력 중 (실시간 그래프 갱신용)
    element.addEventListener('input', (e) => {
        if (onInput) onInput(e);
    });

    // 3. 변경 완료 (Undo 기록용)
    // 드랍다운 변경, 엔터 입력, 포커스 아웃, 스피너 클릭 시 모두 'change'가 발생함
    element.addEventListener('change', (e) => {
        const oldVal = element.type === 'number' ? parseFloat(element.dataset.prev) : element.dataset.prev;
        const newVal = getSafeVal(element);

        // 값이 실제로 변했을 때만 커밋
        // (숫자와 문자열 비교 문제를 피하기 위해 == 사용하거나 형변환 주의)
        if (String(oldVal) !== String(newVal)) {
            if (onCommit) onCommit(oldVal, newVal);
            
            // 커밋 후 현재 값을 새로운 '이전 값'으로 갱신
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

    let statsHtml = '';
    DM.getRules().stats.forEach(s => {
        const d = ent.stats[s] || {b:0, g:0};
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

    card.querySelector('.lock-btn').addEventListener('click', () => callbacks.onLock(index));

    if (!isLocked) {
        card.querySelector('.delete-btn').addEventListener('click', () => callbacks.onDelete(index));

        // [수정] 일반 속성 (이름, 색상, 분산도)
        card.querySelectorAll('.prop-input').forEach(el => {
            attachChangeHandlers(el, 
                // Input Handler
                (e) => {
                    const key = e.target.dataset.key;
                    ent[key] = getSafeVal(e.target);
                    callbacks.onInput();
                },
                // Commit Handler
                (oldVal, newVal) => {
                    callbacks.onCommit(el.dataset.key, oldVal, newVal);
                }
            );
        });

        // [수정] 스탯 속성 (Base, Grow)
        card.querySelectorAll('.stat-input').forEach(el => {
            attachChangeHandlers(el,
                // Input
                (e) => {
                    const s = e.target.dataset.stat;
                    const t = e.target.dataset.type;
                    if(!ent.stats[s]) ent.stats[s] = {b:0,g:0};
                    ent.stats[s][t] = getSafeVal(e.target);
                    callbacks.onInput();
                },
                // Commit
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

    // 이벤트 연결
    card.querySelector('.item-toggle').addEventListener('change', e => { 
        item.active = e.target.checked; 
        callbacks.onChange(); 
    });

    // 아이템 이름
    attachChangeHandlers(card.querySelector('.item-name'),
        (e) => item.name = e.target.value,
        (oldVal, newVal) => callbacks.onNameCommit(oldVal, newVal)
    );

    // 버튼 이벤트
    card.querySelector('.add-stat-btn').addEventListener('click', () => callbacks.onModAdd());
    card.querySelectorAll('.remove-stat-btn').forEach(btn => {
        btn.addEventListener('click', e => callbacks.onModDelete(parseInt(e.target.dataset.idx)));
    });
    card.querySelector('.delete-item-btn').addEventListener('click', () => callbacks.onDelete(index));
    
    // [중요] 아이템 Modifier 입력 (Select 드롭다운 + Input 스피너 포함)
    // attachChangeHandlers를 사용하여 렌더링 시점에 값을 저장하므로
    // 포커스 없이 값을 바꾸는(드롭다운, 스피너) 동작도 정상적으로 Undo가 기록됩니다.
    card.querySelectorAll('.mod-input').forEach(el => {
        attachChangeHandlers(el,
            // Input (실시간 반영)
            (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const key = e.target.dataset.key;
                item.modifiers[idx][key] = getSafeVal(e.target);
                callbacks.onInput();
            },
            // Commit (Undo 기록)
            (oldVal, newVal) => {
                const idx = parseInt(el.dataset.idx);
                const key = el.dataset.key;
                // 이전 값(oldVal)과 현재 값(newVal)을 확실하게 전달
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