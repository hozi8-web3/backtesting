/**
 * Market Data Module
 * Fetches real OHLCV candlestick data from Binance REST API
 * Supports time-based ranges (3D, 1W, 1M, 3M, 6M, 1Y) with paginated fetching
 */

const BINANCE_API = 'https://api.binance.com/api/v3';
const cache = new Map();

// Timeframe intervals supported by Binance
const VALID_INTERVALS = [
  '1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M'
];

// Data range presets (in milliseconds)
const RANGE_PRESETS = {
  '3D':  3 * 24 * 60 * 60 * 1000,
  '1W':  7 * 24 * 60 * 60 * 1000,
  '1M':  30 * 24 * 60 * 60 * 1000,
  '3M':  90 * 24 * 60 * 60 * 1000,
  '6M':  180 * 24 * 60 * 60 * 1000,
  '1Y':  365 * 24 * 60 * 60 * 1000,
};

let currentRange = '3M'; // default

/**
 * Set the data range 
 */
export function setDataRange(range) {
  currentRange = range;
}

/**
 * Get the current data range key
 */
export function getDataRange() {
  return currentRange;
}

/**
 * Fetch OHLCV candles from Binance for the given time range
 * Automatically paginates to get the full range (Binance max 1000/request)
 * @param {string} symbol - e.g. 'BTCUSDT'
 * @param {string} timeframe - e.g. '1h'
 * @param {string} [range] - e.g. '3M', '1Y'
 * @returns {Promise<Array<{time, open, high, low, close, volume}>>}
 */
export async function fetchCandles(symbol, timeframe, range) {
  const effectiveRange = range || currentRange;
  const interval = VALID_INTERVALS.includes(timeframe) ? timeframe : '1h';
  const cacheKey = `${symbol}_${interval}_${effectiveRange}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const rangeMs = RANGE_PRESETS[effectiveRange] || RANGE_PRESETS['3M'];
  const endTime = Date.now();
  const startTime = endTime - rangeMs;

  let allCandles = [];
  let fetchStart = startTime;

  // Paginate forward from startTime to now
  while (fetchStart < endTime) {
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      interval: interval,
      startTime: String(fetchStart),
      endTime: String(endTime),
      limit: '1000',
    });

    const response = await fetch(`${BINANCE_API}/klines?${params}`);
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
    }

    const raw = await response.json();
    if (raw.length === 0) break;

    const candles = raw.map(k => ({
      time: Math.floor(k[0] / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));

    allCandles = allCandles.concat(candles);

    // Break if we got less than 1000 (no more data)
    if (raw.length < 1000) break;

    // Next batch starts after the last candle we got
    fetchStart = raw[raw.length - 1][0] + 1;
  }

  // Deduplicate by time
  const seen = new Set();
  allCandles = allCandles.filter(c => {
    if (seen.has(c.time)) return false;
    seen.add(c.time);
    return true;
  });

  // Sort ascending
  allCandles.sort((a, b) => a.time - b.time);

  cache.set(cacheKey, allCandles);
  return allCandles;
}

/**
 * Clear cached data
 */
export function clearCache() {
  cache.clear();
}
