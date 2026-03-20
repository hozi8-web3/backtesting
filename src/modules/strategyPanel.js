/**
 * Strategy Panel Module
 * Manages strategy list, parameter controls, save/load
 * Supports both Pine Script and JavaScript strategies
 */
import * as smaStrategy from '../strategies/smaStrategy.js';
import * as rsiStrategy from '../strategies/rsiStrategy.js';
import * as macdStrategy from '../strategies/macdStrategy.js';
import * as bollingerStrategy from '../strategies/bollingerStrategy.js';
import { PINE_PRESETS } from './pineParser.js';

// JS strategies
const jsStrategies = [smaStrategy, rsiStrategy, macdStrategy, bollingerStrategy];

// Build unified strategy list (Pine Script first, then JS)
export const strategies = [
  // Pine Script presets
  { name: '📌 SMA Crossover', description: 'Pine Script — Moving average crossover', icon: '📈', type: 'pine', preset: PINE_PRESETS.sma,
    defaultParams: { shortPeriod: { label: 'Short SMA', value: 10, min: 2, max: 100, step: 1 }, longPeriod: { label: 'Long SMA', value: 30, min: 5, max: 200, step: 1 }, initialBalance: { label: 'Capital ($)', value: 10000, min: 100, max: 1000000, step: 100 }, commission: { label: 'Commission %', value: 0.1, min: 0, max: 1, step: 0.01 } }
  },
  { name: '📌 RSI Strategy', description: 'Pine Script — RSI overbought/oversold', icon: '📉', type: 'pine', preset: PINE_PRESETS.rsi,
    defaultParams: { rsiPeriod: { label: 'RSI Period', value: 14, min: 2, max: 50, step: 1 }, overbought: { label: 'Overbought', value: 70, min: 50, max: 95, step: 1 }, oversold: { label: 'Oversold', value: 30, min: 5, max: 50, step: 1 }, initialBalance: { label: 'Capital ($)', value: 10000, min: 100, max: 1000000, step: 100 }, commission: { label: 'Commission %', value: 0.1, min: 0, max: 1, step: 0.01 } }
  },
  { name: '📌 MACD Crossover', description: 'Pine Script — MACD line & signal', icon: '📊', type: 'pine', preset: PINE_PRESETS.macd,
    defaultParams: { fastLength: { label: 'Fast EMA', value: 12, min: 2, max: 50, step: 1 }, slowLength: { label: 'Slow EMA', value: 26, min: 5, max: 100, step: 1 }, signalLength: { label: 'Signal', value: 9, min: 2, max: 30, step: 1 }, initialBalance: { label: 'Capital ($)', value: 10000, min: 100, max: 1000000, step: 100 }, commission: { label: 'Commission %', value: 0.1, min: 0, max: 1, step: 0.01 } }
  },
  { name: '📌 Bollinger Bands', description: 'Pine Script — BB bounce strategy', icon: '🎯', type: 'pine', preset: PINE_PRESETS.bollinger,
    defaultParams: { bbLength: { label: 'BB Period', value: 20, min: 5, max: 50, step: 1 }, bbMult: { label: 'Std Dev', value: 2, min: 0.5, max: 4, step: 0.1 }, initialBalance: { label: 'Capital ($)', value: 10000, min: 100, max: 1000000, step: 100 }, commission: { label: 'Commission %', value: 0.1, min: 0, max: 1, step: 0.01 } }
  },
  { name: '📌 EMA Crossover', description: 'Pine Script — Fast/Slow EMA cross', icon: '⚡', type: 'pine', preset: PINE_PRESETS.ema_cross,
    defaultParams: { fastLen: { label: 'Fast EMA', value: 9, min: 2, max: 50, step: 1 }, slowLen: { label: 'Slow EMA', value: 21, min: 5, max: 100, step: 1 }, initialBalance: { label: 'Capital ($)', value: 10000, min: 100, max: 1000000, step: 100 }, commission: { label: 'Commission %', value: 0.1, min: 0, max: 1, step: 0.01 } }
  },
  { name: '📌 Stochastic', description: 'Pine Script — Stochastic oscillator', icon: '🔄', type: 'pine', preset: PINE_PRESETS.stochastic,
    defaultParams: { kPeriod: { label: '%K Period', value: 14, min: 1, max: 50, step: 1 }, dPeriod: { label: '%D Period', value: 3, min: 1, max: 20, step: 1 }, overbought: { label: 'Overbought', value: 80, min: 50, max: 100, step: 1 }, oversold: { label: 'Oversold', value: 20, min: 0, max: 50, step: 1 }, initialBalance: { label: 'Capital ($)', value: 10000, min: 100, max: 1000000, step: 100 }, commission: { label: 'Commission %', value: 0.1, min: 0, max: 1, step: 0.01 } }
  },
  // JS strategies  
  ...jsStrategies.map(s => ({
    name: `🟨 ${s.name}`,
    description: `JavaScript — ${s.description}`,
    icon: s.icon,
    type: 'javascript',
    jsModule: s,
    defaultParams: s.defaultParams,
  })),
];

let currentStrategyIndex = 0;
let currentParams = {};
let onStrategyChange = null;
let onParamsChange = null;

/**
 * Initialize the strategy panel
 */
export function initPanel(onSelect, onParams) {
  onStrategyChange = onSelect;
  onParamsChange = onParams;
  renderStrategyList();
  selectStrategy(0);
  renderSavedStrategies();
}

function renderStrategyList() {
  const list = document.getElementById('strategy-list');
  list.innerHTML = strategies.map((s, i) => `
    <li class="strategy-item ${i === 0 ? 'active' : ''}" data-index="${i}">
      <div class="strategy-icon">${s.icon}</div>
      <div class="strategy-info">
        <div class="strategy-name" style="font-size: 11px;">${s.name}</div>
        <div class="strategy-desc">${s.description}</div>
      </div>
    </li>
  `).join('');

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.strategy-item');
    if (!item) return;
    selectStrategy(parseInt(item.dataset.index));
    // Auto-switch to Params tab after selecting a strategy
    const paramsTab = document.querySelector('[data-sidebar-tab="params"]');
    if (paramsTab) paramsTab.click();
  });
}

export function selectStrategy(index) {
  currentStrategyIndex = index;
  const strategy = strategies[index];

  // Update active state
  document.querySelectorAll('.strategy-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  // Initialize params
  currentParams = {};
  for (const [key, param] of Object.entries(strategy.defaultParams)) {
    currentParams[key] = param.value;
  }

  renderParams(strategy);

  // Update editor name and mode indicator
  const nameEl = document.getElementById('editor-strategy-name');
  if (nameEl) nameEl.textContent = strategy.name.replace(/^[📌🟨]\s*/, '');

  const modeEl = document.getElementById('editor-mode-badge');
  if (modeEl) {
    modeEl.textContent = strategy.type === 'pine' ? 'PINE' : 'JS';
    modeEl.className = `editor-mode-badge ${strategy.type === 'pine' ? 'pine' : 'js'}`;
  }

  if (onStrategyChange) {
    onStrategyChange(strategy, currentParams);
  }
}

function renderParams(strategy) {
  const grid = document.getElementById('params-grid');
  grid.innerHTML = '';

  for (const [key, param] of Object.entries(strategy.defaultParams)) {
    const control = document.createElement('div');
    control.className = 'param-control';
    const step = param.step || (Number.isInteger(param.value) ? 1 : 0.01);

    control.innerHTML = `
      <label>${param.label}</label>
      <input type="number" value="${param.value}" min="${param.min}" max="${param.max}" step="${step}" data-param="${key}" />
    `;

    control.querySelector('input').addEventListener('change', (e) => {
      currentParams[key] = parseFloat(e.target.value);
      if (onParamsChange) onParamsChange(currentParams);
    });

    grid.appendChild(control);
  }
}

/**
 * Get the code for the current strategy
 */
export function getStrategyCode() {
  const strategy = strategies[currentStrategyIndex];
  if (strategy.type === 'pine') {
    return strategy.preset.code;
  }
  return strategy.jsModule.getCode(currentParams);
}

/**
 * Get the current strategy type
 */
export function getStrategyType() {
  return strategies[currentStrategyIndex].type;
}

export function getParams() {
  return { ...currentParams };
}

export function getCurrentStrategy() {
  return strategies[currentStrategyIndex];
}

// ========================
// SAVE / LOAD
// ========================
const STORAGE_KEY = 'cryptobacktest_saved_strategies';

export function saveStrategy(name, code, type = 'pine') {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  saved.push({ name, code, type, params: { ...currentParams }, timestamp: Date.now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  renderSavedStrategies();
}

export function loadSavedStrategy(index) {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  return saved[index] || null;
}

export function deleteSavedStrategy(index) {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  saved.splice(index, 1);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  renderSavedStrategies();
}

function renderSavedStrategies() {
  const container = document.getElementById('saved-strategies-list');
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

  if (saved.length === 0) {
    container.innerHTML = '<div style="font-size: var(--fs-xs); color: var(--text-muted); padding: var(--sp-2);">No saved strategies</div>';
    return;
  }

  container.innerHTML = saved.map((s, i) => `
    <div class="strategy-item" style="padding: 4px 8px;">
      <div class="strategy-info">
        <div class="strategy-name" style="font-size: 11px;">${escapeHtml(s.name)} <span style="opacity:0.5; font-size:9px;">${s.type?.toUpperCase() || 'JS'}</span></div>
        <div class="strategy-desc">${new Date(s.timestamp).toLocaleDateString()}</div>
      </div>
      <button class="btn-icon" data-load="${i}" title="Load" style="width: 24px; height: 24px;">↓</button>
      <button class="btn-icon" data-delete="${i}" title="Delete" style="width: 24px; height: 24px; color: var(--color-sell);">✕</button>
    </div>
  `).join('');

  container.addEventListener('click', (e) => {
    const loadBtn = e.target.closest('[data-load]');
    const deleteBtn = e.target.closest('[data-delete]');
    if (loadBtn) {
      const s = loadSavedStrategy(parseInt(loadBtn.dataset.load));
      if (s && onStrategyChange) onStrategyChange(null, s.params, s.code, s.type);
    }
    if (deleteBtn) deleteSavedStrategy(parseInt(deleteBtn.dataset.delete));
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
