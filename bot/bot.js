import TelegramBot from 'node-telegram-bot-api';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCalculator } from '../shared/calc-core.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/prices.json'), 'utf8'));
const calculator = createCalculator(config);

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('Укажи BOT_TOKEN в переменных окружения.');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

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
    }
  };
}

function title(type) {
  return {
    mmr: 'MMR Boost',
    party: 'Party Boost',
    calib: 'Calibration',
    lp: 'Low Priority',
    behavior: 'Behavior'
  }[type] || type;
}

function formatMoney(value) {
  return `${Math.round(value)} ₽`;
}

function formatResult(input, result) {
  return [
    `🎮 ${title(input.type)}`,
    '',
    `От: ${input.from}`,
    `До: ${input.to}`,
    `Фикс: ${formatMoney(result.fix)}`,
    `Бустеру: ${formatMoney(result.booster)}`,
    `Выплата бустеру 50/50: ${formatMoney(result.boosterPayout)}`,
    `Клиенту: ${formatMoney(result.client)}`,
    `Прибыль: ${formatMoney(result.profit)}`,
    `Коэфф.: ${result.coeff}`,
  ].join('\n');
}

bot.onText(/\/start|\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, [
    'Команды:',
    '/mmr 3000 4500 doubles margin=25 category=boost',
    '/party 4000 5 doubles low margin=25 category=boost',
    '/calib 5000 8 margin=25 category=boost',
    '/lp 3500 3 party margin=25 category=boost',
    '/behavior 4000 8000 highmmr margin=25 category=boost',
  ].join('\n'));
});

bot.on('message', async (msg) => {
  const text = msg.text || '';
  if (!text.startsWith('/')) return;
  if (text === '/start' || text === '/help') return;

  try {
    const { input } = parseArgs(text);
    const result = calculator.calculate(input);
    await bot.sendMessage(msg.chat.id, formatResult(input, result));
  } catch (error) {
    await bot.sendMessage(msg.chat.id, 'Не смог разобрать команду. Проверь формат.');
  }
});
