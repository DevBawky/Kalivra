const { ipcRenderer } = require('electron');

let myChart = null;

// 상태 관리: formula 필드 추가됨 (기본값: 선형 성장 공식)
let entities = [
    { 
        id: 1, 
        name: 'Warrior (Linear)', 
        base: 10, 
        growth: 5, 
        formula: 'b + (lv - 1) * g', // 기본 수식
        color: '#007acc' 
    },
    { 
        id: 2, 
        name: 'Mage (Exponential)', 
        base: 5, 
        growth: 1.1, // 지수 성장은 성장치가 작아야 함 (1.1배씩 증가)
        formula: 'b * (g ^ (lv - 1))', // 지수 수식 예시
        color: '#ff5555' 
    }
];

const dom = {
    container: document.getElementById('entityContainer'),
    maxLevel: document.getElementById('maxLevel'),
    addBtn: document.getElementById('addBtn'),
    calcBtn: document.getElementById('calcBtn'),
    exportBtn: document.getElementById('exportBtn'),
    saveBtn: document.getElementById('saveBtn'),
    loadBtn: document.getElementById('loadBtn'),
    itemContainer: document.getElementById('itemContainer'),
    addItemBtn: document.getElementById('addItemBtn')
};

// === 1. UI 렌더링 로직 (수식 입력칸 추가) ===
// === 1. UI 렌더링 로직 (고급 수식 버튼 적용) ===
function renderUI() {
    dom.container.innerHTML = '';

    // 사용할 버튼 목록 정의 (라벨: 버튼에 표시될 글자, 값: 입력될 코드)
    const tools = [
        // 1. 필수 변수 (파란색)
        { label: 'b', val: 'b', type: 'var', tooltip: 'Base (기본값)' },
        { label: 'g', val: 'g', type: 'var', tooltip: 'Growth (성장치)' },
        { label: 'lv', val: 'lv', type: 'var', tooltip: 'Level (현재레벨)' },
        
        // 2. 고급 연산 (회색) - 괄호/사칙연산 제외
        { label: '^', val: '^', type: 'math', tooltip: '거듭제곱 (Power)' },
        { label: '√', val: 'Math.sqrt(', type: 'math', tooltip: '제곱근 (Root)' },
        { label: 'log', val: 'Math.log(', type: 'math', tooltip: '로그 (Log)' },
        { label: 'max', val: 'Math.max(', type: 'math', tooltip: '최댓값 (둘 중 큰 수)' },
        { label: 'min', val: 'Math.min(', type: 'math', tooltip: '최솟값 (둘 중 작은 수)' },
        { label: 'floor', val: 'Math.floor(', type: 'math', tooltip: '내림 (소수점 버림)' }
    ];

    entities.forEach((ent, index) => {
        const card = document.createElement('div');
        card.className = 'entity-card';

        // 카드 내부 HTML 구조
        card.innerHTML = `
            <div class="entity-header">
                <input type="color" value="${ent.color}" data-key="color">
                <input type="text" value="${ent.name}" placeholder="Name" data-key="name" style="font-weight:bold;">
                <button class="delete-btn">✕</button>
            </div>
            <div class="entity-stats">
                <div style="flex:1">
                    <label style="font-size:0.8em; color:#888;">Base (b)</label>
                    <input type="number" value="${ent.base}" data-key="base">
                </div>
                <div style="flex:1">
                    <label style="font-size:0.8em; color:#888;">Growth (g)</label>
                    <input type="number" value="${ent.growth}" data-key="growth">
                </div>
            </div>
            
            <div class="entity-formula">
                <label style="font-size:0.8em; color:#888; margin-top:5px;">Formula</label>
                <input type="text" class="formula-input" value="${ent.formula}" data-key="formula" placeholder="e.g. b * (g ^ (lv-1))">
                
                <div class="formula-tools"></div>
            </div>
        `;

        // 1. 기존 입력창 이벤트 연결
        const inputs = card.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const key = e.target.getAttribute('data-key');
                const val = e.target.value;
                entities[index][key] = (key === 'base' || key === 'growth') ? parseFloat(val) : val;
            });
        });

        // 2. 툴 버튼 생성 및 이벤트 연결
        const toolContainer = card.querySelector('.formula-tools');
        const formulaInput = card.querySelector('.formula-input');

        tools.forEach(tool => {
            const btn = document.createElement('button');
            btn.className = `tool-btn ${tool.type}`; // 스타일 클래스 (var 또는 math)
            btn.innerText = tool.label;
            btn.title = tool.tooltip; // 마우스 올리면 설명 나옴

            // 버튼 클릭 시 입력창에 글자 넣기
            btn.addEventListener('click', () => {
                // 현재 커서 위치에 텍스트 삽입 (가장 중요한 UX!)
                const startPos = formulaInput.selectionStart;
                const endPos = formulaInput.selectionEnd;
                
                // setRangeText: 선택된 영역을 텍스트로 교체하거나 커서 위치에 삽입
                formulaInput.setRangeText(tool.val, startPos, endPos, 'end');
                
                // 데이터 업데이트 트리거
                entities[index].formula = formulaInput.value;
                formulaInput.focus(); // 입력 후 다시 포커스 맞춤
            });

            toolContainer.appendChild(btn);
        });

        // 3. 삭제 버튼 연결
        card.querySelector('.delete-btn').addEventListener('click', () => {
            entities.splice(index, 1);
            renderUI();
            runSimulation();
        });

        dom.container.appendChild(card);
    });
}

// === 2. 유닛 추가 로직 ===
dom.addBtn.addEventListener('click', () => {
    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16);
    entities.push({
        id: Date.now(),
        name: `New Unit`,
        base: 10,
        growth: 2,
        formula: 'b + (lv - 1) * g', // 기본은 선형 공식
        color: randomColor
    });
    renderUI();
});

// === 3. 수식 계산기 (Core Logic) ===
function calculateFormula(formulaStr, b, g, lv) {
    try {
        // 1. 유저 편의성: '^' 기호를 JS의 거듭제곱 연산자 '**'로 변경
        // 예: "lv ^ 2" -> "lv ** 2"
        let expression = formulaStr.replace(/\^/g, '**');

        // 2. Function 생성자를 이용한 샌드박스 계산
        // b, g, lv를 인자로 받고 결과를 리턴하는 함수 생성
        const func = new Function('b', 'g', 'lv', `return ${expression};`);
        
        return func(b, g, lv);
    } catch (e) {
        // 수식 오류나면 0 리턴 (앱 멈춤 방지)
        return 0;
    }
}

// === 4. 시뮬레이션 ===
function runSimulation() {
    const maxLv = parseInt(dom.maxLevel.value);
    const labels = [];
    const datasets = [];

    for (let i = 1; i <= maxLv; i++) labels.push(`Lv.${i}`);

    entities.forEach(ent => {
        let data = [];
        for (let lv = 1; lv <= maxLv; lv++) {
            // 기존의 하드코딩된 공식 대신 calculateFormula 사용
            let val = calculateFormula(ent.formula, ent.base, ent.growth, lv);
            data.push(val);
        }

        datasets.push({
            label: ent.name,
            data: data,
            borderColor: ent.color,
            backgroundColor: ent.color + '20',
            borderWidth: 2,
            tension: 0.3 // 곡선을 좀 더 부드럽게 (지수 그래프 표현 위해)
        });
    });

    renderChart(labels, datasets);
}

function renderChart(labels, datasets) {
    const ctx = document.getElementById('balanceChart').getContext('2d');
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { ticks: { color: '#ccc' }, grid: { color: '#3e3e42' } },
                y: { beginAtZero: true, ticks: { color: '#ccc' }, grid: { color: '#3e3e42' } }
            },
            plugins: {
                legend: { labels: { color: '#fff' } },
                // 요청하신 툴팁 내림차순 정렬 기능
                tooltip: {
                    itemSort: function(a, b) {
                        return b.raw - a.raw;
                    }
                }
            }
        }
    });
}


function runSimulation() {
    const maxLv = parseInt(dom.maxLevel.value);
    const labels = [];
    const datasets = [];
    
    // 분석을 위해 원본 데이터(숫자 배열)를 따로 저장할 객체
    const rawData = {}; 

    for (let i = 1; i <= maxLv; i++) labels.push(`Lv.${i}`);

    entities.forEach(ent => {
        let data = [];
        for (let lv = 1; lv <= maxLv; lv++) {
            let val = calculateFormula(ent.formula, ent.base, ent.growth, lv);
            data.push(val);
        }

        // 그래프용 데이터셋 만들기
        datasets.push({
            label: ent.name,
            data: data,
            borderColor: ent.color,
            backgroundColor: ent.color + '20',
            borderWidth: 2,
            tension: 0.3
        });

        // 분석용 원본 데이터 저장
        rawData[ent.name] = { id: ent.id, data: data, color: ent.color };
    });

    renderChart(labels, datasets);
    
    // ▼▼▼ 분석 함수 호출! ▼▼▼
    analyzeCrossovers(rawData, maxLv);
}

// === [새로 추가] 교차점 분석 함수 ===
function analyzeCrossovers(rawData, maxLv) {
    const logContainer = document.getElementById('analysisLog');
    logContainer.innerHTML = ''; // 기존 로그 초기화

    const names = Object.keys(rawData);
    if (names.length < 2) {
        logContainer.innerHTML = '<div class="log-item placeholder">Add at least 2 entities to analyze comparison.</div>';
        return;
    }

    let crossoverFound = false;

    // 모든 유닛 쌍(Pair)을 비교 (A vs B, A vs C, B vs C ...)
    for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
            const charA = names[i];
            const charB = names[j];
            const dataA = rawData[charA].data;
            const dataB = rawData[charB].data;
            const colorA = rawData[charA].color;
            const colorB = rawData[charB].color;

            // 레벨 1부터 끝까지 순회하며 순위가 바뀌는 순간 포착
            for (let k = 0; k < maxLv - 1; k++) {
                const lv = k + 1;
                
                // 현재 레벨에서의 차이 (A - B)
                const diffCurrent = dataA[k] - dataB[k];
                // 다음 레벨에서의 차이 (A - B)
                const diffNext = dataA[k+1] - dataB[k+1];

                // 부호가 바뀌었다면 교차점! (하나는 양수, 하나는 음수)
                if ((diffCurrent > 0 && diffNext < 0) || (diffCurrent < 0 && diffNext > 0)) {
                    crossoverFound = true;
                    
                    // 누가 누구를 역전했는지 판별
                    const winner = diffNext > 0 ? charA : charB;
                    const loser = diffNext > 0 ? charB : charA;
                    const winnerColor = diffNext > 0 ? colorA : colorB;

                    // 로그 한 줄 생성
                    const logItem = document.createElement('div');
                    logItem.className = 'log-item';
                    
                    // HTML로 예쁘게 표시
                    logItem.innerHTML = `
                        <span class="log-tag">CROSSOVER</span>
                        <span class="log-level">Lv.${lv} ➝ Lv.${lv+1}</span>
                        <span>: 
                            <b style="color:${winnerColor}">${winner}</b> overtakes ${loser}
                        </span>
                    `;
                    logContainer.appendChild(logItem);
                }
            }
        }
    }

    if (!crossoverFound) {
        logContainer.innerHTML = '<div class="log-item placeholder">No crossover points detected. (Hierarchy is stable)</div>';
    }
}

// ... 나머지 기존 renderChart 등 ...

// === 5. CSV 내보내기 ===
function generateCSV() {
    const maxLv = parseInt(dom.maxLevel.value);
    let header = ['Level'];
    entities.forEach(e => header.push(e.name));
    let csvContent = header.join(',') + "\n";

    for (let lv = 1; lv <= maxLv; lv++) {
        let row = [lv];
        entities.forEach(ent => {
            row.push(calculateFormula(ent.formula, ent.base, ent.growth, lv));
        });
        csvContent += row.join(',') + "\n";
    }
    return csvContent;
}

let items = [
    { 
        id: 1, 
        name: 'Iron Sword', 
        target: 'base', 
        op: 'add', 
        val: 10, 
        active: true,
        targets: []
    }
];

// === [1] 아이템 UI 렌더링 ===
function renderItemUI() {
    dom.itemContainer.innerHTML = '';

    items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.style.opacity = item.active ? '1' : '0.5';

        // 1. 유닛 선택 체크박스 HTML 생성
        let targetHtml = '';
        entities.forEach(ent => {
            // 이 아이템의 타겟 목록에 이 유닛 ID가 있는지 확인
            const isChecked = item.targets.includes(ent.id) ? 'checked' : '';
            targetHtml += `
                <label class="target-checkbox" style="border-left: 3px solid ${ent.color}">
                    <input type="checkbox" class="target-select" data-ent-id="${ent.id}" ${isChecked}>
                    <span>${ent.name}</span>
                </label>
            `;
        });

        card.innerHTML = `
            <div class="item-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" class="item-toggle" ${item.active ? 'checked' : ''}>
                    <input type="text" value="${item.name}" data-key="name" style="width:120px; font-weight:bold;">
                </div>
                <button class="delete-item-btn" style="color:#ff5555; background:none; border:none; cursor:pointer;">✕</button>
            </div>
            <div class="item-row">
                <select class="dark-select" data-key="target">
                    <option value="base" ${item.target === 'base' ? 'selected' : ''}>Base (b)</option>
                    <option value="growth" ${item.target === 'growth' ? 'selected' : ''}>Growth (g)</option>
                    <option value="final" ${item.target === 'final' ? 'selected' : ''}>Final Dmg</option>
                </select>
                <select class="dark-select" data-key="op" style="max-width: 60px;">
                    <option value="add" ${item.op === 'add' ? 'selected' : ''}>+</option>
                    <option value="mult" ${item.op === 'mult' ? 'selected' : ''}>×</option>
                </select>
                <input type="number" value="${item.val}" data-key="val" style="width: 60px;">
            </div>
            <div class="item-targets">
                <span style="font-size:0.8em; color:#888; align-self:center;">Apply to:</span>
                ${targetHtml}
            </div>
        `;

        // 이벤트 연결: 기본 입력값
        const inputs = card.querySelectorAll('input:not(.target-select), select');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                if (e.target.type === 'checkbox') {
                    items[index].active = e.target.checked;
                    renderItemUI(); 
                } else {
                    const key = e.target.getAttribute('data-key');
                    items[index][key] = (key === 'val') ? parseFloat(e.target.value) : e.target.value;
                }
                runSimulation();
            });
        });

        // 이벤트 연결: 타겟 체크박스 개별 처리
        const targetChecks = card.querySelectorAll('.target-select');
        targetChecks.forEach(chk => {
            chk.addEventListener('change', (e) => {
                const entId = parseInt(e.target.getAttribute('data-ent-id'));
                if (e.target.checked) {
                    // 체크 시 ID 추가
                    if (!items[index].targets.includes(entId)) {
                        items[index].targets.push(entId);
                    }
                } else {
                    // 해제 시 ID 제거
                    items[index].targets = items[index].targets.filter(id => id !== entId);
                }
                runSimulation();
            });
        });

        // 삭제 버튼
        card.querySelector('.delete-item-btn').addEventListener('click', () => {
            items.splice(index, 1);
            renderItemUI();
            runSimulation();
        });

        dom.itemContainer.appendChild(card);
    });
}

// === [2] 아이템 추가 버튼 ===
dom.addItemBtn.addEventListener('click', () => {
    // 기본적으로 모든 유닛을 타겟으로 설정할지, 아니면 비워둘지 결정
    // 여기서는 편의상 '모든 유닛'을 기본 타겟으로 설정합니다.
    const allEntityIds = entities.map(e => e.id);
    
    items.push({
        id: Date.now(),
        name: 'New Item',
        target: 'base',
        op: 'add',
        val: 10,
        active: true,
        targets: allEntityIds // 기본값: 전체 적용
    });
    renderItemUI();
    runSimulation();
});

// === [3] 핵심: 아이템 효과 적용 함수 (유닛 ID 확인 추가) ===
function applyItems(entId, originalBase, originalGrowth) {
    let newBase = originalBase;
    let newGrowth = originalGrowth;
    let finalMultiplier = 1.0;
    let finalFlat = 0;

    items.forEach(item => {
        if (!item.active) return;
        
        // ★ 핵심 변경점: 이 아이템의 타겟 목록에 내 ID가 없으면 무시
        if (!item.targets.includes(entId)) return;

        if (item.target === 'base') {
            if (item.op === 'add') newBase += item.val;
            if (item.op === 'mult') newBase *= item.val;
        } else if (item.target === 'growth') {
            if (item.op === 'add') newGrowth += item.val;
            if (item.op === 'mult') newGrowth *= item.val;
        } else if (item.target === 'final') {
            if (item.op === 'add') finalFlat += item.val;
            if (item.op === 'mult') finalMultiplier *= item.val;
        }
    });

    return { b: newBase, g: newGrowth, finalMult: finalMultiplier, finalAdd: finalFlat };
}


function runSimulation() {
    const maxLv = parseInt(dom.maxLevel.value);
    const labels = [];
    const datasets = [];
    const rawData = {}; 

    for (let i = 1; i <= maxLv; i++) labels.push(`Lv.${i}`);

    entities.forEach(ent => {
        let data = [];
        
        // ★ ID 전달
        const eff = applyItems(ent.id, ent.base, ent.growth);

        for (let lv = 1; lv <= maxLv; lv++) {
            let val = calculateFormula(ent.formula, eff.b, eff.g, lv);
            val = (val * eff.finalMult) + eff.finalAdd;
            data.push(val);
        }

        datasets.push({
            label: ent.name,
            data: data,
            borderColor: ent.color,
            backgroundColor: ent.color + '20',
            borderWidth: 2,
            tension: 0.3
        });
        rawData[ent.name] = { id: ent.id, data: data, color: ent.color };
    });

    renderChart(labels, datasets);
    analyzeCrossovers(rawData, maxLv);
}

// 초기화 부분에 추가
renderItemUI();

// === 이벤트 연결 ===
dom.calcBtn.addEventListener('click', runSimulation);
dom.exportBtn.addEventListener('click', () => ipcRenderer.send('export-csv', generateCSV()));
dom.saveBtn.addEventListener('click', () => {
    ipcRenderer.send('save-json', { maxLevel: dom.maxLevel.value, entities: entities });
});
dom.loadBtn.addEventListener('click', () => ipcRenderer.send('load-json'));

ipcRenderer.on('load-finished', (event, data) => {
    if(data.maxLevel) dom.maxLevel.value = data.maxLevel;
    if(data.entities) entities = data.entities;
    renderUI();
    runSimulation();
    alert('Loaded!');
});

ipcRenderer.on('export-finished', (event, msg) => alert(msg));
ipcRenderer.on('save-finished', (event, msg) => alert(msg));

// 초기 실행
renderUI();
runSimulation();