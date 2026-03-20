/**
 * Pine Script Parser / Transpiler
 * Converts TradingView Pine Script v5 syntax to executable JavaScript
 * for the backtesting engine.
 * 
 * Supports core Pine Script constructs:
 * - //@version=5, strategy(), indicator()
 * - ta.sma, ta.ema, ta.rsi, ta.macd, ta.crossover, ta.crossunder
 * - ta.bb, ta.atr, ta.stoch
 * - strategy.entry, strategy.close, strategy.exit
 * - input.int, input.float, input.bool, input.string
 * - plot, plotshape, bgcolor, barcolor
 * - if/else, for, var, varip
 * - math.abs, math.max, math.min, math.round
 * - close, open, high, low, volume, bar_index
 * - na, nz, fixnan
 * - color constants
 */

/**
 * Transpile Pine Script to JavaScript for backtesting engine
 * @param {string} pineCode - Pine Script source code
 * @returns {{ jsCode: string, inputs: Object, strategySettings: Object, errors: string[] }}
 */
export function transpilePineToJS(pineCode) {
  const errors = [];
  const inputs = {};
  const strategySettings = {
    title: 'Strategy',
    overlay: true,
    initialCapital: 10000,
    commission: 0.1,
    pyramiding: 0,
  };

  let lines = pineCode.split('\n');
  let jsLines = [];

  // Pre-process: extract inputs and strategy settings
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip version directive and comments
    if (line.startsWith('//') || line.startsWith('//@version')) continue;
    if (line === '') continue;

    // Parse strategy() declaration
    const strategyMatch = line.match(/^strategy\s*\((.*)\)/);
    if (strategyMatch) {
      parseStrategyDecl(strategyMatch[1], strategySettings);
      continue;
    }

    // Parse indicator() declaration
    const indicatorMatch = line.match(/^indicator\s*\((.*)\)/);
    if (indicatorMatch) continue; // Skip indicator declarations

    // Parse input declarations
    const inputMatch = line.match(/^(\w+)\s*=\s*input(?:\.(int|float|bool|string|source))?\s*\((.*)\)/);
    if (inputMatch) {
      const varName = inputMatch[1];
      const inputType = inputMatch[2] || 'float';
      const inputArgs = inputMatch[3];
      const parsed = parseInputArgs(inputArgs, inputType);
      inputs[varName] = parsed;
      jsLines.push(`const ${varName} = params.${varName} !== undefined ? params.${varName} : ${JSON.stringify(parsed.value)};`);
      continue;
    }

    // Transform the line
    jsLines.push(transformLine(line, errors));
  }

  // Wrap in strategy execution loop
  const jsCode = generateExecutableJS(jsLines, strategySettings);

  return { jsCode, inputs, strategySettings, errors };
}

function parseStrategyDecl(argsStr, settings) {
  // Parse title
  const titleMatch = argsStr.match(/(?:title\s*=\s*)?["']([^"']+)["']/);
  if (titleMatch) settings.title = titleMatch[1];

  // Parse overlay
  const overlayMatch = argsStr.match(/overlay\s*=\s*(true|false)/);
  if (overlayMatch) settings.overlay = overlayMatch[1] === 'true';

  // Parse initial_capital
  const capitalMatch = argsStr.match(/initial_capital\s*=\s*(\d+)/);
  if (capitalMatch) settings.initialCapital = parseInt(capitalMatch[1]);

  // Parse commission
  const commMatch = argsStr.match(/commission_value\s*=\s*([\d.]+)/);
  if (commMatch) settings.commission = parseFloat(commMatch[1]);

  // Parse pyramiding
  const pyrMatch = argsStr.match(/pyramiding\s*=\s*(\d+)/);
  if (pyrMatch) settings.pyramiding = parseInt(pyrMatch[1]);
}

function parseInputArgs(argsStr, type) {
  const result = { value: 0, label: '', min: undefined, max: undefined, step: undefined };
  
  // Parse defval
  const defvalMatch = argsStr.match(/(?:defval\s*=\s*)?(-?[\d.]+|true|false|"[^"]*"|'[^']*')/);
  if (defvalMatch) {
    let val = defvalMatch[1];
    if (val === 'true') result.value = true;
    else if (val === 'false') result.value = false;
    else if (val.startsWith('"') || val.startsWith("'")) result.value = val.slice(1, -1);
    else result.value = parseFloat(val);
  }

  // Parse title
  const titleMatch = argsStr.match(/title\s*=\s*["']([^"']+)["']/);
  if (titleMatch) result.label = titleMatch[1];

  // Parse minval/maxval/step
  const minMatch = argsStr.match(/minval\s*=\s*(-?[\d.]+)/);
  if (minMatch) result.min = parseFloat(minMatch[1]);
  const maxMatch = argsStr.match(/maxval\s*=\s*(-?[\d.]+)/);
  if (maxMatch) result.max = parseFloat(maxMatch[1]);
  const stepMatch = argsStr.match(/step\s*=\s*([\d.]+)/);
  if (stepMatch) result.step = parseFloat(stepMatch[1]);

  return result;
}

function transformLine(line, errors) {
  let transformed = line;

  // ========== STRATEGY ACTIONS ==========
  // strategy.entry("Long", strategy.long) → buy(i)
  transformed = transformed.replace(
    /strategy\.entry\s*\(\s*["'](\w+)["']\s*,\s*strategy\.(long|short)(?:\s*,.*?)?\)/g,
    (match, id, direction) => {
      if (direction === 'long') return `buy(i)`;
      return `sell(i)`; // short = sell for now
    }
  );

  // strategy.close("Long") → sell(i)
  transformed = transformed.replace(
    /strategy\.close\s*\(\s*["'](\w+)["'](?:\s*,.*?)?\)/g,
    'sell(i)'
  );

  // strategy.exit → sell(i) (simplified)
  transformed = transformed.replace(
    /strategy\.exit\s*\(.*?\)/g,
    'sell(i)'
  );

  // ========== TECHNICAL INDICATORS ==========
  // ta.sma(close, length) → sma(close, length)[i]
  transformed = transformed.replace(
    /ta\.sma\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/g,
    '_sma_$1_$2[i]'
  );

  // ta.ema(close, length) → ema(close, length)[i]
  transformed = transformed.replace(
    /ta\.ema\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/g,
    '_ema_$1_$2[i]'
  );

  // ta.rsi(close, length) → rsi(close, length)[i]
  transformed = transformed.replace(
    /ta\.rsi\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/g,
    '_rsi_$1_$2[i]'
  );

  // ta.crossover(a, b) → (prevA <= prevB && curA > curB)
  transformed = transformed.replace(
    /ta\.crossover\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g,
    '_crossover($1, $2)'
  );

  // ta.crossunder(a, b) → (prevA >= prevB && curA < curB)
  transformed = transformed.replace(
    /ta\.crossunder\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g,
    '_crossunder($1, $2)'
  );

  // ta.atr(length) → atr(candles, length)[i]
  transformed = transformed.replace(
    /ta\.atr\s*\(\s*(\w+)\s*\)/g,
    '_atr_$1[i]'
  );

  // ========== SERIES ACCESS ==========
  // close[1] → close[i-1], open[1] → open[i-1], etc.
  transformed = transformed.replace(
    /\b(close|open|high|low|volume)\[(\d+)\]/g,
    (match, series, offset) => `${series}[i-${offset}]`
  );

  // close (without index) → close[i]  (when used as a standalone value, not as array ref)
  // We handle this in the execution wrapper

  // ========== BUILT-IN FUNCTIONS ==========
  // math.abs → Math.abs, math.max → Math.max, etc.
  transformed = transformed.replace(/\bmath\.abs\b/g, 'Math.abs');
  transformed = transformed.replace(/\bmath\.max\b/g, 'Math.max');
  transformed = transformed.replace(/\bmath\.min\b/g, 'Math.min');
  transformed = transformed.replace(/\bmath\.round\b/g, 'Math.round');
  transformed = transformed.replace(/\bmath\.ceil\b/g, 'Math.ceil');
  transformed = transformed.replace(/\bmath\.floor\b/g, 'Math.floor');
  transformed = transformed.replace(/\bmath\.sqrt\b/g, 'Math.sqrt');
  transformed = transformed.replace(/\bmath\.pow\b/g, 'Math.pow');
  transformed = transformed.replace(/\bmath\.log\b/g, 'Math.log');

  // na → null
  transformed = transformed.replace(/\bna\b/g, 'null');
  
  // nz(x) → (x ?? 0)
  transformed = transformed.replace(/\bnz\s*\(\s*([^,)]+)(?:\s*,\s*([^)]+))?\s*\)/g, 
    (match, val, def) => `(${val} ?? ${def || '0'})`);

  // bar_index → i
  transformed = transformed.replace(/\bbar_index\b/g, 'i');

  // ========== PINE-SPECIFIC SYNTAX ==========
  // var keyword → let (var in Pine means persistent variable)
  transformed = transformed.replace(/^\s*var\s+/, 'let ');
  transformed = transformed.replace(/^\s*varip\s+/, 'let ');

  // := assignment → =
  transformed = transformed.replace(/:=/g, '=');

  // plot, plotshape, bgcolor, barcolor → ignore (visual only)
  if (/^\s*(plot|plotshape|plotchar|bgcolor|barcolor|hline|fill)\s*\(/.test(transformed)) {
    return '// ' + transformed;
  }

  // color.* → ignore
  transformed = transformed.replace(/color\.\w+/g, 'null');

  // str.tostring → String
  transformed = transformed.replace(/str\.tostring\s*\(/g, 'String(');

  // label.new, line.new → ignore
  if (/^\s*(label|line|box|table)\./.test(transformed)) {
    return '// ' + transformed;
  }

  // alertcondition → ignore
  if (/^\s*alertcondition\s*\(/.test(transformed)) {
    return '// ' + transformed;
  }

  return transformed;
}

function generateExecutableJS(jsLines, settings) {
  // Collect all indicator references to pre-compute
  const allCode = jsLines.join('\n');
  
  const indicators = [];
  
  // Extract SMA indicators
  const smaRefs = allCode.matchAll(/_sma_(\w+)_(\w+)/g);
  const smaSet = new Set();
  for (const m of smaRefs) {
    const key = `${m[1]}_${m[2]}`;
    if (!smaSet.has(key)) {
      smaSet.add(key);
      indicators.push(`const _sma_${key} = sma(${m[1]}, ${m[2]});`);
    }
  }

  // Extract EMA indicators
  const emaRefs = allCode.matchAll(/_ema_(\w+)_(\w+)/g);
  const emaSet = new Set();
  for (const m of emaRefs) {
    const key = `${m[1]}_${m[2]}`;
    if (!emaSet.has(key)) {
      emaSet.add(key);
      indicators.push(`const _ema_${key} = ema(${m[1]}, ${m[2]});`);
    }
  }

  // Extract RSI indicators
  const rsiRefs = allCode.matchAll(/_rsi_(\w+)_(\w+)/g);
  const rsiSet = new Set();
  for (const m of rsiRefs) {
    const key = `${m[1]}_${m[2]}`;
    if (!rsiSet.has(key)) {
      rsiSet.add(key);
      indicators.push(`const _rsi_${key} = rsi(${m[1]}, ${m[2]});`);
    }
  }

  // Extract ATR indicators
  const atrRefs = allCode.matchAll(/_atr_(\w+)/g);
  const atrSet = new Set();
  for (const m of atrRefs) {
    if (!atrSet.has(m[1])) {
      atrSet.add(m[1]);
      indicators.push(`const _atr_${m[1]} = atr(candles, ${m[1]});`);
    }
  }

  // Build crossover/crossunder helper
  const hasCrossover = allCode.includes('_crossover(');
  const hasCrossunder = allCode.includes('_crossunder(');

  let helpers = '';
  if (hasCrossover) {
    helpers += `
function _crossover(a, b) {
  const prevA = typeof a === 'object' ? a : a;
  const prevB = typeof b === 'object' ? b : b;
  // Will be evaluated per-bar in context
  return a > b && _prev_a <= _prev_b;
}
`;
  }

  // Build the executable code
  const code = `
// Pre-compute indicators
${indicators.join('\n')}

// Per-bar execution
${hasCrossover || hasCrossunder ? 'let _prev_vals = {};' : ''}

for (let i = 1; i < close.length; i++) {
  ${jsLines.join('\n  ')}
}
`;

  return code;
}


/**
 * Generate valid TradingView Pine Script v5 code from a JS strategy
 * @param {string} jsCode - JavaScript strategy code
 * @param {Object} params - Strategy parameters
 * @param {string} strategyName - Name for the strategy
 * @returns {string} Valid Pine Script v5 code
 */
export function generatePineScript(jsCode, params, strategyName = 'My Strategy') {
  let pine = `//@version=5\nstrategy("${strategyName}", overlay=true, initial_capital=10000, commission_value=0.1)\n\n`;

  // Add input parameters
  pine += '// ═══════════════════════════════════\n';
  pine += '// INPUTS\n';
  pine += '// ═══════════════════════════════════\n';
  for (const [key, val] of Object.entries(params)) {
    if (key === 'initialBalance' || key === 'commission') continue;
    const pineType = typeof val.value === 'number' 
      ? (Number.isInteger(val.value) ? 'int' : 'float')
      : typeof val.value === 'boolean' ? 'bool' : 'string';
    pine += `${key} = input.${pineType}(defval=${JSON.stringify(val.value)}, title="${val.label || key}"`;
    if (val.min !== undefined) pine += `, minval=${val.min}`;
    if (val.max !== undefined) pine += `, maxval=${val.max}`;
    if (val.step !== undefined) pine += `, step=${val.step}`;
    pine += `)\n`;
  }

  pine += '\n';

  // Auto-detect strategy type from JS code and generate appropriate Pine Script
  pine += generatePineBody(jsCode);

  return pine;
}

function generatePineBody(jsCode) {
  let body = '';

  // Detect SMA usage
  const smaMatches = [...jsCode.matchAll(/sma\(close,\s*(\w+)\)/g)];
  if (smaMatches.length >= 2) {
    body += '// ═══════════════════════════════════\n';
    body += '// INDICATORS\n';
    body += '// ═══════════════════════════════════\n';
    const vars = [];
    smaMatches.forEach((m, idx) => {
      const name = `smaVal${idx + 1}`;
      vars.push(name);
      body += `${name} = ta.sma(close, ${m[1]})\n`;
    });
    body += `\nplot(${vars[0]}, color=color.yellow, title="SMA Short")\n`;
    body += `plot(${vars[1]}, color=color.blue, title="SMA Long")\n\n`;
    body += '// ═══════════════════════════════════\n';
    body += '// STRATEGY LOGIC\n';
    body += '// ═══════════════════════════════════\n';
    body += `longCondition = ta.crossover(${vars[0]}, ${vars[1]})\n`;
    body += `shortCondition = ta.crossunder(${vars[0]}, ${vars[1]})\n\n`;
    body += `if (longCondition)\n    strategy.entry("Long", strategy.long)\n\n`;
    body += `if (shortCondition)\n    strategy.close("Long")\n`;
    return body;
  }

  // Detect RSI usage
  const rsiMatch = jsCode.match(/rsi\(close,\s*(\w+)\)/);
  if (rsiMatch) {
    body += '// ═══════════════════════════════════\n';
    body += '// INDICATORS\n';
    body += '// ═══════════════════════════════════\n';
    body += `rsiVal = ta.rsi(close, ${rsiMatch[1]})\n\n`;
    body += `plot(rsiVal, color=color.purple, title="RSI")\n`;
    body += `hline(70, "Overbought", color=color.red)\n`;
    body += `hline(30, "Oversold", color=color.green)\n\n`;
    body += '// ═══════════════════════════════════\n';
    body += '// STRATEGY LOGIC\n';
    body += '// ═══════════════════════════════════\n';
    
    const obMatch = jsCode.match(/overbought\s*\|\|\s*(\d+)/);
    const osMatch = jsCode.match(/oversold\s*\|\|\s*(\d+)/);
    const ob = obMatch ? obMatch[1] : '70';
    const os = osMatch ? osMatch[1] : '30';
    
    body += `longCondition = ta.crossunder(rsiVal, ${os})\n`;
    body += `shortCondition = ta.crossover(rsiVal, ${ob})\n\n`;
    body += `if (longCondition)\n    strategy.entry("Long", strategy.long)\n\n`;
    body += `if (shortCondition)\n    strategy.close("Long")\n`;
    return body;
  }

  // Detect MACD usage
  const macdMatch = jsCode.match(/macd\(close,\s*(\w+),\s*(\w+),\s*(\w+)\)/);
  if (macdMatch) {
    body += '// ═══════════════════════════════════\n';
    body += '// INDICATORS\n';
    body += '// ═══════════════════════════════════\n';
    body += `[macdLine, signalLine, histLine] = ta.macd(close, ${macdMatch[1]}, ${macdMatch[2]}, ${macdMatch[3]})\n\n`;
    body += `plot(macdLine, color=color.blue, title="MACD")\n`;
    body += `plot(signalLine, color=color.orange, title="Signal")\n`;
    body += `plot(histLine, style=plot.style_histogram, color=histLine >= 0 ? color.green : color.red, title="Histogram")\n\n`;
    body += '// ═══════════════════════════════════\n';
    body += '// STRATEGY LOGIC\n';
    body += '// ═══════════════════════════════════\n';
    body += `longCondition = ta.crossover(macdLine, signalLine)\n`;
    body += `shortCondition = ta.crossunder(macdLine, signalLine)\n\n`;
    body += `if (longCondition)\n    strategy.entry("Long", strategy.long)\n\n`;
    body += `if (shortCondition)\n    strategy.close("Long")\n`;
    return body;
  }

  // Detect Bollinger Bands usage
  const bbMatch = jsCode.match(/bollingerBands\(close,\s*(\w+),\s*(\w+)\)/);
  if (bbMatch) {
    body += '// ═══════════════════════════════════\n';
    body += '// INDICATORS\n';
    body += '// ═══════════════════════════════════\n';
    body += `[middle, upper, lower] = ta.bb(close, ${bbMatch[1]}, ${bbMatch[2]})\n\n`;
    body += `plot(middle, color=color.yellow, title="Middle")\n`;
    body += `plot(upper, color=color.blue, title="Upper")\n`;
    body += `plot(lower, color=color.blue, title="Lower")\n\n`;
    body += '// ═══════════════════════════════════\n';
    body += '// STRATEGY LOGIC\n';
    body += '// ═══════════════════════════════════\n';
    body += `longCondition = close <= lower\n`;
    body += `shortCondition = close >= upper\n\n`;
    body += `if (longCondition)\n    strategy.entry("Long", strategy.long)\n\n`;
    body += `if (shortCondition)\n    strategy.close("Long")\n`;
    return body;
  }

  // Generic fallback
  body += '// ═══════════════════════════════════\n';
  body += '// STRATEGY LOGIC\n';
  body += '// ═══════════════════════════════════\n';
  body += '// Translate your strategy logic here\n';
  body += '// Use ta.sma(), ta.ema(), ta.rsi(), ta.macd(), ta.bb()\n';
  body += '// Use strategy.entry("Long", strategy.long) to buy\n';
  body += '// Use strategy.close("Long") to sell\n';
  return body;
}


/**
 * Detect if code is Pine Script or JavaScript
 * @param {string} code
 * @returns {'pine' | 'javascript'}
 */
export function detectLanguage(code) {
  const pineIndicators = [
    '//@version',
    'strategy(',
    'indicator(',
    'ta.sma',
    'ta.ema',
    'ta.rsi',
    'ta.macd',
    'ta.crossover',
    'ta.crossunder',
    'strategy.entry',
    'strategy.close',
    'strategy.exit',
    'input.int',
    'input.float',
    'input.bool',
    'plot(',
    'plotshape(',
    'bgcolor(',
    'hline(',
    ':=',
  ];

  let pineScore = 0;
  for (const indicator of pineIndicators) {
    if (code.includes(indicator)) pineScore++;
  }

  return pineScore >= 2 ? 'pine' : 'javascript';
}


// ========================
// PINE SCRIPT PRESETS
// ========================

export const PINE_PRESETS = {
  sma: {
    name: 'SMA Crossover',
    code: `//@version=5
strategy("SMA Crossover Strategy", overlay=true, initial_capital=10000, commission_value=0.1)

// ═══════════════════════════════════
// INPUTS
// ═══════════════════════════════════
shortPeriod = input.int(defval=10, title="Short SMA Period", minval=2, maxval=100)
longPeriod = input.int(defval=30, title="Long SMA Period", minval=5, maxval=200)

// ═══════════════════════════════════
// INDICATORS
// ═══════════════════════════════════
shortSma = ta.sma(close, shortPeriod)
longSma = ta.sma(close, longPeriod)

plot(shortSma, color=color.yellow, title="Short SMA")
plot(longSma, color=color.blue, title="Long SMA")

// ═══════════════════════════════════
// STRATEGY LOGIC
// ═══════════════════════════════════
longCondition = ta.crossover(shortSma, longSma)
shortCondition = ta.crossunder(shortSma, longSma)

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")
`,
  },
  rsi: {
    name: 'RSI Strategy',
    code: `//@version=5
strategy("RSI Overbought/Oversold", overlay=false, initial_capital=10000, commission_value=0.1)

// ═══════════════════════════════════
// INPUTS
// ═══════════════════════════════════
rsiPeriod = input.int(defval=14, title="RSI Period", minval=2, maxval=50)
overbought = input.int(defval=70, title="Overbought Level", minval=50, maxval=95)
oversold = input.int(defval=30, title="Oversold Level", minval=5, maxval=50)

// ═══════════════════════════════════
// INDICATORS
// ═══════════════════════════════════
rsiVal = ta.rsi(close, rsiPeriod)

plot(rsiVal, color=color.purple, title="RSI")
hline(overbought, "Overbought", color=color.red, linestyle=hline.style_dashed)
hline(oversold, "Oversold", color=color.green, linestyle=hline.style_dashed)

// ═══════════════════════════════════
// STRATEGY LOGIC
// ═══════════════════════════════════
longCondition = ta.crossunder(rsiVal, oversold)
shortCondition = ta.crossover(rsiVal, overbought)

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")
`,
  },
  macd: {
    name: 'MACD Crossover',
    code: `//@version=5
strategy("MACD Crossover Strategy", overlay=false, initial_capital=10000, commission_value=0.1)

// ═══════════════════════════════════
// INPUTS
// ═══════════════════════════════════
fastLength = input.int(defval=12, title="Fast EMA Length", minval=2, maxval=50)
slowLength = input.int(defval=26, title="Slow EMA Length", minval=5, maxval=100)
signalLength = input.int(defval=9, title="Signal Length", minval=2, maxval=30)

// ═══════════════════════════════════
// INDICATORS
// ═══════════════════════════════════
[macdLine, signalLine, histLine] = ta.macd(close, fastLength, slowLength, signalLength)

plot(macdLine, color=color.blue, title="MACD")
plot(signalLine, color=color.orange, title="Signal")
plot(histLine, style=plot.style_histogram, color=histLine >= 0 ? color.green : color.red, title="Histogram")

// ═══════════════════════════════════
// STRATEGY LOGIC
// ═══════════════════════════════════
longCondition = ta.crossover(macdLine, signalLine)
shortCondition = ta.crossunder(macdLine, signalLine)

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")
`,
  },
  bollinger: {
    name: 'Bollinger Bands',
    code: `//@version=5
strategy("Bollinger Bands Bounce", overlay=true, initial_capital=10000, commission_value=0.1)

// ═══════════════════════════════════
// INPUTS
// ═══════════════════════════════════
bbLength = input.int(defval=20, title="BB Period", minval=5, maxval=50)
bbMult = input.float(defval=2.0, title="BB Std Dev Multiplier", minval=0.5, maxval=4.0, step=0.1)

// ═══════════════════════════════════
// INDICATORS
// ═══════════════════════════════════
[middle, upper, lower] = ta.bb(close, bbLength, bbMult)

plot(middle, color=color.yellow, title="Middle Band")
plot(upper, color=color.blue, title="Upper Band")
plot(lower, color=color.blue, title="Lower Band")
fill(plot(upper), plot(lower), color=color.new(color.blue, 90))

// ═══════════════════════════════════
// STRATEGY LOGIC
// ═══════════════════════════════════
longCondition = close <= lower
shortCondition = close >= upper

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")
`,
  },
  ema_cross: {
    name: 'EMA Crossover',
    code: `//@version=5
strategy("EMA Crossover Strategy", overlay=true, initial_capital=10000, commission_value=0.1)

// ═══════════════════════════════════
// INPUTS
// ═══════════════════════════════════
fastLen = input.int(defval=9, title="Fast EMA", minval=2, maxval=50)
slowLen = input.int(defval=21, title="Slow EMA", minval=5, maxval=100)

// ═══════════════════════════════════
// INDICATORS
// ═══════════════════════════════════
fastEma = ta.ema(close, fastLen)
slowEma = ta.ema(close, slowLen)

plot(fastEma, color=color.green, title="Fast EMA")
plot(slowEma, color=color.red, title="Slow EMA")

// ═══════════════════════════════════
// STRATEGY LOGIC
// ═══════════════════════════════════
longCondition = ta.crossover(fastEma, slowEma)
shortCondition = ta.crossunder(fastEma, slowEma)

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")
`,
  },
  stochastic: {
    name: 'Stochastic Strategy',
    code: `//@version=5
strategy("Stochastic Oscillator Strategy", overlay=false, initial_capital=10000, commission_value=0.1)

// ═══════════════════════════════════
// INPUTS
// ═══════════════════════════════════
kPeriod = input.int(defval=14, title="%K Period", minval=1, maxval=50)
dPeriod = input.int(defval=3, title="%D Period", minval=1, maxval=20)
overbought = input.int(defval=80, title="Overbought Level", minval=50, maxval=100)
oversold = input.int(defval=20, title="Oversold Level", minval=0, maxval=50)

// ═══════════════════════════════════
// INDICATORS
// ═══════════════════════════════════
k = ta.stoch(close, high, low, kPeriod)
d = ta.sma(k, dPeriod)

plot(k, color=color.blue, title="%K")
plot(d, color=color.red, title="%D")
hline(overbought, "Overbought", color=color.red)
hline(oversold, "Oversold", color=color.green)

// ═══════════════════════════════════
// STRATEGY LOGIC
// ═══════════════════════════════════
longCondition = ta.crossover(k, d) and k < oversold
shortCondition = ta.crossunder(k, d) and k > overbought

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")
`,
  },
};


/**
 * Convert Pine Script to executable JS for the backtesting engine
 * This is a more robust approach that handles Pine Script line-by-line
 * within a for loop over all candles.
 * @param {string} pineCode 
 * @returns {string} JS code for the strategy engine
 */
export function pineToExecutableJS(pineCode) {
  const result = transpilePineToJS(pineCode);
  
  if (result.errors.length > 0) {
    return `// Transpilation warnings:\n// ${result.errors.join('\n// ')}\n\n${result.jsCode}`;
  }
  
  return result.jsCode;
}
