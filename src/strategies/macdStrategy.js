/**
 * MACD Crossover Strategy
 * Buys when MACD line crosses above signal line
 * Sells when MACD line crosses below signal line
 */

export const name = 'MACD Crossover';
export const description = 'Trade MACD line & signal line crossovers';
export const icon = '📊';

export const defaultParams = {
  fastPeriod: { label: 'Fast EMA', value: 12, min: 2, max: 50, step: 1 },
  slowPeriod: { label: 'Slow EMA', value: 26, min: 5, max: 100, step: 1 },
  signalPeriod: { label: 'Signal', value: 9, min: 2, max: 30, step: 1 },
  initialBalance: { label: 'Initial Balance', value: 10000, min: 100, max: 1000000, step: 100 },
  commission: { label: 'Commission %', value: 0.1, min: 0, max: 1, step: 0.01 },
};

export function getCode(p) {
  return `// MACD Crossover Strategy
// Buy when MACD line crosses above signal line
// Sell when MACD line crosses below signal line

const fastPeriod = params.fastPeriod || ${p.fastPeriod};
const slowPeriod = params.slowPeriod || ${p.slowPeriod};
const signalPeriod = params.signalPeriod || ${p.signalPeriod};

// Calculate MACD
const { macdLine, signalLine } = macd(close, fastPeriod, slowPeriod, signalPeriod);

// Detect crossovers
const bullishCross = crossover(macdLine, signalLine);
const bearishCross = crossunder(macdLine, signalLine);

// Execute trades
for (let i = slowPeriod + signalPeriod; i < close.length; i++) {
  if (bullishCross[i]) {
    buy(i);
  } else if (bearishCross[i]) {
    sell(i);
  }
}
`;
}
