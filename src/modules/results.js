/**
 * Results Dashboard Module
 * Renders performance metrics, equity curves, trade logs
 * Updated for lightweight-charts v5 API
 */
import { createChart, ColorType, AreaSeries, LineSeries } from 'lightweight-charts';

let equityChart = null;
let equityChartFull = null;
let drawdownChart = null;

/**
 * Display backtest results in the dashboard
 * @param {Object} results - Backtest results from strategyEngine
 */
export function displayResults(results) {
  if (results.error) {
    showError(results.error);
    return;
  }

  // Hide empty state, show overview
  document.getElementById('results-empty').style.display = 'none';
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.getElementById('tab-overview').style.display = 'block';

  renderMetrics(results.metrics);
  renderMiniEquityChart(results.equityCurve);
  renderSummary(results);
  renderTradeLog(results.trades);
  renderFullEquityChart(results.equityCurve);
  renderDrawdownChart(results.equityCurve);

  // Update status bar
  const statusEl = document.getElementById('status-backtest');
  if (statusEl) {
    const pnl = results.metrics.netProfit;
    statusEl.innerHTML = `<span style="color: ${pnl >= 0 ? '#22c55e' : '#ef4444'}">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</span> | ${results.metrics.totalTrades} trades`;
  }
}

function showError(message) {
  document.getElementById('results-empty').style.display = 'none';
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.getElementById('tab-overview').style.display = 'block';

  const metricsGrid = document.getElementById('metrics-grid');
  metricsGrid.innerHTML = `
    <div style="grid-column: 1 / -1; padding: var(--sp-4); background: var(--color-sell-bg); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radius-md);">
      <div style="color: var(--color-sell); font-weight: 600; margin-bottom: var(--sp-2);">⚠ Strategy Error</div>
      <div style="color: var(--text-secondary); font-size: var(--fs-xs); font-family: var(--font-mono);">${escapeHtml(message)}</div>
    </div>
  `;
}

function renderMetrics(metrics) {
  const grid = document.getElementById('metrics-grid');
  
  const items = [
    { label: 'Net Profit', value: `$${metrics.netProfit.toFixed(2)}`, class: metrics.netProfit >= 0 ? 'positive' : 'negative', prefix: metrics.netProfit >= 0 ? '+' : '' },
    { label: 'Win Rate', value: `${metrics.winRate.toFixed(1)}%`, class: metrics.winRate >= 50 ? 'positive' : 'negative' },
    { label: 'Total Trades', value: metrics.totalTrades },
    { label: 'Profit Factor', value: metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2), class: metrics.profitFactor >= 1 ? 'positive' : 'negative' },
    { label: 'Max Drawdown', value: `${metrics.maxDrawdownPercent.toFixed(1)}%`, class: 'negative' },
    { label: 'Sharpe Ratio', value: metrics.sharpeRatio.toFixed(2), class: metrics.sharpeRatio >= 1 ? 'positive' : metrics.sharpeRatio >= 0 ? '' : 'negative' },
    { label: 'Avg Win', value: `$${metrics.avgWin.toFixed(2)}`, class: 'positive' },
    { label: 'Avg Loss', value: `$${metrics.avgLoss.toFixed(2)}`, class: 'negative' },
  ];

  grid.innerHTML = items.map(item => `
    <div class="metric-card animate-fade-in">
      <div class="metric-label">${item.label}</div>
      <div class="metric-value ${item.class || ''}">${item.prefix || ''}${item.value}</div>
    </div>
  `).join('');
}

function renderMiniEquityChart(equityCurve) {
  const container = document.getElementById('mini-equity-chart');
  container.innerHTML = '';

  if (equityChart) {
    equityChart.remove();
    equityChart = null;
  }

  equityChart = createChart(container, {
    layout: {
      background: { type: ColorType.Solid, color: '#0a0e17' },
      textColor: '#64748b',
      fontSize: 10,
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: 'rgba(99,102,241,0.04)' },
    },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false, visible: false },
    handleScroll: false,
    handleScale: false,
    crosshair: {
      vertLine: { visible: false },
      horzLine: { visible: false },
    },
    width: container.clientWidth,
    height: container.clientHeight || 150,
  });

  const isProfit = equityCurve.length > 1 && equityCurve[equityCurve.length - 1].value >= equityCurve[0].value;

  const areaSeries = equityChart.addSeries(AreaSeries, {
    lineColor: isProfit ? '#22c55e' : '#ef4444',
    topColor: isProfit ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
    bottomColor: isProfit ? 'rgba(34, 197, 94, 0.02)' : 'rgba(239, 68, 68, 0.02)',
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  });

  areaSeries.setData(equityCurve);
  equityChart.timeScale().fitContent();
}

function renderSummary(results) {
  const el = document.getElementById('summary-text');
  const m = results.metrics;
  const avgDurationHrs = (m.avgDuration / 3600).toFixed(1);

  el.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 6px;">
      <div>📊 <strong>${m.totalTrades}</strong> trades executed — <span style="color: #22c55e">${m.winningTrades} wins</span> / <span style="color: #ef4444">${m.losingTrades} losses</span></div>
      <div>💰 Gross Profit: <span style="color: #22c55e">+$${m.grossProfit.toFixed(2)}</span> | Gross Loss: <span style="color: #ef4444">-$${m.grossLoss.toFixed(2)}</span></div>
      <div>📈 Largest Win: <span style="color: #22c55e">+$${m.largestWin.toFixed(2)}</span> | Largest Loss: <span style="color: #ef4444">$${m.largestLoss.toFixed(2)}</span></div>
      <div>⏱ Avg Trade Duration: ${avgDurationHrs} hours</div>
      <div>💵 Return: <span style="color: ${m.netProfitPercent >= 0 ? '#22c55e' : '#ef4444'}">${m.netProfitPercent >= 0 ? '+' : ''}${m.netProfitPercent.toFixed(2)}%</span></div>
    </div>
  `;
}

function renderTradeLog(trades) {
  const tbody = document.getElementById('trades-tbody');
  
  tbody.innerHTML = trades.map((t, i) => {
    const pnlColor = t.pnl >= 0 ? 'color: #22c55e' : 'color: #ef4444';
    const pnlSign = t.pnl >= 0 ? '+' : '';
    const typeClass = t.pnl >= 0 ? 'badge-buy' : 'badge-sell';
    const entryDate = new Date(t.entryTime * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const exitDate = new Date(t.exitTime * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `
      <tr>
        <td>${i + 1}</td>
        <td><span class="badge ${typeClass}">${t.pnl >= 0 ? 'WIN' : 'LOSS'}</span></td>
        <td>
          <div style="font-family: var(--font-mono); font-size: 10px;">${t.entryPrice.toFixed(2)}</div>
          <div style="font-size: 9px; color: var(--text-muted);">${entryDate}</div>
        </td>
        <td>
          <div style="font-family: var(--font-mono); font-size: 10px;">${t.exitPrice.toFixed(2)}</div>
          <div style="font-size: 9px; color: var(--text-muted);">${exitDate}</div>
        </td>
        <td style="${pnlColor}; font-family: var(--font-mono); font-weight: 600; font-size: 11px;">
          ${pnlSign}$${t.pnl.toFixed(2)}
          <div style="font-size: 9px; opacity: 0.7;">${pnlSign}${t.pnlPercent.toFixed(2)}%</div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderFullEquityChart(equityCurve) {
  const container = document.getElementById('equity-chart-full');
  container.innerHTML = '';

  if (equityChartFull) {
    equityChartFull.remove();
    equityChartFull = null;
  }

  equityChartFull = createChart(container, {
    layout: {
      background: { type: ColorType.Solid, color: '#0a0e17' },
      textColor: '#64748b',
      fontSize: 10,
      fontFamily: "'Inter', sans-serif",
    },
    grid: {
      vertLines: { color: 'rgba(99,102,241,0.04)' },
      horzLines: { color: 'rgba(99,102,241,0.04)' },
    },
    rightPriceScale: { borderColor: 'rgba(99,102,241,0.08)' },
    timeScale: { borderColor: 'rgba(99,102,241,0.08)', timeVisible: true },
    width: container.clientWidth,
    height: 250,
  });

  const isProfit = equityCurve.length > 1 && equityCurve[equityCurve.length - 1].value >= equityCurve[0].value;

  const series = equityChartFull.addSeries(AreaSeries, {
    lineColor: isProfit ? '#22c55e' : '#ef4444',
    topColor: isProfit ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
    bottomColor: 'transparent',
    lineWidth: 2,
  });

  series.setData(equityCurve);
  equityChartFull.timeScale().fitContent();
}

function renderDrawdownChart(equityCurve) {
  const container = document.getElementById('drawdown-chart');
  container.innerHTML = '';

  if (drawdownChart) {
    drawdownChart.remove();
    drawdownChart = null;
  }

  // Calculate drawdown series
  let peak = equityCurve[0]?.value || 0;
  const ddData = equityCurve.map(point => {
    if (point.value > peak) peak = point.value;
    const dd = ((point.value - peak) / peak) * 100;
    return { time: point.time, value: dd };
  });

  drawdownChart = createChart(container, {
    layout: {
      background: { type: ColorType.Solid, color: '#0a0e17' },
      textColor: '#64748b',
      fontSize: 10,
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: 'rgba(99,102,241,0.04)' },
    },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false, visible: false },
    handleScroll: false,
    handleScale: false,
    width: container.clientWidth,
    height: 150,
  });

  const series = drawdownChart.addSeries(AreaSeries, {
    lineColor: '#ef4444',
    topColor: 'rgba(239, 68, 68, 0.02)',
    bottomColor: 'rgba(239, 68, 68, 0.15)',
    lineWidth: 1,
    priceLineVisible: false,
    lastValueVisible: false,
  });

  series.setData(ddData);
  drawdownChart.timeScale().fitContent();
}

/**
 * Show/hide result tabs  
 * @param {string} tabName - 'overview', 'trades', 'equity'
 */
export function showTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  const tab = document.getElementById(`tab-${tabName}`);
  if (tab) tab.style.display = 'block';

  // Resize charts when switching tabs
  setTimeout(() => {
    if (tabName === 'equity') {
      if (equityChartFull) {
        const c1 = document.getElementById('equity-chart-full');
        equityChartFull.applyOptions({ width: c1.clientWidth });
      }
      if (drawdownChart) {
        const c2 = document.getElementById('drawdown-chart');
        drawdownChart.applyOptions({ width: c2.clientWidth });
      }
    }
  }, 50);
}

/**
 * Export trades to CSV
 */
export function exportCSV(trades) {
  const headers = ['#', 'Type', 'Entry Price', 'Exit Price', 'Entry Time', 'Exit Time', 'P&L ($)', 'P&L (%)', 'Duration (hrs)'];
  const rows = trades.map((t, i) => [
    i + 1,
    t.pnl >= 0 ? 'WIN' : 'LOSS',
    t.entryPrice.toFixed(6),
    t.exitPrice.toFixed(6),
    new Date(t.entryTime * 1000).toISOString(),
    new Date(t.exitTime * 1000).toISOString(),
    t.pnl.toFixed(2),
    t.pnlPercent.toFixed(2),
    (t.duration / 3600).toFixed(1),
  ]);

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backtest_trades_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
