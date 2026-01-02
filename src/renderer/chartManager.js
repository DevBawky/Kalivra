let mainChart = null;
let battleChart = null;

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
    battleChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: results.map(r => r.opponentName),
            datasets: [
                { label: 'Win Rate (%)', data: results.map(r => r.winRate), backgroundColor: '#2da44e', yAxisID: 'y' },
                { label: 'Avg TTK (s)', data: results.map(r => r.avgTTK), backgroundColor: '#d29922', yAxisID: 'y1' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 100, title: {display:true, text:'Win %', color:'#ccc'}, ticks:{color:'#ccc'}, grid:{color:'#444'} },
                y1: { beginAtZero: true, position:'right', title:{display:true, text:'Time (s)', color:'#ccc'}, ticks:{color:'#ccc'}, grid:{drawOnChartArea:false} },
                x: { ticks: {color:'#ccc'}, grid:{display:false} }
            },
            plugins: { legend: { labels: {color:'#ccc'} } }
        }
    });
}
function resizeCharts() { if(mainChart) mainChart.resize(); }

module.exports = { renderMainChart, renderBattleChart, resizeCharts };