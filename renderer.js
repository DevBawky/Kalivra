const { ipcRenderer } = require('electron');

const resizerLeft = document.getElementById('resizerLeft');
const resizerRight = document.getElementById('resizerRight');
const leftSidebar = document.getElementById('leftSidebar');
const rightSidebar = document.getElementById('rightSidebar');
const resizerVertical = document.getElementById('resizerVertical');
const analysisPanel = document.getElementById('analysisPanel');

let myChart = null;

let entities = [
    { 
        id: 1, 
        name: 'Warrior (Linear)', 
        base: 10, 
        growth: 5, 
        formula: 'b + (lv - 1) * g', 
        color: '#007acc' 
    },
    { 
        id: 2, 
        name: 'Mage (Exponential)', 
        base: 5, 
        growth: 1.1, 
        formula: 'b * (g ^ (lv - 1))', 
        color: '#ff5555' 
    }
];

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

function initVerticalResizer(resizer, bottomPanel) {
    let y = 0;
    let h = 0;

    const mouseDownHandler = function (e) {
        y = e.clientY;
        const styles = window.getComputedStyle(bottomPanel);
        h = parseInt(styles.height, 10);

        document.body.classList.add('resizing-v');
        resizer.classList.add('active');

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = function (e) {
        const dy = e.clientY - y;
        const newHeight = h - dy;

        if (newHeight > 50 && newHeight < 600) {
            bottomPanel.style.height = `${newHeight}px`;
        }
        if (myChart) myChart.resize();
    };

    const mouseUpHandler = function () {
        document.body.classList.remove('resizing-v');
        resizer.classList.remove('active');
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    };

    resizer.addEventListener('mousedown', mouseDownHandler);
}

function initResizer(resizer, sidebar, direction) {
    let x = 0;
    let w = 0;

    const mouseDownHandler = function (e) {
        x = e.clientX;
        const styles = window.getComputedStyle(sidebar);
        w = parseInt(styles.width, 10);

        document.body.classList.add('resizing');
        resizer.classList.add('active');

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = function (e) {
        const dx = e.clientX - x;

        if (direction === 'left') {
            sidebar.style.width = `${w + dx}px`;
        } else {
            sidebar.style.width = `${w - dx}px`;
        }
        if(myChart) myChart.resize();
    };

    const mouseUpHandler = function () {
        document.body.classList.remove('resizing');
        resizer.classList.remove('active');
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    };

    resizer.addEventListener('mousedown', mouseDownHandler);
}

initVerticalResizer(resizerVertical, analysisPanel);
initResizer(resizerLeft, leftSidebar, 'left');
initResizer(resizerRight, rightSidebar, 'right');

function renderUI() {
    dom.container.innerHTML = '';

    const tools = [
        { label: 'b', val: 'b', type: 'var', tooltip: 'Base' },
        { label: 'g', val: 'g', type: 'var', tooltip: 'Growth' },
        { label: 'lv', val: 'lv', type: 'var', tooltip: 'Level' },
        { label: '^', val: '^', type: 'math', tooltip: 'Power' },
        { label: '√', val: 'Math.sqrt(', type: 'math', tooltip: 'Root' },
        { label: 'log', val: 'Math.log(', type: 'math', tooltip: 'Log' },
        { label: 'max', val: 'Math.max(', type: 'math', tooltip: 'Max' },
        { label: 'min', val: 'Math.min(', type: 'math', tooltip: 'Min' },
        { label: 'floor', val: 'Math.floor(', type: 'math', tooltip: 'Floor' }
    ];

    entities.forEach((ent, index) => {
        const card = document.createElement('div');
        card.className = 'entity-card';

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

        const inputs = card.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const key = e.target.getAttribute('data-key');
                const val = e.target.value;
                entities[index][key] = (key === 'base' || key === 'growth') ? parseFloat(val) : val;
            });
        });

        const toolContainer = card.querySelector('.formula-tools');
        const formulaInput = card.querySelector('.formula-input');

        tools.forEach(tool => {
            const btn = document.createElement('button');
            btn.className = `tool-btn ${tool.type}`;
            btn.innerText = tool.label;
            btn.title = tool.tooltip;

            btn.addEventListener('click', () => {
                const startPos = formulaInput.selectionStart;
                const endPos = formulaInput.selectionEnd;
                formulaInput.setRangeText(tool.val, startPos, endPos, 'end');
                entities[index].formula = formulaInput.value;
                formulaInput.focus();
            });

            toolContainer.appendChild(btn);
        });

        card.querySelector('.delete-btn').addEventListener('click', () => {
            entities.splice(index, 1);
            renderUI();
            runSimulation();
        });

        dom.container.appendChild(card);
    });
}

dom.addBtn.addEventListener('click', () => {
    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16);
    entities.push({
        id: Date.now(),
        name: `New Unit`,
        base: 10,
        growth: 2,
        formula: 'b + (lv - 1) * g',
        color: randomColor
    });
    renderUI();
});

function calculateFormula(formulaStr, b, g, lv) {
    try {
        let expression = formulaStr.replace(/\^/g, '**');
        const func = new Function('b', 'g', 'lv', `return ${expression};`);
        return func(b, g, lv);
    } catch (e) {
        return 0;
    }
}

function renderItemUI() {
    dom.itemContainer.innerHTML = '';

    items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.style.opacity = item.active ? '1' : '0.5';

        let targetHtml = '';
        entities.forEach(ent => {
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

        const targetChecks = card.querySelectorAll('.target-select');
        targetChecks.forEach(chk => {
            chk.addEventListener('change', (e) => {
                const entId = parseInt(e.target.getAttribute('data-ent-id'));
                if (e.target.checked) {
                    if (!items[index].targets.includes(entId)) {
                        items[index].targets.push(entId);
                    }
                } else {
                    items[index].targets = items[index].targets.filter(id => id !== entId);
                }
                runSimulation();
            });
        });

        card.querySelector('.delete-item-btn').addEventListener('click', () => {
            items.splice(index, 1);
            renderItemUI();
            runSimulation();
        });

        dom.itemContainer.appendChild(card);
    });
}

dom.addItemBtn.addEventListener('click', () => {
    const allEntityIds = entities.map(e => e.id);
    items.push({
        id: Date.now(),
        name: 'New Item',
        target: 'base',
        op: 'add',
        val: 10,
        active: true,
        targets: allEntityIds
    });
    renderItemUI();
    runSimulation();
});

function applyItems(entId, originalBase, originalGrowth) {
    let newBase = originalBase;
    let newGrowth = originalGrowth;
    let finalMultiplier = 1.0;
    let finalFlat = 0;

    items.forEach(item => {
        if (!item.active) return;
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
                tooltip: {
                    itemSort: function(a, b) {
                        return b.raw - a.raw;
                    }
                }
            }
        }
    });
}

function analyzeCrossovers(rawData, maxLv) {
    const logContainer = document.getElementById('analysisLog');
    logContainer.innerHTML = '';

    const names = Object.keys(rawData);
    if (names.length < 2) {
        logContainer.innerHTML = '<div class="log-item placeholder">Add at least 2 entities to analyze comparison.</div>';
        return;
    }

    let crossoverFound = false;

    for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
            const charA = names[i];
            const charB = names[j];
            const dataA = rawData[charA].data;
            const dataB = rawData[charB].data;
            const colorA = rawData[charA].color;
            const colorB = rawData[charB].color;

            for (let k = 0; k < maxLv - 1; k++) {
                const lv = k + 1;
                const diffCurrent = dataA[k] - dataB[k];
                const diffNext = dataA[k+1] - dataB[k+1];

                if ((diffCurrent > 0 && diffNext < 0) || (diffCurrent < 0 && diffNext > 0)) {
                    crossoverFound = true;
                    const winner = diffNext > 0 ? charA : charB;
                    const loser = diffNext > 0 ? charB : charA;
                    const winnerColor = diffNext > 0 ? colorA : colorB;

                    const logItem = document.createElement('div');
                    logItem.className = 'log-item';
                    
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
        logContainer.innerHTML = '<div class="log-item placeholder">No crossover points detected.</div>';
    }
}

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
    renderItemUI();
    runSimulation();
    alert('Loaded!');
});

ipcRenderer.on('export-finished', (event, msg) => alert(msg));
ipcRenderer.on('save-finished', (event, msg) => alert(msg));

renderUI();
renderItemUI();
runSimulation();