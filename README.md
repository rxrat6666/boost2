# Dota Boost Suite

Готовый комплект: современный веб-калькулятор + Telegram-бот на общей логике расчёта.

## Что внутри

- `index.html` — UI уровня operator panel
- `css/styles.css` — новый адаптивный интерфейс
- `js/main.js` — автопересчёт, история, копирование, пресеты
- `shared/calc-core.js` — общая математика для сайта и бота
- `data/prices.json` — все тарифы и коэффициенты отдельно от кода
- `bot/bot.js` — Telegram-бот с командами

## Запуск сайта

```bash
cd dota_boost_suite
python3 -m http.server 8080
```

Потом открой `http://localhost:8080`.

## Запуск Telegram-бота

```bash
cd dota_boost_suite
npm install
export BOT_TOKEN=твой_токен
npm run bot
```

## Примеры команд для бота

```bash
/mmr 3000 4500 doubles margin=25 category=boost
/party 4000 5 doubles low margin=25 category=boost
/calib 5000 8 margin=25 category=boost
/lp 3500 3 party margin=25 category=boost
/behavior 4000 8000 highmmr margin=25 category=boost
```

## Что уже сделано

- новый UI с карточками услуг
- автопересчёт без кнопки
- копирование текста клиенту / себе / команды для бота
- история последних расчётов
- калькулятор комиссии FanPay 50/50
- вынесенные цены в JSON
- единый движок расчётов

## Что можно добавить дальше

- сохранение истории на backend
- авторизацию
- редактирование цен через админку
- кнопочный сценарий в Telegram-боте
- деплой на VPS
