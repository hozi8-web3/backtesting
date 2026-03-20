/**
 * Chart Module
 * TradingView Lightweight Charts v5 integration
 */
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries,
  createSeriesMarkers,
} from 'lightweight-charts';

let chart = null;
let candleSeries = null;
let volumeSeries = null;
let overlayLines = [];
let currentMarkers = null;

const CHART_COLORS = {
  background: '#0a0e17',
  text: '#64748b',
  grid: 'rgba(99, 102, 241, 0.04)',
  crosshair: '#6366f1',
  upColor: '#22c55e',
  downColor: '#ef4444',
  wickUp: '#22c55e',
  wickDown: '#ef4444',
  volumeUp: 'rgba(34, 197, 94, 0.15)',
  volumeDown: 'rgba(239, 68, 68, 0.15)',
};

/**
 * Initialize the chart
 * @param {HTMLElement} container
 */
export function initChart(container) {
  if (chart) {
    chart.remove();
    overlayLines = [];
    currentMarkers = null;
  }

  chart = createChart(container, {
    layout: {
      background: { type: ColorType.Solid, color: CHART_COLORS.background },
      textColor: CHART_COLORS.text,
      fontFamily: "'Inter', sans-serif",
      fontSize: 11,
    },
    grid: {
      vertLines: { color: CHART_COLORS.grid },
      horzLines: { color: CHART_COLORS.grid },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: CHART_COLORS.crosshair,
        width: 1,
        style: LineStyle.Dashed,
        labelBackgroundColor: '#6366f1',
      },
      horzLine: {
        color: CHART_COLORS.crosshair,
        width: 1,
        style: LineStyle.Dashed,
        labelBackgroundColor: '#6366f1',
      },
    },
    rightPriceScale: {
      borderColor: 'rgba(99, 102, 241, 0.1)',
      scaleMargins: { top: 0.1, bottom: 0.25 },
    },
    timeScale: {
      borderColor: 'rgba(99, 102, 241, 0.1)',
      timeVisible: true,
      secondsVisible: false,
    },
    handleScroll: { vertTouchDrag: false },
  });

  candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: CHART_COLORS.upColor,
    downColor: CHART_COLORS.downColor,
    wickUpColor: CHART_COLORS.wickUp,
    wickDownColor: CHART_COLORS.wickDown,
    borderVisible: false,
  });

  volumeSeries = chart.addSeries(HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: 'volume',
  });

  chart.priceScale('volume').applyOptions({
    scaleMargins: { top: 0.8, bottom: 0 },
  });

  // Auto-resize
  const resizeObserver = new ResizeObserver(() => {
    if (chart && container) {
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    }
  });
  resizeObserver.observe(container);

  return chart;
}

/**
 * Set candlestick data
 * @param {Array} candles - Array of {time, open, high, low, close, volume}
 */
export function setData(candles) {
  if (!candleSeries || !volumeSeries) return;

  candleSeries.setData(candles.map(c => ({
    time: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  })));

  volumeSeries.setData(candles.map(c => ({
    time: c.time,
    value: c.volume,
    color: c.close >= c.open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
  })));

  chart.timeScale().fitContent();
}

/**
 * Add buy/sell markers from backtest signals
 * Uses createSeriesMarkers (v5 API)
 * @param {Array} signals - Array of {time, type, price}
 */
export function setMarkers(signals) {
  if (!candleSeries) return;

  // Remove old markers
  clearMarkers();

  const markers = signals.map(s => ({
    time: s.time,
    position: s.type === 'buy' ? 'belowBar' : 'aboveBar',
    color: s.type === 'buy' ? '#22c55e' : '#ef4444',
    shape: s.type === 'buy' ? 'arrowUp' : 'arrowDown',
    text: s.type === 'buy' ? 'BUY' : 'SELL',
  }));

  // Sort markers by time (required by lightweight-charts)
  markers.sort((a, b) => a.time - b.time);

  // v5 API: createSeriesMarkers(series, markers)
  currentMarkers = createSeriesMarkers(candleSeries, markers);
}

/**
 * Clear all markers
 */
function clearMarkers() {
  if (currentMarkers) {
    // In v5, detach markers by calling detach or replacing with empty
    try {
      currentMarkers.detach();
    } catch (e) {
      // If detach doesn't work, just null it
    }
    currentMarkers = null;
  }
}

/**
 * Add an indicator line overlay on the chart
 * @param {Array} data - Array of {time, value}
 * @param {string} color - Line color
 * @param {number} [lineWidth=1]
 * @returns {Object} The line series
 */
export function addLineSeries(data, color, lineWidth = 1) {
  if (!chart) return null;

  const line = chart.addSeries(LineSeries, {
    color,
    lineWidth,
    crosshairMarkerVisible: false,
    priceLineVisible: false,
    lastValueVisible: false,
  });

  const filtered = data.filter(d => d.value !== null && d.value !== undefined);
  line.setData(filtered);
  overlayLines.push(line);
  return line;
}

/**
 * Remove all indicator overlay lines and markers
 */
export function clearOverlays() {
  for (const line of overlayLines) {
    try { chart.removeSeries(line); } catch (e) {}
  }
  overlayLines = [];
  clearMarkers();
}

/**
 * Get the chart instance
 */
export function getChart() {
  return chart;
}
