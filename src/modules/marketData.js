/**
 * Market Data Module
 * Fetches real OHLCV candlestick data from Binance REST API
 * Supports paginated fetching for large datasets (1000+ candles)
 */

const BINANCE_API = 'https://api.binance.com/api/v3';
const cache = new Map();

const TIMEFRAME_MAP = {
  '1m':  { interval: '1m',  limit: 1000 },
  '3m':  { interval: '3m',  limit: 1000 },
  '5m':  { interval: '5m',  limit: 1000 },
  '15m': { interval: '15m', limit: 1000 },
  '30m': { interval: '30m', limit: 1000 },
  '1h':  { interval: '1h',  limit: 1000 },
  '2h':  { interval: '2h',  limit: 1000 },
  '4h':  { interval: '4h',  limit: 1000 },
  '6h':  { interval: '6h',  limit: 1000 },
  '8h':  { interval: '8h',  limit: 1000 },
  '12h': { interval: '12h', limit: 1000 },
  '1d':  { interval: '1d',  limit: 1000 },
  '3d':  { interval: '3d',  limit: 1000 },
  '1w':  { interval: '1w',  limit: 1000 },
  '1M':  { interval: '1M',  limit: 500 },
};

/**
 * Fetch OHLCV candles from Binance
 * Fetches up to `limit` candles (max 1000 per Binance API call).
 * For more than 1000, it paginate-fetches backwards in time.
 * @param {string} symbol - e.g. 'BTCUSDT'
 * @param {string} timeframe - e.g. '1h'
 * @param {number} [limit] - number of candles (default from TIMEFRAME_MAP)
 * @returns {Promise<Array<{time: number, open: number, high: number, low: number, close: number, volume: number}>>}
 */
export async function fetchCandles(symbol, timeframe, limit) {
  const tf = TIMEFRAME_MAP[timeframe] || TIMEFRAME_MAP['1h'];
  const totalLimit = limit || tf.limit;
  const cacheKey = `${symbol}_${timeframe}_${totalLimit}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  let allCandles = [];
  let remaining = totalLimit;
  let endTime = undefined;

  // Paginated fetch — Binance max is 1000 per request
  while (remaining > 0) {
    const batchSize = Math.min(remaining, 1000);
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      interval: tf.interval,
      limit: String(batchSize),
    });
    if (endTime) {
      params.set('endTime', String(endTime));
    }

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

    // Prepend older candles
    allCandles = candles.concat(allCandles);
    remaining -= raw.length;

    // Next batch ends before the earliest candle we just got
    endTime = raw[0][0] - 1;

    // If we got fewer than requested, no more data available
    if (raw.length < batchSize) break;
  }

  // Sort by time ascending & deduplicate
  allCandles.sort((a, b) => a.time - b.time);
  const seen = new Set();
  allCandles = allCandles.filter(c => {
    if (seen.has(c.time)) return false;
    seen.add(c.time);
    return true;
  });

  cache.set(cacheKey, allCandles);
  return allCandles;
}

/**
 * Clear cached data
 */
export function clearCache() {
  cache.clear();
}
