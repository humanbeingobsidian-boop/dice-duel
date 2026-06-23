// backend/src/socket/botPlayers.js

const BOT_NAMES = [
  // International / English-style names
  'Alex Morgan', 'Maya Cohen', 'Daniel Brooks', 'Emma Levy', 'Ryan Stone',
  'Sophie Lane', 'Leo Carter', 'Nina Parker', 'Liam Reed', 'Mia Collins',
  'Noah Bennett', 'Ava Ross', 'Ethan Miller', 'Chloe Adams', 'Ben Taylor',
  'Ella Green', 'Tom Harris', 'Sarah Blake', 'Nick Cooper', 'Anna White',

  // Hebrew / Israeli-style names written in English so they feel natural in any app language
  'Noam Levi', 'Amit Cohen', 'Lior Katz', 'Yael Amir', 'Eden Mizrahi',
  'Omer Azulay', 'Shira Peretz', 'Itay Bar', 'Dana Mor', 'Niv Shalev',
  'Roni Gal', 'Tamar Biton', 'Ariel Dahan', 'Adi Stern', 'Yoni Raz',

  // Russian / Eastern European names
  'Dima Volkov', 'Sasha Ivanov', 'Misha Petrov', 'Nikita Orlov', 'Pavel Sokolov',
  'Olga Smirnova', 'Katya Morozova', 'Anya Fedorova', 'Nadia Romanova', 'Lena Kuznetsova',
  'Maxim Popov', 'Artem Belov', 'Irina Volkova', 'Vera Petrova', 'Alina Sokolova',
];

const AVATARS = ['🦊', '🐼', '🐯', '🐵', '🐨', '🐺', '🦁', '🐸', '🐧', '🐰', '🦄', '🐲', '🦉', '🐙', '🦋', '⭐', '🔥', '⚡', '🌙', '🍀'];
const AVATAR_COLORS = [
  'linear-gradient(135deg, #7c3aed, #a855f7)',
  'linear-gradient(135deg, #2563eb, #38bdf8)',
  'linear-gradient(135deg, #059669, #34d399)',
  'linear-gradient(135deg, #dc2626, #fb7185)',
  'linear-gradient(135deg, #d97706, #fbbf24)',
  'linear-gradient(135deg, #9333ea, #ec4899)',
  'linear-gradient(135deg, #0f766e, #2dd4bf)',
  'linear-gradient(135deg, #4f46e5, #818cf8)',
];

let botIdCounter = 900000000;

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createBotPlayer() {
  const name = pick(BOT_NAMES);
  const id = ++botIdCounter;
  const thoughtful = Math.random() < 0.35;
  return {
    id,
    telegram_id: String(id),
    username: null,
    first_name: name,
    isBot: true,
    balance: 99999,
    avatar: pick(AVATARS),
    avatarColor: pick(AVATAR_COLORS),
    readyDelayMs: randomBetween(2500, 14000),
    turnDelayMinMs: thoughtful ? randomBetween(3500, 5200) : randomBetween(900, 2200),
    turnDelayMaxMs: thoughtful ? randomBetween(7200, 9400) : randomBetween(3200, 6200),
  };
}

// 1 עד 4 בוטים רנדומלית
function randomBotCount() {
  return Math.floor(Math.random() * 4) + 1;
}

module.exports = { createBotPlayer, randomBotCount };
