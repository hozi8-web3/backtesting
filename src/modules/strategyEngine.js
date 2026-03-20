/**
 * Strategy Engine
 * Core backtesting engine with indicator functions and position management
 */

// ========================
// INDICATOR FUNCTIONS
// ========================

export function sma(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += data[j];
      }
      result.push(sum / period);
    }
  }
  return result;
}

export function ema(data, period) {
  const result = [];
  const multiplier = 2 / (period + 1);
  let prev = null;
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += data[j];
      prev = sum / period;
      result.push(prev);
    } else {
      prev = (data[i] - prev) * multiplier + prev;
      result.push(prev);
    }
  }
  return result;
}

export function rsi(data, period = 14) {
  const result = [];
  const gains = [];
  const losses = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(null);
      continue;
    }
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);

    if (i < period) {
      result.push(null);
    } else if (i === period) {
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    } else {
      const prevRsi = result[result.length - 1];
      const prevAvgGain = (prevRsi !== null) ? 
        (gains.slice(gains.length - period - 1, gains.length - 1).reduce((a, b) => a + b, 0) / period) : 0;
      const prevAvgLoss = (prevRsi !== null) ? 
        (losses.slice(losses.length - period - 1, losses.length - 1).reduce((a, b) => a + b, 0) / period) : 0;
      
      const avgGain = (prevAvgGain * (period - 1) + gains[gains.length - 1]) / period;
      const avgLoss = (prevAvgLoss * (period - 1) + losses[losses.length - 1]) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }
  }
  return result;
}

export function macd(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEma = ema(data, fastPeriod);
  const slowEma = ema(data, slowPeriod);
  
  const macdLine = fastEma.map((f, i) => {
    if (f === null || slowEma[i] === null) return null;
    return f - slowEma[i];
  });
  
  const validMacd = macdLine.filter(v => v !== null);
  const signalLine = ema(validMacd, signalPeriod);
  
  // Pad signal line
  const paddedSignal = [];
  let si = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) {
      paddedSignal.push(null);
    } else {
      paddedSignal.push(si < signalLine.length ? signalLine[si] : null);
      si++;
    }
  }
  
  const histogram = macdLine.map((m, i) => {
    if (m === null || paddedSignal[i] === null) return null;
    return m - paddedSignal[i];
  });

  return { macdLine, signalLine: paddedSignal, histogram };
}

export function bollingerBands(data, period = 20, stdDev = 2) {
  const middle = sma(data, period);
  const upper = [];
  const lower = [];

  for (let i = 0; i < data.length; i++) {
    if (middle[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      let sumSq = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumSq += Math.pow(data[j] - middle[i], 2);
      }
      const std = Math.sqrt(sumSq / period);
      upper.push(middle[i] + stdDev * std);
      lower.push(middle[i] - stdDev * std);
    }
  }

  return { upper, middle, lower };
}

export function atr(candles, period = 14) {
  const result = [];
  const trueRanges = [];

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trueRanges.push(candles[i].high - candles[i].low);
      result.push(null);
      continue;
    }
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trueRanges.push(tr);

    if (i < period) {
      result.push(null);
    } else if (i === period) {
      result.push(trueRanges.slice(0, period + 1).reduce((a, b) => a + b, 0) / (period + 1));
    } else {
      result.push((result[result.length - 1] * (period - 1) + tr) / period);
    }
  }
  return result;
}

export function stochastic(candles, kPeriod = 14, dPeriod = 3) {
  const kValues = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) {
      kValues.push(null);
    } else {
      let highest = -Infinity;
      let lowest = Infinity;
      for (let j = i - kPeriod + 1; j <= i; j++) {
        highest = Math.max(highest, candles[j].high);
        lowest = Math.min(lowest, candles[j].low);
      }
      const k = highest === lowest ? 50 : ((candles[i].close - lowest) / (highest - lowest)) * 100;
      kValues.push(k);
    }
  }

  const dValues = sma(kValues.filter(v => v !== null), dPeriod);
  const paddedD = [];
  let di = 0;
  for (let i = 0; i < kValues.length; i++) {
    if (kValues[i] === null) {
      paddedD.push(null);
    } else {
      paddedD.push(di < dValues.length ? dValues[di] : null);
      di++;
    }
  }

  return { k: kValues, d: paddedD };
}

export function crossover(a, b) {
  const result = [];
  for (let i = 0; i < a.length; i++) {
    if (i === 0 || a[i] === null || b[i] === null || a[i - 1] === null || b[i - 1] === null) {
      result.push(false);
    } else {
      result.push(a[i - 1] <= b[i - 1] && a[i] > b[i]);
    }
  }
  return result;
}

export function crossunder(a, b) {
  const result = [];
  for (let i = 0; i < a.length; i++) {
    if (i === 0 || a[i] === null || b[i] === null || a[i - 1] === null || b[i - 1] === null) {
      result.push(false);
    } else {
      result.push(a[i - 1] >= b[i - 1] && a[i] < b[i]);
    }
  }
  return result;
}

// ========================
// BACKTESTING ENGINE
// ========================

/**
 * Run a backtest with the given strategy code and candle data
 * @param {string} code - Strategy JavaScript code
 * @param {Array} candles - OHLCV candle data
 * @param {Object} params - Strategy parameters
 * @returns {Object} Backtest results
 */
export function runBacktest(code, candles, params = {}) {
  const initialBalance = params.initialBalance || 10000;
  const commissionRate = params.commission || 0.001; // 0.1%
  
  let balance = initialBalance;
  let position = null; // { type: 'long', entryPrice, amount, entryTime, entryIndex }
  const trades = [];
  const equityCurve = [];
  const signals = []; // { index, type: 'buy'|'sell', price }

  // Build indicator context
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const opens = candles.map(c => c.open);
  const volumes = candles.map(c => c.volume);

  // Create strategy context
  const ctx = {
    // Data arrays
    close: closes,
    open: opens,
    high: highs,
    low: lows,
    volume: volumes,
    candles,
    
    // Indicators
    sma, ema, rsi, macd, bollingerBands, atr, stochastic, crossover, crossunder,
    
    // Parameters
    params,
    
    // State
    position: null,
    balance,
    
    // Actions
    buy: (index) => {
      if (position) return;
      const price = candles[index].close;
      const commission = balance * commissionRate;
      const amount = (balance - commission) / price;
      position = {
        type: 'long',
        entryPrice: price,
        amount,
        entryTime: candles[index].time,
        entryIndex: index,
      };
      balance = 0;
      signals.push({ index, type: 'buy', price, time: candles[index].time });
    },
    
    sell: (index) => {
      if (!position) return;
      const price = candles[index].close;
      const grossValue = position.amount * price;
      const commission = grossValue * commissionRate;
      const netValue = grossValue - commission;
      const pnl = netValue - (position.amount * position.entryPrice);
      const pnlPercent = (pnl / (position.amount * position.entryPrice)) * 100;
      
      trades.push({
        entryPrice: position.entryPrice,
        exitPrice: price,
        entryTime: position.entryTime,
        exitTime: candles[index].time,
        entryIndex: position.entryIndex,
        exitIndex: index,
        pnl,
        pnlPercent,
        amount: position.amount,
        type: 'long',
        duration: candles[index].time - position.entryTime,
      });
      
      balance = netValue;
      signals.push({ index, type: 'sell', price, time: candles[index].time });
      position = null;
    },
  };

  // Execute strategy
  try {
    // Create strategy function
    const strategyFn = new Function(
      'ctx',
      `with(ctx) {
        ${code}
      }`
    );
    
    strategyFn(ctx);
  } catch (err) {
    return {
      error: err.message,
      trades: [],
      signals: [],
      equityCurve: [],
      metrics: null,
    };
  }

  // Close any open position at the end
  if (position) {
    const lastCandle = candles[candles.length - 1];
    const price = lastCandle.close;
    const grossValue = position.amount * price;
    const commission = grossValue * commissionRate;
    const netValue = grossValue - commission;
    const pnl = netValue - (position.amount * position.entryPrice);
    const pnlPercent = (pnl / (position.amount * position.entryPrice)) * 100;
    
    trades.push({
      entryPrice: position.entryPrice,
      exitPrice: price,
      entryTime: position.entryTime,
      exitTime: lastCandle.time,
      entryIndex: position.entryIndex,
      exitIndex: candles.length - 1,
      pnl,
      pnlPercent,
      amount: position.amount,
      type: 'long',
      duration: lastCandle.time - position.entryTime,
      forceClosed: true,
    });
    
    balance = netValue;
    position = null;
  }

  // Build equity curve
  let runningBalance = initialBalance;
  let tradeIdx = 0;
  for (let i = 0; i < candles.length; i++) {
    // Check if any trade exited at this candle
    while (tradeIdx < trades.length && trades[tradeIdx].exitIndex <= i) {
      runningBalance += trades[tradeIdx].pnl;
      tradeIdx++;
    }
    
    // If in position, add unrealized P&L
    const openTrade = trades.find(t => t.entryIndex <= i && t.exitIndex > i);
    let equity = runningBalance;
    if (openTrade) {
      const unrealized = openTrade.amount * (candles[i].close - openTrade.entryPrice);
      equity = runningBalance + unrealized - (runningBalance * commissionRate);
    }
    
    equityCurve.push({
      time: candles[i].time,
      value: equity,
    });
  }

  // Calculate metrics
  const metrics = calculateMetrics(trades, equityCurve, initialBalance, balance);

  return {
    trades,
    signals,
    equityCurve,
    metrics,
    finalBalance: balance,
    error: null,
  };
}

function calculateMetrics(trades, equityCurve, initialBalance, finalBalance) {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      netProfit: 0,
      netProfitPercent: 0,
      grossProfit: 0,
      grossLoss: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      sharpeRatio: 0,
      avgTrade: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      avgDuration: 0,
      totalDuration: 0,
    };
  }

  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl <= 0);
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

  // Max drawdown
  let peak = equityCurve[0]?.value || initialBalance;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  for (const point of equityCurve) {
    if (point.value > peak) peak = point.value;
    const dd = peak - point.value;
    const ddPercent = (dd / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (ddPercent > maxDrawdownPercent) maxDrawdownPercent = ddPercent;
  }

  // Sharpe ratio (simplified — daily returns)
  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const ret = (equityCurve[i].value - equityCurve[i - 1].value) / equityCurve[i - 1].value;
    returns.push(ret);
  }
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdReturn = returns.length > 1 ? 
    Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)) : 0;
  const sharpeRatio = stdReturn === 0 ? 0 : (avgReturn / stdReturn) * Math.sqrt(252);

  const netProfit = finalBalance - initialBalance;
  
  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: (winningTrades.length / trades.length) * 100,
    netProfit,
    netProfitPercent: (netProfit / initialBalance) * 100,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss,
    maxDrawdown,
    maxDrawdownPercent,
    sharpeRatio,
    avgTrade: trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length,
    avgWin: winningTrades.length > 0 ? grossProfit / winningTrades.length : 0,
    avgLoss: losingTrades.length > 0 ? -grossLoss / losingTrades.length : 0,
    largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0,
    largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0,
    avgDuration: trades.reduce((sum, t) => sum + t.duration, 0) / trades.length,
    totalDuration: trades.reduce((sum, t) => sum + t.duration, 0),
  };
}
