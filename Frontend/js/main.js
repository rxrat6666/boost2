import { createCalculator, calcFanPaySplit } from '../shared/calc-core.js';

const STORAGE_FORM = 'boost-suite-form-v1';
const STORAGE_HISTORY = 'boost-suite-history-v1';

const SERVICE_DEFS = [
  { id: 'mmr', title: 'MMR Boost', hint: 'Передача аккаунта' },
  { id: 'party', title: 'Party Boost', hint: 'Игра с клиентом' },
  { id: 'calib', title: 'Calibration', hint: 'Калибровка' },
  { id: 'lp', title: 'Low Priority', hint: 'Отмыв LP' },
  { id: 'behavior', title: 'Behavior', hint: 'Порядочность' }
];

const SERVICE_UI = {
  mmr: {
    fromLabel: 'Текущий MMR',
    toLabel: 'Целевой MMR',
    toValue: 4500,
    toggles: ['doubles'],
  },
  party: {
    fromLabel: 'Текущий MMR',
    toLabel: 'Количество побед',
    toValue: 5,
    toggles: ['doubles', 'lowConfidence'],
  },
  calib: {
    fromLabel: 'Текущий MMR',
    toLabel: 'Количество побед',
    toValue: 8,
    toggles: [],
  },
  lp: {
    fromLabel: 'MMR аккаунта',
    toLabel: 'Количество LP игр',
    toValue: 3,
    toggles: ['partyWithClient'],
  },
  behavior: {
    fromLabel: 'Текущая порядочность',
    toLabel: 'Целевая порядочность',
    toValue: 8000,
    toggles: ['highMmrAccount'],
  },
};

const TOGGLE_LABELS = {
  doubles: 'Даблы',
  lowConfidence: 'Low confidence',
  partyWithClient: 'В пати с клиентом +50%',
  highMmrAccount: 'Аккаунт 7500+ MMR (+30%)',
};

const els = {
  serviceCards: document.getElementById('serviceCards'),
  fromLabel: document.getElementById('fromLabel'),
  toLabel: document.getElementById('toLabel'),
  fromInput: document.getElementById('fromInput'),
  toInput: document.getElementById('toInput'),
  options: document.getElementById('options'),
  margin: document.getElementById('margin'),
  marginPresets: document.getElementById('marginPresets'),
  categorySegment: document.getElementById('categorySegment'),
  copyClient: document.getElementById('copyClient'),
  copyInternal: document.getElementById('copyInternal'),
  resetBtn: document.getElementById('resetBtn'),
  clientValue: document.getElementById('clientValue'),
  boosterValue: document.getElementById('boosterValue'),
  profitValue: document.getElementById('profitValue'),
  fixValue: document.getElementById('fixValue'),
  boosterPayoutValue: document.getElementById('boosterPayoutValue'),
  coeffValue: document.getElementById('coeffValue'),
  serviceLabel: document.getElementById('serviceLabel'),
  clientText: document.getElementById('clientText'),
  internalText: document.getElementById('internalText'),
  historyList: document.getElementById('historyList'),
  clearHistory: document.getElementById('clearHistory'),
  splitSum: document.getElementById('splitSum'),
  splitCards: document.getElementById('splitCards'),
  telegramPreview: document.getElementById('telegramPreview'),
  copyTelegram: document.getElementById('copyTelegram'),
  stateBadge: document.getElementById('stateBadge'),
};

function getDefaultState() {
  return {
    type: 'mmr',
    category: 'boost',
    from: 3000,
    to: 4500,
    margin: 25,
    doubles: false,
    lowConfidence: false,
    partyWithClient: false,
    highMmrAccount: false,
  };
}

function loadState() {
  try {
    return { ...getDefaultState(), ...(JSON.parse(localStorage.getItem(STORAGE_FORM)) || {}) };
  } catch {
    return getDefaultState();
  }
}

let state = loadState();
let calculator;
let lastResult = null;

function formatMoney(value) { return `${Math.round(value)} ₽`; }

function saveState() {
  localStorage.setItem(STORAGE_FORM, JSON.stringify(state));
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_HISTORY)) || []; }
  catch { return []; }
}

function saveHistory(items) {
  localStorage.setItem(STORAGE_HISTORY, JSON.stringify(items));
}

function renderServiceCards() {
  els.serviceCards.innerHTML = SERVICE_DEFS.map(({ id, title, hint }) => `
    <button class="service-card ${state.type === id ? 'is-active' : ''}" type="button" data-service="${id}">
      <strong>${title}</strong>
      <span>${hint}</span>
    </button>
  `).join('');
}

function renderCategory() {
  els.categorySegment.querySelectorAll('[data-category]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.category === state.category);
  });
}

function renderPresets() {
  els.marginPresets.querySelectorAll('[data-margin]').forEach(btn => {
    btn.classList.toggle('is-active', Number(btn.dataset.margin) === Number(state.margin));
  });
}

function renderFields() {
  const cfg = SERVICE_UI[state.type];
  els.fromLabel.textContent = cfg.fromLabel;
  els.toLabel.textContent = cfg.toLabel;
  els.fromInput.value = state.from;
  els.toInput.value = state.to;
  els.margin.value = state.margin;
  els.serviceLabel.textContent = SERVICE_DEFS.find(item => item.id === state.type)?.title || state.type;

  els.options.innerHTML = cfg.toggles.map(key => `
    <label class="checkbox-card">
      <input type="checkbox" data-toggle="${key}" ${state[key] ? 'checked' : ''} />
      <span>${TOGGLE_LABELS[key]}</span>
    </label>
  `).join('');
}

function buildClientText(input, result) {
  const name = SERVICE_DEFS.find(item => item.id === input.type)?.title || input.type;
  const extra = [];
  if (input.doubles) extra.push('Даблы: да');
  if (input.lowConfidence) extra.push('Low confidence: да');
  if (input.partyWithClient) extra.push('Пати с клиентом: да');
  if (input.highMmrAccount) extra.push('Аккаунт 7500+: да');

  return [
    `${name}`,
    `${SERVICE_UI[input.type].fromLabel}: ${input.from}`,
    `${SERVICE_UI[input.type].toLabel}: ${input.to}`,
    ...extra,
    `Категория: ${input.category}`,
    `Цена клиенту: ${formatMoney(result.client)}`,
  ].join('\n');
}

function buildInternalText(input, result) {
  return [
    `Услуга: ${SERVICE_DEFS.find(item => item.id === input.type)?.title || input.type}`,
    `Фикс: ${formatMoney(result.fix)}`,
    `Бустеру: ${formatMoney(result.booster)}`,
    `Выплата бустеру 50/50: ${formatMoney(result.boosterPayout)}`,
    `Клиенту: ${formatMoney(result.client)}`,
    `Прибыль: ${formatMoney(result.profit)}`,
    `Коэфф. FanPay: ${result.coeff}`,
    `Маржа: ${input.margin}%`,
  ].join('\n');
}

function buildTelegramCommand(input) {
  const tokens = [`/${input.type}`, String(input.from), String(input.to)];
  if (input.doubles) tokens.push('doubles');
  if (input.lowConfidence) tokens.push('low');
  if (input.partyWithClient) tokens.push('party');
  if (input.highMmrAccount) tokens.push('highmmr');
  tokens.push(`margin=${input.margin}`);
  tokens.push(`category=${input.category}`);
  return tokens.join(' ');
}

function pushHistory(input, result) {
  const items = loadHistory();
  const entry = {
    createdAt: new Date().toLocaleString(),
    type: input.type,
    from: input.from,
    to: input.to,
    client: result.client,
    profit: result.profit,
  };
  items.unshift(entry);
  saveHistory(items.slice(0, 10));
  renderHistory();
}

function renderHistory() {
  const items = loadHistory();
  if (!items.length) {
    els.historyList.innerHTML = '<div class="empty-state">История пуста.</div>';
    return;
  }
  els.historyList.innerHTML = items.map(item => `
    <div class="history-item">
      <div class="history-item-top">
        <strong>${SERVICE_DEFS.find(service => service.id === item.type)?.title || item.type}</strong>
        <span class="history-meta">${item.createdAt}</span>
      </div>
      <div class="history-values">
        <span>${item.from} → ${item.to}</span>
        <span>Клиент: ${formatMoney(item.client)}</span>
        <span>Профит: ${formatMoney(item.profit)}</span>
      </div>
    </div>
  `).join('');
}

function renderSplitCards() {
  const split = calcFanPaySplit(Number(els.splitSum.value), calculator.config);
  els.splitCards.innerHTML = Object.entries(split).map(([key, value]) => `
    <div class="split-card">
      <div class="mini-title">${key === 'boost' ? 'Буст' : 'Обучение'}</div>
      <div class="line"><span>Коэфф.</span><span>${value.coeff}</span></div>
      <div class="line"><span>Покупатель 100%</span><span>${value.buyer100} ₽</span></div>
      <div class="line"><span>Выставлять 50/50</span><span>${value.list5050} ₽</span></div>
    </div>
  `).join('');
}

function recalc({ saveHistoryEntry = false } = {}) {
  const input = {
    type: state.type,
    category: state.category,
    from: Number(state.from),
    to: Number(state.to),
    margin: Number(state.margin) / 100,
    doubles: Boolean(state.doubles),
    lowConfidence: Boolean(state.lowConfidence),
    partyWithClient: Boolean(state.partyWithClient),
    highMmrAccount: Boolean(state.highMmrAccount),
  };

  lastResult = calculator.calculate(input);
  els.clientValue.textContent = formatMoney(lastResult.client);
  els.boosterValue.textContent = formatMoney(lastResult.booster);
  els.profitValue.textContent = formatMoney(lastResult.profit);
  els.fixValue.textContent = formatMoney(lastResult.fix);
  els.boosterPayoutValue.textContent = formatMoney(lastResult.boosterPayout);
  els.coeffValue.textContent = String(lastResult.coeff);
  els.clientText.textContent = buildClientText({ ...input, margin: state.margin }, lastResult);
  els.internalText.textContent = buildInternalText({ ...input, margin: state.margin }, lastResult);
  els.telegramPreview.textContent = buildTelegramCommand({ ...input, margin: state.margin });
  els.stateBadge.textContent = `auto · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  saveState();
  if (saveHistoryEntry) pushHistory({ ...input, margin: state.margin }, lastResult);
}

function setType(type) {
  state.type = type;
  const cfg = SERVICE_UI[type];
  state.to = cfg.toValue;
  state.doubles = false;
  state.lowConfidence = false;
  state.partyWithClient = false;
  state.highMmrAccount = false;
  renderServiceCards();
  renderFields();
  recalc();
}

function bindEvents() {
  els.serviceCards.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-service]');
    if (!btn) return;
    setType(btn.dataset.service);
  });

  els.categorySegment.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-category]');
    if (!btn) return;
    state.category = btn.dataset.category;
    renderCategory();
    recalc();
  });

  els.marginPresets.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-margin]');
    if (!btn) return;
    state.margin = Number(btn.dataset.margin);
    els.margin.value = state.margin;
    renderPresets();
    recalc();
  });

  els.fromInput.addEventListener('input', () => { state.from = Number(els.fromInput.value || 0); recalc(); });
  els.toInput.addEventListener('input', () => { state.to = Number(els.toInput.value || 0); recalc(); });
  els.margin.addEventListener('input', () => { state.margin = Number(els.margin.value || 0); renderPresets(); recalc(); });
  els.options.addEventListener('change', (event) => {
    const input = event.target.closest('[data-toggle]');
    if (!input) return;
    state[input.dataset.toggle] = input.checked;
    recalc();
  });

  els.copyClient.addEventListener('click', async () => {
    await navigator.clipboard.writeText(els.clientText.textContent);
    pushHistory({ ...state }, lastResult);
  });
  els.copyInternal.addEventListener('click', () => navigator.clipboard.writeText(els.internalText.textContent));
  els.copyTelegram.addEventListener('click', () => navigator.clipboard.writeText(els.telegramPreview.textContent));
  els.resetBtn.addEventListener('click', () => {
    state = getDefaultState();
    renderAll();
  });
  els.clearHistory.addEventListener('click', () => {
    saveHistory([]);
    renderHistory();
  });
  els.splitSum.addEventListener('input', renderSplitCards);
}

function renderAll() {
  renderServiceCards();
  renderCategory();
  renderPresets();
  renderFields();
  renderHistory();
  renderSplitCards();
  recalc();
}

async function init() {
  const response = await fetch('../data/prices.json'.replace('..', '.'));
  const config = await response.json();
  calculator = createCalculator(config);
  bindEvents();
  renderAll();
}

init();
