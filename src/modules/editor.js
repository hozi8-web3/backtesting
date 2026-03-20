/**
 * Code Editor Module
 * CodeMirror 6 with dual-mode: JavaScript & Pine Script
 */
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { autocompletion } from '@codemirror/autocomplete';
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

let editorView = null;
let currentMode = 'pine'; // 'pine' or 'javascript'

// ========================
// PINE SCRIPT AUTOCOMPLETE
// ========================
const pineCompletions = [
  // Strategy
  { label: 'strategy', type: 'keyword', detail: '(title, overlay, ...)', info: 'Declare a strategy' },
  { label: 'strategy.entry', type: 'function', detail: '(id, direction)', info: 'Open a position' },
  { label: 'strategy.close', type: 'function', detail: '(id)', info: 'Close a position' },
  { label: 'strategy.exit', type: 'function', detail: '(id, from_entry, ...)', info: 'Exit with SL/TP' },
  { label: 'strategy.long', type: 'constant', info: 'Long direction constant' },
  { label: 'strategy.short', type: 'constant', info: 'Short direction constant' },
  // Inputs
  { label: 'input.int', type: 'function', detail: '(defval, title, ...)', info: 'Integer input parameter' },
  { label: 'input.float', type: 'function', detail: '(defval, title, ...)', info: 'Float input parameter' },
  { label: 'input.bool', type: 'function', detail: '(defval, title)', info: 'Boolean input parameter' },
  { label: 'input.string', type: 'function', detail: '(defval, title, options)', info: 'String input parameter' },
  { label: 'input.source', type: 'function', detail: '(defval, title)', info: 'Source input (close, open, etc)' },
  // Technical Analysis
  { label: 'ta.sma', type: 'function', detail: '(source, length)', info: 'Simple Moving Average' },
  { label: 'ta.ema', type: 'function', detail: '(source, length)', info: 'Exponential Moving Average' },
  { label: 'ta.rsi', type: 'function', detail: '(source, length)', info: 'Relative Strength Index' },
  { label: 'ta.macd', type: 'function', detail: '(source, fast, slow, signal)', info: 'MACD — returns [macd, signal, hist]' },
  { label: 'ta.bb', type: 'function', detail: '(source, length, mult)', info: 'Bollinger Bands — returns [middle, upper, lower]' },
  { label: 'ta.atr', type: 'function', detail: '(length)', info: 'Average True Range' },
  { label: 'ta.stoch', type: 'function', detail: '(close, high, low, length)', info: 'Stochastic %K' },
  { label: 'ta.crossover', type: 'function', detail: '(a, b)', info: 'True when a crosses above b' },
  { label: 'ta.crossunder', type: 'function', detail: '(a, b)', info: 'True when a crosses below b' },
  { label: 'ta.highest', type: 'function', detail: '(source, length)', info: 'Highest value over period' },
  { label: 'ta.lowest', type: 'function', detail: '(source, length)', info: 'Lowest value over period' },
  { label: 'ta.change', type: 'function', detail: '(source, length)', info: 'Difference from N bars ago' },
  { label: 'ta.tr', type: 'function', detail: '(handleNaN)', info: 'True Range' },
  { label: 'ta.vwma', type: 'function', detail: '(source, length)', info: 'Volume-Weighted MA' },
  { label: 'ta.wma', type: 'function', detail: '(source, length)', info: 'Weighted Moving Average' },
  // Plotting
  { label: 'plot', type: 'function', detail: '(series, title, color, ...)', info: 'Plot a line on chart' },
  { label: 'plotshape', type: 'function', detail: '(series, title, ...)', info: 'Plot a shape on chart' },
  { label: 'bgcolor', type: 'function', detail: '(color, ...)', info: 'Set background color' },
  { label: 'hline', type: 'function', detail: '(price, title, color)', info: 'Horizontal line' },
  { label: 'fill', type: 'function', detail: '(plot1, plot2, color)', info: 'Fill between plots' },
  // Data
  { label: 'close', type: 'variable', info: 'Close price of current bar' },
  { label: 'open', type: 'variable', info: 'Open price of current bar' },
  { label: 'high', type: 'variable', info: 'High price of current bar' },
  { label: 'low', type: 'variable', info: 'Low price of current bar' },
  { label: 'volume', type: 'variable', info: 'Volume of current bar' },
  { label: 'bar_index', type: 'variable', info: 'Current bar number' },
  // Misc
  { label: 'na', type: 'constant', info: 'Not available value' },
  { label: 'nz', type: 'function', detail: '(value, replacement)', info: 'Replace na with value' },
  { label: 'math.abs', type: 'function', detail: '(value)', info: 'Absolute value' },
  { label: 'math.max', type: 'function', detail: '(a, b)', info: 'Maximum of two values' },
  { label: 'math.min', type: 'function', detail: '(a, b)', info: 'Minimum of two values' },
  { label: 'math.round', type: 'function', detail: '(value)', info: 'Round to nearest integer' },
  // Colors
  { label: 'color.green', type: 'constant', info: 'Green color' },
  { label: 'color.red', type: 'constant', info: 'Red color' },
  { label: 'color.blue', type: 'constant', info: 'Blue color' },
  { label: 'color.yellow', type: 'constant', info: 'Yellow color' },
  { label: 'color.purple', type: 'constant', info: 'Purple color' },
  { label: 'color.orange', type: 'constant', info: 'Orange color' },
  { label: 'color.white', type: 'constant', info: 'White color' },
  { label: 'color.new', type: 'function', detail: '(color, transparency)', info: 'Color with transparency 0-100' },
];

// JavaScript strategy autocomplete
const jsCompletions = [
  { label: 'sma', type: 'function', detail: '(data, period)', info: 'Simple Moving Average' },
  { label: 'ema', type: 'function', detail: '(data, period)', info: 'Exponential Moving Average' },
  { label: 'rsi', type: 'function', detail: '(data, period)', info: 'Relative Strength Index' },
  { label: 'macd', type: 'function', detail: '(data, fast, slow, signal)', info: 'MACD Indicator' },
  { label: 'bollingerBands', type: 'function', detail: '(data, period, stdDev)', info: 'Bollinger Bands' },
  { label: 'atr', type: 'function', detail: '(candles, period)', info: 'Average True Range' },
  { label: 'stochastic', type: 'function', detail: '(candles, kPeriod, dPeriod)', info: 'Stochastic Oscillator' },
  { label: 'crossover', type: 'function', detail: '(a, b)', info: 'Detects bullish crossover' },
  { label: 'crossunder', type: 'function', detail: '(a, b)', info: 'Detects bearish crossunder' },
  { label: 'buy', type: 'function', detail: '(index)', info: 'Open a long position' },
  { label: 'sell', type: 'function', detail: '(index)', info: 'Close position' },
  { label: 'close', type: 'variable', detail: 'number[]', info: 'Close prices array' },
  { label: 'open', type: 'variable', detail: 'number[]', info: 'Open prices array' },
  { label: 'high', type: 'variable', detail: 'number[]', info: 'High prices array' },
  { label: 'low', type: 'variable', detail: 'number[]', info: 'Low prices array' },
  { label: 'volume', type: 'variable', detail: 'number[]', info: 'Volume array' },
  { label: 'candles', type: 'variable', detail: 'Object[]', info: 'Full OHLCV candle objects' },
  { label: 'params', type: 'variable', detail: 'Object', info: 'Strategy parameters from UI' },
];

function createAutocomplete(mode) {
  return function(context) {
    const word = context.matchBefore(/[\w.]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    const completions = mode === 'pine' ? pineCompletions : jsCompletions;
    return { from: word.from, options: completions };
  };
}

// Custom dark theme
const customTheme = EditorView.theme({
  '&': { backgroundColor: '#111827', color: '#e2e8f0', fontSize: '13px' },
  '.cm-content': { fontFamily: "'JetBrains Mono', 'Fira Code', monospace", padding: '8px 0' },
  '.cm-gutters': { backgroundColor: '#0f172a', color: '#475569', border: 'none', borderRight: '1px solid rgba(99, 102, 241, 0.08)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(99, 102, 241, 0.08)', color: '#818cf8' },
  '.cm-activeLine': { backgroundColor: 'rgba(99, 102, 241, 0.05)' },
  '.cm-cursor': { borderLeftColor: '#6366f1', borderLeftWidth: '2px' },
  '.cm-selectionBackground': { backgroundColor: 'rgba(99, 102, 241, 0.2) !important' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(99, 102, 241, 0.25) !important' },
  '.cm-matchingBracket': { backgroundColor: 'rgba(99, 102, 241, 0.2)', outline: '1px solid rgba(99, 102, 241, 0.4)' },
  '.cm-tooltip': { backgroundColor: '#1a2236', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' },
  '.cm-tooltip-autocomplete': { '& > ul > li': { padding: '4px 8px' }, '& > ul > li[aria-selected]': { backgroundColor: 'rgba(99, 102, 241, 0.2)' } },
}, { dark: true });

/**
 * Initialize the code editor
 * @param {HTMLElement} container
 * @param {string} initialCode
 * @param {string} mode - 'pine' or 'javascript'
 */
export function initEditor(container, initialCode = '', mode = 'pine') {
  currentMode = mode;
  if (editorView) {
    editorView.destroy();
  }

  const state = EditorState.create({
    doc: initialCode,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      foldGutter(),
      indentOnInput(),
      bracketMatching(),
      javascript(), // JS syntax works reasonably for Pine too
      autocompletion({ override: [createAutocomplete(mode)], icons: true }),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      oneDark,
      customTheme,
      EditorView.lineWrapping,
    ],
  });

  editorView = new EditorView({ state, parent: container });
  return editorView;
}

/**
 * Get current editor code
 */
export function getCode() {
  if (!editorView) return '';
  return editorView.state.doc.toString();
}

/**
 * Set editor code
 */
export function setCode(code) {
  if (!editorView) return;
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: code },
  });
}

/**
 * Get current editor mode
 */
export function getEditorMode() {
  return currentMode;
}

/**
 * Switch editor mode (rebuilds completions)
 */
export function setEditorMode(mode) {
  currentMode = mode;
  const code = getCode();
  const container = editorView?.dom?.parentElement;
  if (container) {
    initEditor(container, code, mode);
  }
}

export function getEditor() {
  return editorView;
}
