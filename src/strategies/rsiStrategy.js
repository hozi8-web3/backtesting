/**
 * RSI Strategy
 * Buys when RSI drops below oversold level
 * Sells when RSI rises above overbought level
 */

export const name = 'RSI Overbought/Oversold';
export const description = 'Buy oversold, sell overbought using RSI';
export const icon = '📉';

export const defaultParams = {
  rsiPeriod: { label: 'RSI Period', value: 14, min: 2, max: 50, step: 1 },
  overbought: { label: 'Overbought', value: 70, min: 50, max: 95, step: 1 },
  oversold: { label: 'Oversold', value: 30, min: 5, max: 50, step: 1 },
  initialBalance: { label: 'Initial Balance', value: 10000, min: 100, max: 1000000, step: 100 },
  commission: { label: 'Commission %', value: 0.1, min: 0, max: 1, step: 0.01 },
};

export function getCode(p) {
  return `// RSI Overbought/Oversold Strategy
// Buy when RSI drops below oversold level
// Sell when RSI rises above overbought level

const rsiPeriod = params.rsiPeriod || ${p.rsiPeriod};
const overbought = params.overbought || ${p.overbought};
const oversold = params.oversold || ${p.oversold};

// Calculate RSI
const rsiValues = rsi(close, rsiPeriod);

// Execute trades
for (let i = rsiPeriod + 1; i < close.length; i++) {
  if (rsiValues[i] !== null && rsiValues[i - 1] !== null) {
    // Buy when RSI crosses below oversold
    if (rsiValues[i - 1] >= oversold && rsiValues[i] < oversold) {
      buy(i);
    }
    // Sell when RSI crosses above overbought
    if (rsiValues[i - 1] <= overbought && rsiValues[i] > overbought) {
      sell(i);
    }
  }
}
`;
}
