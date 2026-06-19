// backend/src/socket/botPlayers.js

const BOT_NAMES = [
  // English
  'Alex K.', 'Mike T.', 'Sam R.', 'Jake M.', 'Chris B.',
  'Dave L.', 'Tom W.', 'Ryan S.', 'Nick P.', 'Jack H.',
  'Emma D.', 'Lisa K.', 'Sara M.', 'Kate B.', 'Anna W.',
  // Russian
  'Дмитрий', 'Александр', 'Сергей', 'Андрей', 'Максим',
  'Николай', 'Иван', 'Михаил', 'Павел', 'Артём',
  'Ольга', 'Наташа', 'Катя', 'Аня', 'Маша',
];

let botIdCounter = 900000000;

function createBotPlayer() {
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  const id = ++botIdCounter;
  return {
    id,
    telegram_id: String(id),
    username: null,
    first_name: name,
    isBot: true,
    balance: 99999,
  };
}

// 2 עד 5 בוטים רנדומלית
function randomBotCount() {
  return Math.floor(Math.random() * 4) + 2;
}

module.exports = { createBotPlayer, randomBotCount };
