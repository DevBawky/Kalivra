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

    // 데이터 매핑
    const labels = results.map(r => r.opponentName);
    const winRates = results.map(r => r.winRate);
    const avgTurns = results.map(r => r.avgTurns); // avgTTK -> avgTurns로 변경

    battleChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { 
                    label: 'Win Rate (%)', 
                    data: winRates, 
                    backgroundColor: 'rgba(45, 164, 78, 0.8)', // 녹색
                    borderColor: '#2da44e',
                    borderWidth: 1,
                    yAxisID: 'y',  // 왼쪽 축 사용
                    order: 2       // 뒤에 그려짐 (막대)
                },
                { 
                    label: 'Avg Turns', 
                    data: avgTurns, 
                    backgroundColor: 'rgba(210, 153, 34, 0.8)', // 노란색
                    borderColor: '#d29922',
                    borderWidth: 1,
                    yAxisID: 'y1', // 오른쪽 축 사용 (이중 축 핵심)
                    order: 1       // 앞에 그려짐
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
                
                // 왼쪽 축 (승률 0~100%)
                y: {
                    type: 'linear', display: true, position: 'left',
                    min: 0, max: 100,
                    title: { display: true, text: 'Win Rate (%)', color: '#2da44e' },
                    grid: { color: '#40444b' },
                    ticks: { color: '#ccc' }
                },
                
                // 오른쪽 축 (턴 수, 자동 스케일)
                y1: {
                    type: 'linear', display: true, position: 'right',
                    title: { display: true, text: 'Avg Turns', color: '#d29922' },
                    grid: { drawOnChartArea: false }, // 그리드 선 중복 방지
                    ticks: { color: '#ccc' },
                    suggestedMin: 0,
                    suggestedMax: 5 // 턴 수가 너무 작을 때를 대비한 최소 높이 확보
                }
            }
        }
    });
}

function resizeCharts() { 
    if(mainChart) mainChart.resize(); 
    if(battleChart) battleChart.resize();
}

module.exports = { renderMainChart, renderBattleChart, resizeCharts };