let mainChart = null;
let battleChart = null;
let detailTurnChart = null;
let detailHpChart = null;

function renderMainChart(ctx, labels, datasets) {
    if (mainChart) mainChart.destroy();
    mainChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { ticks: { color: '#ccc' }, grid: { color: '#3e3e42' } },
                y: { beginAtZero: true, ticks: { color: '#ccc' }, grid: { color: '#3e3e42' } }
            },
            plugins: { legend: { labels: { color: '#fff' } } }
        }
    });
}

function renderBattleChart(ctx, results) {
    if (battleChart) battleChart.destroy();

    const labels = results.map(r => r.opponentName);
    const winRates = results.map(r => r.winRate);
    const avgTurns = results.map(r => r.avgTurns);

    battleChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { 
                    label: 'Win Rate (%)', 
                    data: winRates, 
                    backgroundColor: 'rgba(45, 164, 78, 0.8)', 
                    borderColor: '#2da44e',
                    borderWidth: 1,
                    yAxisID: 'y',
                    order: 2
                },
                { 
                    label: 'Avg Turns', 
                    data: avgTurns, 
                    backgroundColor: 'rgba(210, 153, 34, 0.8)', 
                    borderColor: '#d29922',
                    borderWidth: 1,
                    yAxisID: 'y1',
                    order: 1
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: '#dcddde' } },
                tooltip: {
                    mode: 'index', intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(1);
                                if (context.datasetIndex === 0) label += '%';
                                else label += ' Turns';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#ccc' } },
                y: {
                    type: 'linear', display: true, position: 'left',
                    min: 0, max: 100,
                    title: { display: true, text: 'Win Rate (%)', color: '#2da44e' },
                    grid: { color: '#40444b' },
                    ticks: { color: '#ccc' }
                },
                y1: {
                    type: 'linear', display: true, position: 'right',
                    title: { display: true, text: 'Avg Turns', color: '#d29922' },
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#ccc' },
                    suggestedMin: 0,
                    suggestedMax: 5
                }
            }
        }
    });
}

function renderDetailCharts(turnCtx, hpCtx, data) {
    if (detailTurnChart) detailTurnChart.destroy();
    if (detailHpChart) detailHpChart.destroy();

    // 1. Turn Chart (Bar)
    const turns = Object.keys(data.turnDist).map(Number).sort((a,b)=>a-b);
    const turnCounts = turns.map(t => data.turnDist[t]);

    detailTurnChart = new Chart(turnCtx, {
        type: 'bar',
        data: {
            labels: turns,
            datasets: [{
                label: 'Frequency',
                data: turnCounts,
                backgroundColor: '#5fabff',
                borderColor: '#5fabff',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, title: { display: true, text: 'Turns to Finish' } },
            scales: { x: { ticks: { color: '#ccc' } }, y: { ticks: { color: '#ccc' }, grid: { color: '#444' } } }
        }
    });

    // 2. HP Chart (Histogram like)
    const createBuckets = (arr) => {
        const buckets = {};
        arr.forEach(val => {
            const b = Math.floor(val / 10) * 10; 
            buckets[b] = (buckets[b] || 0) + 1;
        });
        return buckets;
    };

    const bucketsA = createBuckets(data.winHpDistA);
    const bucketsB = createBuckets(data.winHpDistB);
    
    const allKeys = [...Object.keys(bucketsA), ...Object.keys(bucketsB)].map(Number);
    const minHp = 0; 
    const maxHp = Math.max(...allKeys) || 100;
    const hpLabels = [];
    for(let i=minHp; i<=maxHp; i+=10) hpLabels.push(i);

    detailHpChart = new Chart(hpCtx, {
        type: 'bar',
        data: {
            labels: hpLabels.map(l => `${l}~${l+9}`),
            datasets: [
                {
                    label: 'Player Win HP',
                    data: hpLabels.map(l => bucketsA[l] || 0),
                    backgroundColor: 'rgba(45, 164, 78, 0.7)' 
                },
                {
                    label: 'Enemy Win HP',
                    data: hpLabels.map(l => bucketsB[l] || 0),
                    backgroundColor: 'rgba(231, 76, 60, 0.7)' 
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Remaining HP Distribution' } },
            scales: { x: { ticks: { color: '#ccc' } }, y: { ticks: { color: '#ccc' }, grid: { color: '#444' } } }
        }
    });
}

function resizeCharts() { 
    if(mainChart) mainChart.resize(); 
    if(battleChart) battleChart.resize();
    if(detailTurnChart) detailTurnChart.resize();
    if(detailHpChart) detailHpChart.resize();
}

module.exports = { renderMainChart, renderBattleChart, resizeCharts, renderDetailCharts };