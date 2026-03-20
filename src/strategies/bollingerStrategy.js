/**
 * Bollinger Bands Bounce Strategy
 * Buys when price touches lower band
 * Sells when price touches upper band
 */

export const name = 'Bollinger Bands';
export const description = 'Buy at lower band, sell at upper band';
export const icon = '🎯';

export const defaultParams = {
  period: { label: 'BB Period', value: 20, min: 5, max: 50, step: 1 },
  stdDev: { label: 'Std Dev', value: 2, min: 0.5, max: 4, step: 0.1 },
  initialBalance: { label: 'Initial Balance', value: 10000, min: 100, max: 1000000, step: 100 },
  commission: { label: 'Commission %', value: 0.1, min: 0, max: 1, step: 0.01 },
};

export function getCode(p) {
  return `// Bollinger Bands Bounce Strategy
// Buy when price touches lower Bollinger Band
// Sell when price touches upper Bollinger Band

const bbPeriod = params.period || ${p.period};
const bbStdDev = params.stdDev || ${p.stdDev};

// Calculate Bollinger Bands
const bb = bollingerBands(close, bbPeriod, bbStdDev);

// Execute trades
for (let i = bbPeriod; i < close.length; i++) {
  if (bb.lower[i] !== null && bb.upper[i] !== null) {
    // Buy when price closes below lower band
    if (close[i] <= bb.lower[i]) {
      buy(i);
    }
    // Sell when price closes above upper band
    if (close[i] >= bb.upper[i]) {
      sell(i);
    }
  }
}
`;
}
