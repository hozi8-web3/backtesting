/**
 * CryptoBacktest Pro — Main Entry Point
 * Full Pine Script + JavaScript dual-mode strategy backtesting
 */
import './styles/variables.css';
import './styles/global.css';
import './styles/components.css';
import './styles/layout.css';

import { fetchCandles, clearCache, setDataRange, getDataRange } from './modules/marketData.js';
import { initChart, setData, setMarkers, clearOverlays, addLineSeries } from './modules/chart.js';
import { initEditor, getCode, setCode, getEditorMode, setEditorMode } from './modules/editor.js';
import { runBacktest, sma, ema } from './modules/strategyEngine.js';
import { displayResults, showTab, exportCSV } from './modules/results.js';
import { initPanel, getParams, getCurrentStrategy, saveStrategy, getStrategyType } from './modules/strategyPanel.js';
import { detectLanguage, generatePineScript, pineToExecutableJS } from './modules/pineParser.js';

// ========================
// STATE
// ========================
let currentPair = 'BTCUSDT';
let currentTimeframe = '1h';
let candleData = [];
let lastResults = null;
let currentEditorMode = 'pine'; // 'pine' or 'javascript'

// ========================
// INITIALIZE
// ========================

async function init() {
  // Init chart
  const chartContainer = document.getElementById('chart');
  initChart(chartContainer);

  // Init editor (start in Pine mode)
  const editorWrapper = document.getElementById('editor-wrapper');
  initEditor(editorWrapper, '', 'pine');

  // Init strategy panel
  initPanel(
    // onStrategyChange
    (strategy, params, customCode, customType) => {
      if (customCode) {
        // Loading a saved strategy
        const type = customType || detectLanguage(customCode);
        switchEditorMode(type);
        setCode(customCode);
      } else if (strategy) {
        const type = strategy.type || 'pine';
        switchEditorMode(type);
        if (type === 'pine' && strategy.preset) {
          setCode(strategy.preset.code);
        } else if (strategy.jsModule) {
          setCode(strategy.jsModule.getCode(params));
        }
      }
    },
    // onParamsChange
    (params) => {
      const strategy = getCurrentStrategy();
      if (strategy) {
        if (strategy.type === 'pine' && strategy.preset) {
          // For Pine presets, reload the preset code
          setCode(strategy.preset.code);
        } else if (strategy.jsModule) {
          setCode(strategy.jsModule.getCode(params));
        }
      }
    }
  );

  // Load initial data
  await loadData();

  // Setup event listeners
  setupEventListeners();

  // Set initial strategy code (Pine SMA Crossover)
  const strategy = getCurrentStrategy();
  if (strategy && strategy.preset) {
    setCode(strategy.preset.code);
  }
}

// ========================
// DATA LOADING
// ========================

async function loadData() {
  const chartContainer = document.getElementById('chart-container');
  chartContainer.classList.add('loading');
  updateStatus('Loading data...');

  try {
    candleData = await fetchCandles(currentPair, currentTimeframe);
    setData(candleData);
    
    document.getElementById('status-candles').textContent = `${candleData.length} candles`;
    document.getElementById('status-pair').textContent = currentPair.replace('USDT', '/USDT');
    document.getElementById('status-timeframe').textContent = `${currentTimeframe} · ${getDataRange()}`;
    updateStatus('Ready');
  } catch (err) {
    console.error('Failed to load data:', err);
    updateStatus('⚠ Data load failed');
  } finally {
    chartContainer.classList.remove('loading');
  }
}

// ========================
// BACKTESTING
// ========================

function executeBacktest() {
  if (candleData.length === 0) {
    updateStatus('No data loaded');
    return;
  }

  updateStatus('Running backtest...');
  const code = getCode();
  const params = getParams();

  // Convert commission to decimal
  if (params.commission) {
    params.commission = params.commission / 100;
  }

  let jsCode = code;
  const lang = detectLanguage(code);

  // If Pine Script, transpile to JS first
  if (lang === 'pine') {
    try {
      jsCode = convertPineToJS(code, params);
    } catch (err) {
      console.error('Pine Script transpilation error:', err);
      updateStatus('⚠ Pine Script error');
      displayResults({ error: `Pine Script Error: ${err.message}`, trades: [], signals: [], equityCurve: [], metrics: null });
      return;
    }
  }

  try {
    const results = runBacktest(jsCode, candleData, params);
    lastResults = results;

    if (results.error) {
      updateStatus('⚠ Strategy error');
      displayResults(results);
      return;
    }

    // Clear previous overlays
    clearOverlays();

    // Add buy/sell markers on chart
    setMarkers(results.signals);

    // Add indicator overlays
    addIndicatorOverlays(code, lang);

    // Display results
    displayResults(results);
    updateStatus(`Backtest complete — ${results.trades.length} trades`);
  } catch (err) {
    console.error('Backtest error:', err);
    updateStatus('⚠ Backtest failed');
    displayResults({ error: err.message, trades: [], signals: [], equityCurve: [], metrics: null });
  }
}

/**
 * Convert Pine Script code to executable JS for the backtesting engine
 */
function convertPineToJS(pineCode, params) {
  const lines = pineCode.split('\n');
  const jsLines = [];
  const indicatorVars = {};

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip version, comments, empty lines
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('//@version')) continue;
    
    // Skip strategy/indicator declarations
    if (/^(strategy|indicator)\s*\(/.test(trimmed)) continue;
    
    // Skip input declarations (params come from UI)
    if (/^\w+\s*=\s*input/.test(trimmed)) {
      // Extract variable name and default value
      const m = trimmed.match(/^(\w+)\s*=\s*input\.\w+\s*\(\s*(?:defval\s*=\s*)?(-?[\d.]+|true|false)/);
      if (m) {
        jsLines.push(`const ${m[1]} = params.${m[1]} !== undefined ? params.${m[1]} : ${m[2]};`);
      }
      continue;
    }
    
    // Skip plotting commands  
    if (/^(plot|plotshape|plotchar|bgcolor|barcolor|hline|fill|alertcondition)\s*\(/.test(trimmed)) continue;
    if (/^\[.*\]\s*=\s*ta\.macd/.test(trimmed)) {
      // Handle MACD destructuring: [macdLine, signalLine, histLine] = ta.macd(...)
      const m = trimmed.match(/\[(\w+),\s*(\w+),\s*(\w+)\]\s*=\s*ta\.macd\s*\(\s*(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*\)/);
      if (m) {
        indicatorVars[m[1]] = { type: 'macd_line', source: m[4], fast: m[5], slow: m[6], signal: m[7] };
        indicatorVars[m[2]] = { type: 'macd_signal', source: m[4], fast: m[5], slow: m[6], signal: m[7] };
        indicatorVars[m[3]] = { type: 'macd_hist', source: m[4], fast: m[5], slow: m[6], signal: m[7] };
        jsLines.push(`const _macd_result = macd(${m[4]}, ${m[5]}, ${m[6]}, ${m[7]});`);
        jsLines.push(`const ${m[1]} = _macd_result.macdLine;`);
        jsLines.push(`const ${m[2]} = _macd_result.signalLine;`);
        jsLines.push(`const ${m[3]} = _macd_result.histogram;`);
      }
      continue;
    }
    
    // Handle BB destructuring: [middle, upper, lower] = ta.bb(...)
    if (/^\[.*\]\s*=\s*ta\.bb/.test(trimmed)) {
      const m = trimmed.match(/\[(\w+),\s*(\w+),\s*(\w+)\]\s*=\s*ta\.bb\s*\(\s*(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*\)/);
      if (m) {
        jsLines.push(`const _bb_result = bollingerBands(${m[4]}, ${m[5]}, ${m[6]});`);
        jsLines.push(`const ${m[1]} = _bb_result.middle;`);
        jsLines.push(`const ${m[2]} = _bb_result.upper;`);
        jsLines.push(`const ${m[3]} = _bb_result.lower;`);
      }
      continue;
    }

    // Handle ta.sma assignment: shortSma = ta.sma(close, shortPeriod)
    const smaMatch = trimmed.match(/^(\w+)\s*=\s*ta\.sma\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/);
    if (smaMatch) {
      indicatorVars[smaMatch[1]] = { type: 'sma', source: smaMatch[2], period: smaMatch[3] };
      jsLines.push(`const ${smaMatch[1]} = sma(${smaMatch[2]}, ${smaMatch[3]});`);
      continue;
    }

    // Handle ta.ema assignment
    const emaMatch = trimmed.match(/^(\w+)\s*=\s*ta\.ema\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/);
    if (emaMatch) {
      indicatorVars[emaMatch[1]] = { type: 'ema', source: emaMatch[2], period: emaMatch[3] };
      jsLines.push(`const ${emaMatch[1]} = ema(${emaMatch[2]}, ${emaMatch[3]});`);
      continue;
    }

    // Handle ta.rsi assignment
    const rsiMatch = trimmed.match(/^(\w+)\s*=\s*ta\.rsi\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/);
    if (rsiMatch) {
      indicatorVars[rsiMatch[1]] = { type: 'rsi', source: rsiMatch[2], period: rsiMatch[3] };
      jsLines.push(`const ${rsiMatch[1]} = rsi(${rsiMatch[2]}, ${rsiMatch[3]});`);
      continue;
    }

    // Handle ta.stoch
    const stochMatch = trimmed.match(/^(\w+)\s*=\s*ta\.stoch\s*\(\s*(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*\)/);
    if (stochMatch) {
      jsLines.push(`const _stoch_result = stochastic(candles, ${stochMatch[5]}, 3);`);
      jsLines.push(`const ${stochMatch[1]} = _stoch_result.k;`);
      continue;
    }

    // Handle ta.atr
    const atrMatch = trimmed.match(/^(\w+)\s*=\s*ta\.atr\s*\(\s*(\w+)\s*\)/);
    if (atrMatch) {
      jsLines.push(`const ${atrMatch[1]} = atr(candles, ${atrMatch[2]});`);
      continue;
    }

    // Handle condition assignments with ta.crossover/crossunder
    let processedLine = trimmed;
    processedLine = processedLine.replace(
      /ta\.crossover\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/g,
      'crossover($1, $2)'
    );
    processedLine = processedLine.replace(
      /ta\.crossunder\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/g,
      'crossunder($1, $2)'
    );
    
    // Handle 'and' / 'or' → '&&' / '||'
    processedLine = processedLine.replace(/\band\b/g, '&&');
    processedLine = processedLine.replace(/\bor\b/g, '||');
    processedLine = processedLine.replace(/\bnot\b/g, '!');

    // Handle := → =
    processedLine = processedLine.replace(/:=/g, '=');

    // Handle Pine 'if' blocks with strategy actions
    const ifStrategyEntry = processedLine.match(/^if\s*\((.+)\)\s*$/);
    if (ifStrategyEntry) {
      jsLines.push(`if (${ifStrategyEntry[1]}) {`);
      continue;
    }

    // strategy.entry
    const entryMatch = processedLine.match(/^\s*strategy\.entry\s*\(\s*["'](\w+)["']\s*,\s*strategy\.(long|short)\s*\)/);
    if (entryMatch) {
      jsLines.push(`  buy(i);`);
      jsLines.push(`}`);
      continue;
    }

    // strategy.close
    const closeMatch = processedLine.match(/^\s*strategy\.close\s*\(\s*["'](\w+)["']\s*\)/);
    if (closeMatch) {
      jsLines.push(`  sell(i);`);
      jsLines.push(`}`);
      continue;
    }

    // strategy.exit
    const exitMatch = processedLine.match(/^\s*strategy\.exit\s*\(/);
    if (exitMatch) {
      jsLines.push(`  sell(i);`);
      jsLines.push(`}`);
      continue;
    }

    // Regular assignment of a condition (e.g., longCondition = ...)
    const condMatch = processedLine.match(/^(\w+)\s*=\s*(.+)/);
    if (condMatch && !processedLine.includes('const ') && !processedLine.includes('let ')) {
      // Check if right side references arrays (indicators) — will be used per-bar
      jsLines.push(`const ${condMatch[1]} = ${condMatch[2]};`);
      continue;
    }

    // Anything else, pass through
    jsLines.push(processedLine);
  }

  // Now wrap everything in a per-bar loop
  // Pre-computed indicators are arrays; conditions using crossover/crossunder return arrays
  // We need a for loop iterating over each bar
  
  const preCompute = [];
  const perBar = [];
  
  for (const line of jsLines) {
    // Indicator computations go to pre-compute (they return full arrays)
    if (/^const \w+ = (sma|ema|rsi|macd|bollingerBands|atr|stochastic|crossover|crossunder)\(/.test(line) ||
        /^const _\w+_result = /.test(line) ||
        /^const \w+ = _\w+_result\./.test(line) ||
        /^const \w+ = params\./.test(line)) {
      preCompute.push(line);
    } else {
      perBar.push(line);
    }
  }

  // Determine which variables are arrays (indicators) vs scalars
  const arrayVars = new Set();
  for (const line of preCompute) {
    const varMatch = line.match(/^const (\w+) =/);
    if (varMatch) arrayVars.add(varMatch[1]);
  }

  // In per-bar code, replace array variable references with [i] indexing
  // and replace crossover/crossunder calls
  const processedPerBar = perBar.map(line => {
    let processed = line;
    
    // Replace crossover(a, b) with crossover(a, b)[i]
    processed = processed.replace(/crossover\((\w+),\s*(\w+)\)/g, (m, a, b) => {
      if (arrayVars.has(a) && arrayVars.has(b)) {
        return `crossover(${a}, ${b})[i]`;
      }
      return m;
    });
    processed = processed.replace(/crossunder\((\w+),\s*(\w+)\)/g, (m, a, b) => {
      if (arrayVars.has(a) && arrayVars.has(b)) {
        return `crossunder(${a}, ${b})[i]`;
      }
      return m;
    });

    // Replace array variable standalone references with [i]
    for (const v of arrayVars) {
      // Don't replace inside function calls or assignments
      const regex = new RegExp(`\\b${v}\\b(?!\\[|\\s*=|\\s*\\()`, 'g');
      processed = processed.replace(regex, `${v}[i]`);
    }

    // Handle close, open, high, low as arrays with [i] 
    // (only when they're standalone, not already indexed)
    processed = processed.replace(/\bclose\b(?!\[)/g, 'close[i]');
    processed = processed.replace(/\bopen\b(?!\[)/g, 'open[i]');
    processed = processed.replace(/\bhigh\b(?!\[)/g, 'high[i]');
    processed = processed.replace(/\blow\b(?!\[)/g, 'low[i]');
    
    return processed;
  });

  // Build final code
  const finalCode = `
// Pre-computed indicators
${preCompute.join('\n')}

// Per-bar execution
for (let i = 1; i < close.length; i++) {
  ${processedPerBar.join('\n  ')}
}
`;

  return finalCode;
}

function addIndicatorOverlays(code, lang) {
  const closes = candleData.map(c => c.close);

  if (lang === 'pine') {
    // Detect ta.sma usage
    const smaMatches = [...code.matchAll(/ta\.sma\s*\(\s*close\s*,\s*(\w+)\s*\)/g)];
    const colors = ['#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#22d3ee', '#a78bfa'];
    smaMatches.forEach((m, idx) => {
      const period = parseInt(m[1]) || 10;
      if (!isNaN(period)) {
        const values = sma(closes, period);
        addLineSeries(values.map((v, i) => ({ time: candleData[i].time, value: v })), colors[idx % colors.length], 1);
      }
    });

    // Detect ta.ema usage
    const emaMatches = [...code.matchAll(/ta\.ema\s*\(\s*close\s*,\s*(\w+)\s*\)/g)];
    emaMatches.forEach((m, idx) => {
      const period = parseInt(m[1]) || 10;
      if (!isNaN(period)) {
        const values = ema(closes, period);
        addLineSeries(values.map((v, i) => ({ time: candleData[i].time, value: v })), colors[(smaMatches.length + idx) % colors.length], 1);
      }
    });
  } else {
    // JS mode — detect sma/ema calls
    const smaMatches = [...code.matchAll(/sma\(close,\s*(\d+)\)/g)];
    const colors = ['#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];
    smaMatches.forEach((m, idx) => {
      const values = sma(closes, parseInt(m[1]));
      addLineSeries(values.map((v, i) => ({ time: candleData[i].time, value: v })), colors[idx % colors.length], 1);
    });

    const emaMatches = [...code.matchAll(/ema\(close,\s*(\d+)\)/g)];
    emaMatches.forEach((m, idx) => {
      const values = ema(closes, parseInt(m[1]));
      addLineSeries(values.map((v, i) => ({ time: candleData[i].time, value: v })), ['#22d3ee', '#a78bfa'][idx % 2], 1);
    });
  }
}

// ========================
// EDITOR MODE
// ========================

function switchEditorMode(mode) {
  currentEditorMode = mode;
  setEditorMode(mode);
  
  const badge = document.getElementById('editor-mode-badge');
  if (badge) {
    badge.textContent = mode === 'pine' ? 'PINE' : 'JS';
    badge.className = `editor-mode-badge ${mode === 'pine' ? 'pine' : 'js'}`;
  }
}

// ========================
// EVENT LISTENERS
// ========================

function setupEventListeners() {
  // Run Backtest
  document.getElementById('btn-run-backtest').addEventListener('click', executeBacktest);

  // Pair selector
  document.getElementById('pair-select').addEventListener('change', async (e) => {
    currentPair = e.target.value;
    clearCache();
    await loadData();
  });

  // Timeframe tabs (desktop + mobile)
  document.getElementById('timeframe-tabs').addEventListener('click', handleTimeframeClick);
  const mobileTf = document.getElementById('mobile-timeframe-bar');
  if (mobileTf) mobileTf.addEventListener('click', handleTimeframeClick);

  // Range tabs
  document.getElementById('range-tabs').addEventListener('click', handleRangeClick);

  // Results tabs
  document.getElementById('results-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('#results-tabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    showTab(tab.dataset.tab);
  });

  // Mode toggle
  document.getElementById('btn-toggle-mode').addEventListener('click', () => {
    const code = getCode();
    const currentLang = detectLanguage(code);
    
    if (currentLang === 'pine') {
      // Convert Pine to JS and switch
      switchEditorMode('javascript');
      showToast('Switched to JavaScript mode');
    } else {
      // Generate Pine Script from JS and switch
      const params = getParams();
      const pineCode = generatePineScript(code, getCurrentStrategy()?.defaultParams || {}, 
        getCurrentStrategy()?.name?.replace(/^[📌🟨]\s*/, '') || 'My Strategy');
      switchEditorMode('pine');
      setCode(pineCode);
      showToast('Converted to Pine Script');
    }
  });

  // Copy Pine Script
  document.getElementById('btn-copy-pine').addEventListener('click', () => {
    const code = getCode();
    const lang = detectLanguage(code);
    
    let pineCode;
    if (lang === 'pine') {
      pineCode = code;
    } else {
      pineCode = generatePineScript(code, getCurrentStrategy()?.defaultParams || {},
        getCurrentStrategy()?.name?.replace(/^[📌🟨]\s*/, '') || 'My Strategy');
    }

    navigator.clipboard.writeText(pineCode).then(() => {
      showToast('✅ Pine Script copied! Paste in TradingView → Pine Editor');
    }).catch(() => {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = pineCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('✅ Pine Script copied!');
    });
  });

  // Save strategy
  document.getElementById('btn-save-strategy').addEventListener('click', () => {
    const name = prompt('Strategy name:');
    if (name) {
      const code = getCode();
      const type = detectLanguage(code);
      saveStrategy(name, code, type);
      showToast('Strategy saved');
    }
  });

  // Load strategy from file
  document.getElementById('btn-load-strategy').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pine,.js,.txt';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const code = ev.target.result;
          const lang = detectLanguage(code);
          switchEditorMode(lang);
          setCode(code);
          showToast(`Loaded ${file.name} (${lang === 'pine' ? 'Pine Script' : 'JavaScript'})`);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  });

  // Export CSV
  document.getElementById('btn-export-csv').addEventListener('click', () => {
    if (lastResults && lastResults.trades.length > 0) {
      exportCSV(lastResults.trades);
      showToast('CSV exported');
    } else {
      showToast('No trades to export');
    }
  });

  // Resize handle
  setupResize();

  // Keyboard shortcut: Ctrl+Enter to run
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeBacktest();
    }
  });

  // Sidebar tabs
  setupSidebarTabs();

  // Mobile toggles
  setupMobileToggles();
}

// ========================
// SIDEBAR TABS
// ========================

function setupSidebarTabs() {
  const tabsContainer = document.querySelector('.sidebar-tabs');
  if (!tabsContainer) return;

  tabsContainer.addEventListener('click', (e) => {
    const tab = e.target.closest('.sidebar-tab');
    if (!tab) return;
    switchSidebarTab(tab.dataset.sidebarTab);
  });
}

function switchSidebarTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.sidebar-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.sidebarTab === tabName);
  });
  // Update tab content
  document.querySelectorAll('.sidebar-tab-content').forEach(el => {
    el.classList.remove('active');
  });
  const content = document.getElementById(`sidebar-${tabName}`);
  if (content) content.classList.add('active');
}

async function handleTimeframeClick(e) {
  const tab = e.target.closest('.tab');
  if (!tab || !tab.dataset.tf) return;
  document.querySelectorAll('#timeframe-tabs .tab, #mobile-timeframe-bar .tab').forEach(t => {
    if (t.dataset.tf) t.classList.toggle('active', t.dataset.tf === tab.dataset.tf);
  });
  currentTimeframe = tab.dataset.tf;
  clearCache();
  await loadData();
}

async function handleRangeClick(e) {
  const tab = e.target.closest('.tab');
  if (!tab || !tab.dataset.range) return;
  document.querySelectorAll('#range-tabs .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.range === tab.dataset.range);
  });
  setDataRange(tab.dataset.range);
  clearCache();
  updateStatus(`Loading ${tab.dataset.range} data...`);
  await loadData();
}

// ========================
// MOBILE TOGGLES
// ========================

function setupMobileToggles() {
  const sidebar = document.getElementById('sidebar');
  const results = document.getElementById('results-panel');
  const overlay = document.getElementById('mobile-overlay');
  const btnSidebar = document.getElementById('btn-toggle-sidebar');
  const btnResults = document.getElementById('btn-toggle-results');

  function closeAll() {
    sidebar.classList.remove('open');
    results.classList.remove('open');
    overlay.classList.remove('visible');
    btnSidebar.classList.remove('active');
    btnResults.classList.remove('active');
  }

  btnSidebar.addEventListener('click', () => {
    const isOpen = sidebar.classList.contains('open');
    closeAll();
    if (!isOpen) { sidebar.classList.add('open'); overlay.classList.add('visible'); btnSidebar.classList.add('active'); }
  });

  btnResults.addEventListener('click', () => {
    const isOpen = results.classList.contains('open');
    closeAll();
    if (!isOpen) { results.classList.add('open'); overlay.classList.add('visible'); btnResults.classList.add('active'); }
  });

  overlay.addEventListener('click', closeAll);

  const mq = window.matchMedia('(max-width: 900px)');
  function handleMQ(e) {
    const mobileTf = document.getElementById('mobile-timeframe-bar');
    if (mobileTf) mobileTf.style.display = e.matches ? 'flex' : 'none';
    if (!e.matches) closeAll();
  }
  mq.addEventListener('change', handleMQ);
  handleMQ(mq);
}

// ========================
// RESIZE HANDLE
// ========================

function setupResize() {
  const handle = document.getElementById('resize-handle');
  const editorContainer = document.getElementById('editor-container');
  let startY, startHeight;

  handle.addEventListener('mousedown', (e) => {
    startY = e.clientY;
    startHeight = editorContainer.offsetHeight;
    handle.classList.add('active');
    const onMouseMove = (e) => { editorContainer.style.height = `${Math.max(100, Math.min(600, startHeight + (startY - e.clientY)))}px`; };
    const onMouseUp = () => { handle.classList.remove('active'); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  handle.addEventListener('touchstart', (e) => {
    const touch = e.touches[0]; startY = touch.clientY; startHeight = editorContainer.offsetHeight; handle.classList.add('active');
    const onTouchMove = (e) => { editorContainer.style.height = `${Math.max(100, Math.min(600, startHeight + (startY - e.touches[0].clientY)))}px`; };
    const onTouchEnd = () => { handle.classList.remove('active'); document.removeEventListener('touchmove', onTouchMove); document.removeEventListener('touchend', onTouchEnd); };
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
  });
}

// ========================
// UTILITIES
// ========================

function updateStatus(text) {
  const el = document.getElementById('data-status');
  if (el) el.textContent = text;
}

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

// ========================
// START
// ========================

init().catch(err => {
  console.error('App initialization failed:', err);
  updateStatus('⚠ Init failed');
});
