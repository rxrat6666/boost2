import TelegramBot from 'node-telegram-bot-api';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCalculator } from '../shared/calc-core.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/prices.json'), 'utf8')
);

const calculator = createCalculator(config);

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('Укажи BOT_TOKEN в переменных окружения.');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const sessions = new Map();

/* =========================
   Helpers
========================= */

function getSession(chatId) {
  return sessions.get(chatId);
}

function setSession(chatId, data) {
  sessions.set(chatId, data);
}

function clearSession(chatId) {
  sessions.delete(chatId);
}

function title(type) {
  return {
    mmr: 'MMR Boost',
    party: 'Party Boost',
    calib: 'Calibration',
    lp: 'Low Priority',
    behavior: 'Behavior',
  }[type] || type;
}

function formatMoney(value) {
  return `${Math.round(value)} ₽`;
}

function formatResult(input, result) {
  const extra = [];

  if (input.type === 'mmr') {
    extra.push(`Даблы: ${input.doubles ? 'да' : 'нет'}`);
  }

  if (input.type === 'party') {
    extra.push(`Даблы: ${input.doubles ? 'да' : 'нет'}`);
    extra.push(`Низкая уверенность: ${input.lowConfidence ? 'да' : 'нет'}`);
  }

  if (input.type === 'lp') {
    extra.push(`Пати с клиентом: ${input.partyWithClient ? 'да' : 'нет'}`);
  }

  if (input.type === 'behavior') {
    extra.push(`Высокий MMR аккаунта: ${input.highMmrAccount ? 'да' : 'нет'}`);
  }

  return [
    `🎮 ${title(input.type)}`,
    '',
    `От: ${input.from}`,
    `До: ${input.to}`,
    ...extra,
    `Маржа: ${Math.round((input.margin || 0) * 100)}%`,
    `Категория: ${input.category}`,
    '',
    `Фикс: ${formatMoney(result.fix)}`,
    `Бустеру: ${formatMoney(result.booster)}`,
    `Выплата бустеру 50/50: ${formatMoney(result.boosterPayout)}`,
    `Клиенту: ${formatMoney(result.client)}`,
    `Прибыль: ${formatMoney(result.profit)}`,
    `Коэфф.: ${result.coeff}`,
  ].join('\n');
}

function formatClientTemplate(input, result) {
  return [
    `🎮 ${title(input.type)}`,
    `От: ${input.from}`,
    `До: ${input.to}`,
    `Цена клиенту: ${formatMoney(result.client)}`,
  ].join('\n');
}

function isPositiveNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0;
}

function mainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'MMR Boost', callback_data: 'service:mmr' },
          { text: 'Party Boost', callback_data: 'service:party' },
        ],
        [
          { text: 'Calibration', callback_data: 'service:calib' },
          { text: 'Low Priority', callback_data: 'service:lp' },
        ],
        [
          { text: 'Behavior', callback_data: 'service:behavior' },
        ],
      ],
    },
  };
}

function yesNoMenu(prefix) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Да', callback_data: `${prefix}:yes` },
          { text: 'Нет', callback_data: `${prefix}:no` },
        ],
        [
          { text: '⬅️ В меню', callback_data: 'menu' },
        ],
      ],
    },
  };
}

function marginMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '20%', callback_data: 'margin:20' },
          { text: '25%', callback_data: 'margin:25' },
          { text: '30%', callback_data: 'margin:30' },
        ],
        [
          { text: '35%', callback_data: 'margin:35' },
        ],
        [
          { text: '⬅️ В меню', callback_data: 'menu' },
        ],
      ],
    },
  };
}

function categoryMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Boost', callback_data: 'category:boost' },
          { text: 'Training', callback_data: 'category:training' },
        ],
        [
          { text: '⬅️ В меню', callback_data: 'menu' },
        ],
      ],
    },
  };
}

function resultMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📋 Шаблон клиенту', callback_data: 'result:client' },
        ],
        [
          { text: '🔁 Новый расчёт', callback_data: 'restart' },
          { text: '🏠 В меню', callback_data: 'menu' },
        ],
      ],
    },
  };
}

async function sendMainMenu(chatId, text = 'Выбери услугу:') {
  clearSession(chatId);
  await bot.sendMessage(chatId, text, mainMenu());
}

function createBaseInput(type) {
  return {
    type,
    from: 0,
    to: 0,
    doubles: false,
    lowConfidence: false,
    partyWithClient: false,
    highMmrAccount: false,
    margin: 0.25,
    category: 'boost',
  };
}

async function askFirstQuestion(chatId, type) {
  if (type === 'mmr') {
    await bot.sendMessage(chatId, 'Введи текущий MMR:');
    return;
  }
  if (type === 'party') {
    await bot.sendMessage(chatId, 'Введи текущий MMR аккаунта:');
    return;
  }
  if (type === 'calib') {
    await bot.sendMessage(chatId, 'Введи текущий MMR аккаунта:');
    return;
  }
  if (type === 'lp') {
    await bot.sendMessage(chatId, 'Введи MMR аккаунта:');
    return;
  }
  if (type === 'behavior') {
    await bot.sendMessage(chatId, 'Введи текущий behaviour score:');
  }
}

async function finishCalculation(chatId) {
  const session = getSession(chatId);
  if (!session) return;

  const result = calculator.calculate(session.input);

  setSession(chatId, {
    ...session,
    step: 'done',
    result,
  });

  await bot.sendMessage(chatId, formatResult(session.input, result), resultMenu());
}

function parseArgs(text) {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].replace('/', '');
  const args = parts.slice(1);

  const numbers = [];
  const options = {
    doubles: false,
    lowConfidence: false,
    partyWithClient: false,
    highMmrAccount: false,
    margin: 25,
    category: 'boost',
  };

  for (const arg of args) {
    if (arg === 'doubles') options.doubles = true;
    else if (arg === 'low') options.lowConfidence = true;
    else if (arg === 'party') options.partyWithClient = true;
    else if (arg === 'highmmr') options.highMmrAccount = true;
    else if (arg.startsWith('margin=')) options.margin = Number(arg.split('=')[1]);
    else if (arg.startsWith('category=')) options.category = arg.split('=')[1];
    else numbers.push(Number(arg));
  }

  return {
    cmd,
    input: {
      type: cmd,
      from: numbers[0] ?? 0,
      to: numbers[1] ?? 0,
      doubles: options.doubles,
      lowConfidence: options.lowConfidence,
      partyWithClient: options.partyWithClient,
      highMmrAccount: options.highMmrAccount,
      margin: (options.margin || 0) / 100,
      category: options.category,
    },
  };
}

/* =========================
   Slash commands
========================= */

bot.onText(/^\/(start|help)$/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    [
      'Привет. Можно считать через кнопки или через команды.',
      '',
      'Примеры команд:',
      '/mmr 3000 4500 doubles margin=25 category=boost',
      '/party 4000 5 doubles low margin=25 category=boost',
      '/calib 5000 8 margin=25 category=boost',
      '/lp 3500 3 party margin=25 category=boost',
      '/behavior 4000 8000 highmmr margin=25 category=boost',
      '',
      'Или просто нажми кнопку ниже.',
    ].join('\n'),
    mainMenu()
  );
});

bot.onText(/^\/cancel$/, async (msg) => {
  clearSession(msg.chat.id);
  await sendMainMenu(msg.chat.id, 'Сбросил текущий сценарий.');
});

/* =========================
   Callback buttons
========================= */

bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat?.id;
  const data = query.data;

  if (!chatId || !data) {
    if (query.id) await bot.answerCallbackQuery(query.id);
    return;
  }

  try {
    await bot.answerCallbackQuery(query.id);
  } catch {}

  if (data === 'menu') {
    await sendMainMenu(chatId);
    return;
  }

  if (data === 'restart') {
    await sendMainMenu(chatId, 'Начинаем заново. Выбери услугу:');
    return;
  }

  if (data.startsWith('service:')) {
    const type = data.split(':')[1];
    setSession(chatId, {
      type,
      step: 'await_from',
      input: createBaseInput(type),
    });
    await bot.sendMessage(chatId, `Выбрано: ${title(type)}`);
    await askFirstQuestion(chatId, type);
    return;
  }

  const session = getSession(chatId);
  if (!session) {
    await sendMainMenu(chatId, 'Сессия не найдена. Выбери услугу заново:');
    return;
  }

  if (data.startsWith('doubles:')) {
    session.input.doubles = data.endsWith(':yes');
    session.step = 'await_margin';
    setSession(chatId, session);
    await bot.sendMessage(chatId, 'Выбери маржу:', marginMenu());
    return;
  }

  if (data.startsWith('lowconfidence:')) {
    session.input.lowConfidence = data.endsWith(':yes');
    session.step = 'await_margin';
    setSession(chatId, session);
    await bot.sendMessage(chatId, 'Выбери маржу:', marginMenu());
    return;
  }

  if (data.startsWith('partywithclient:')) {
    session.input.partyWithClient = data.endsWith(':yes');
    session.step = 'await_margin';
    setSession(chatId, session);
    await bot.sendMessage(chatId, 'Выбери маржу:', marginMenu());
    return;
  }

  if (data.startsWith('highmmr:')) {
    session.input.highMmrAccount = data.endsWith(':yes');
    session.step = 'await_margin';
    setSession(chatId, session);
    await bot.sendMessage(chatId, 'Выбери маржу:', marginMenu());
    return;
  }

  if (data.startsWith('margin:')) {
    const margin = Number(data.split(':')[1]);
    session.input.margin = margin / 100;
    session.step = 'await_category';
    setSession(chatId, session);
    await bot.sendMessage(chatId, 'Выбери категорию FanPay:', categoryMenu());
    return;
  }

  if (data.startsWith('category:')) {
    session.input.category = data.split(':')[1];
    setSession(chatId, session);
    await finishCalculation(chatId);
    return;
  }

  if (data === 'result:client') {
    if (!session.result) {
      await bot.sendMessage(chatId, 'Нет результата для шаблона. Сделай новый расчёт.');
      return;
    }

    await bot.sendMessage(
      chatId,
      `Шаблон клиенту:\n\n${formatClientTemplate(session.input, session.result)}`
    );
  }
});

/* =========================
   Text flow
========================= */

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  if (!text) return;

  if (text.startsWith('/')) {
    if (/^\/(start|help|cancel)$/.test(text)) return;

    try {
      const { input } = parseArgs(text);
      if (!['mmr', 'party', 'calib', 'lp', 'behavior'].includes(input.type)) {
        await bot.sendMessage(chatId, 'Неизвестная команда.');
        return;
      }
      const result = calculator.calculate(input);
      await bot.sendMessage(chatId, formatResult(input, result), resultMenu());
      setSession(chatId, {
        type: input.type,
        step: 'done',
        input,
        result,
      });
    } catch {
      await bot.sendMessage(chatId, 'Не смог разобрать команду. Проверь формат.');
    }
    return;
  }

  const session = getSession(chatId);
  if (!session) return;

  if (!isPositiveNumber(text)) {
    await bot.sendMessage(chatId, 'Нужно ввести число.');
    return;
  }

  const value = Number(text);

  if (session.step === 'await_from') {
    session.input.from = value;

    if (session.type === 'mmr') {
      session.step = 'await_to';
      setSession(chatId, session);
      await bot.sendMessage(chatId, 'Введи целевой MMR:');
      return;
    }

    if (session.type === 'party') {
      session.step = 'await_to';
      setSession(chatId, session);
      await bot.sendMessage(chatId, 'Введи количество побед:');
      return;
    }

    if (session.type === 'calib') {
      session.step = 'await_to';
      setSession(chatId, session);
      await bot.sendMessage(chatId, 'Введи количество побед:');
      return;
    }

    if (session.type === 'lp') {
      session.step = 'await_to';
      setSession(chatId, session);
      await bot.sendMessage(chatId, 'Введи количество LP игр:');
      return;
    }

    if (session.type === 'behavior') {
      session.step = 'await_to';
      setSession(chatId, session);
      await bot.sendMessage(chatId, 'Введи целевой behaviour score:');
      return;
    }
  }

  if (session.step === 'await_to') {
    session.input.to = value;
    setSession(chatId, session);

    if (session.type === 'mmr') {
      session.step = 'await_doubles';
      setSession(chatId, session);
      await bot.sendMessage(chatId, 'Есть даблы?', yesNoMenu('doubles'));
      return;
    }

    if (session.type === 'party') {
      session.step = 'await_doubles';
      setSession(chatId, session);
      await bot.sendMessage(chatId, 'Есть даблы?', yesNoMenu('doubles'));
      return;
    }

    if (session.type === 'calib') {
      session.step = 'await_margin';
      setSession(chatId, session);
      await bot.sendMessage(chatId, 'Выбери маржу:', marginMenu());
      return;
    }

    if (session.type === 'lp') {
      session.step = 'await_party_with_client';
      setSession(chatId, session);
      await bot.sendMessage(chatId, 'Это пати с клиентом?', yesNoMenu('partywithclient'));
      return;
    }

    if (session.type === 'behavior') {
      session.step = 'await_highmmr';
      setSession(chatId, session);
      await bot.sendMessage(chatId, 'Аккаунт высокий по MMR?', yesNoMenu('highmmr'));
      return;
    }
  }

  if (session.step === 'await_doubles' && session.type === 'party') {
    session.input.doubles = value > 0;
    session.step = 'await_lowconfidence';
    setSession(chatId, session);
    await bot.sendMessage(chatId, 'Низкая уверенность в аккаунте?', yesNoMenu('lowconfidence'));
    return;
  }
});

/* =========================
   Polling errors
========================= */

bot.on('polling_error', (error) => {
  console.error('error: [polling_error]', JSON.stringify({
    code: error?.code,
    message: error?.message,
  }));
});
