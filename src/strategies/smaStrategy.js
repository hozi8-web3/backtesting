/**
 * SMA Crossover Strategy
 * Buys when short SMA crosses above long SMA
 * Sells when short SMA crosses below long SMA
 */

export const name = 'SMA Crossover';
export const description = 'Classic moving average crossover strategy';
export const icon = '📈';

export const defaultParams = {
  shortPeriod: { label: 'Short SMA', value: 10, min: 2, max: 100, step: 1 },
  longPeriod: { label: 'Long SMA', value: 30, min: 5, max: 200, step: 1 },
  initialBalance: { label: 'Initial Balance', value: 10000, min: 100, max: 1000000, step: 100 },
  commission: { label: 'Commission %', value: 0.1, min: 0, max: 1, step: 0.01 },
};

export function getCode(p) {
  return `// SMA Crossover Strategy
// Buy when short SMA crosses above long SMA
// Sell when short SMA crosses below long SMA

const shortPeriod = params.shortPeriod || ${p.shortPeriod};
const longPeriod = params.longPeriod || ${p.longPeriod};

// Calculate indicators
const shortSma = sma(close, shortPeriod);
const longSma = sma(close, longPeriod);

// Detect crossovers
const bullishCross = crossover(shortSma, longSma);
const bearishCross = crossunder(shortSma, longSma);

// Execute trades
for (let i = longPeriod; i < close.length; i++) {
  if (bullishCross[i]) {
    buy(i);
  } else if (bearishCross[i]) {
    sell(i);
  }
}
`;
}
