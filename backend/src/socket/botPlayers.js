// backend/src/socket/botPlayers.js

const BOT_NAMES = [
  // English names
  'Alex Morgan', 'Maya Brooks', 'Daniel Stone', 'Emma Lane', 'Ryan Carter',
  'Sophie Reed', 'Leo Parker', 'Nina Collins', 'Liam Bennett', 'Mia Ross',
  'Noah Miller', 'Ava Taylor', 'Ethan Green', 'Chloe Adams', 'Ben Harris',
  'Ella White', 'Tom Cooper', 'Sarah Blake', 'Nick Mason', 'Anna Grey',

  // English nicknames / gamer-style aliases
  'LuckyFox', 'DiceKing', 'MoonRoller', 'NeonCat', 'TurboTom',
  'MistyWolf', 'RollMaster', 'BlueTiger', 'PixelAce', 'GoldenPanda',
  'ShadowDice', 'RocketSam', 'WildCard', 'SilentRoll', 'StormPlayer',
  'QuickDice', 'FoxyAce', 'NightOwl', 'LuckySeven', 'DiceHunter',

  // Hebrew names
  'נועם', 'עמית', 'ליאור', 'יעל', 'עדן',
  'עומר', 'שירה', 'איתי', 'דנה', 'ניב',
  'רוני', 'תמר', 'אריאל', 'עדי', 'יונתן',
  'מאיה', 'אורי', 'גל', 'אביב', 'שחר',

  // Hebrew nicknames
  'מלך הקוביות', 'נסיך המזל', 'שועל מהיר', 'זורק חזק', 'כוכב הלילה',
  'מזליקו', 'קוביית זהב', 'טיל סגול', 'פנדה כחולה', 'נמר מזל',
  'אש על הקוביה', 'חצי מזל', 'הזורק השקט', 'קפטן שש', 'בום קוביה',
  'אחד שלא נופל', 'רולטה קטנה', 'עין המזל', 'דרקון סגול', 'קוביית פלא',

  // Russian names
  'Дима', 'Саша', 'Миша', 'Никита', 'Павел',
  'Ольга', 'Катя', 'Аня', 'Надя', 'Лена',
  'Максим', 'Артём', 'Ирина', 'Вера', 'Алина',
  'Кирилл', 'Марина', 'Егор', 'Полина', 'Влад',

  // Russian nicknames
  'КубикМастер', 'ЛисУдачи', 'НочнойИгрок', 'ТихийБросок', 'ЗолотойКуб',
  'БыстрыйВолк', 'Панда777', 'КапитанШесть', 'ТурбоКубик', 'ЛунныйКот',
  'МистерРолл', 'ДикийШанс', 'СинийТигр', 'ОгненныйКуб', 'ФортунаПро',
  'КубикНиндзя', 'Счастливчик', 'РакетаДима', 'НеонИгрок', 'Шанс777',

  // Mixed international nicknames that work in several languages
  'Dice Ninja', 'Lucky Panda', 'Star Roller', 'Fox 777', 'Roll Fox',
  'Mister Six', 'Turbo Dice', 'Gold Roll', 'Moon Dice', 'Ace Roll',
  'Dragon Dice', 'Panda Roll', 'Neon Roll', 'Magic Dice', 'Lucky Star',
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
