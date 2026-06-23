// backend/src/game/profileCatalog.js

const ACHIEVEMENTS = [
  { id: 'first_game', icon: '🎲', tier: 'common', xp: 20, title: { he: 'משחק ראשון', en: 'First Game', ru: 'Первая игра' }, description: { he: 'שחק משחק אחד', en: 'Play one game', ru: 'Сыграй одну игру' }, check: s => s.games >= 1 },
  { id: 'first_win', icon: '🏆', tier: 'common', xp: 35, title: { he: 'ניצחון ראשון', en: 'First Win', ru: 'Первая победа' }, description: { he: 'נצח משחק אחד', en: 'Win one game', ru: 'Выиграй одну игру' }, check: s => s.wins >= 1 },
  { id: 'ten_games', icon: '🎮', tier: 'common', xp: 40, title: { he: 'שחקן פעיל', en: 'Active Player', ru: 'Активный игрок' }, description: { he: 'שחק 10 משחקים', en: 'Play 10 games', ru: 'Сыграй 10 игр' }, check: s => s.games >= 10 },
  { id: 'fifty_games', icon: '🕹️', tier: 'rare', xp: 120, title: { he: 'ותיק', en: 'Veteran', ru: 'Ветеран' }, description: { he: 'שחק 50 משחקים', en: 'Play 50 games', ru: 'Сыграй 50 игр' }, check: s => s.games >= 50 },
  { id: 'hundred_games', icon: '💪', tier: 'epic', xp: 250, title: { he: 'מכור לקוביות', en: 'Dice Addict', ru: 'Фанат кубиков' }, description: { he: 'שחק 100 משחקים', en: 'Play 100 games', ru: 'Сыграй 100 игр' }, check: s => s.games >= 100 },
  { id: 'ten_wins', icon: '🥉', tier: 'rare', xp: 90, title: { he: '10 ניצחונות', en: '10 Wins', ru: '10 побед' }, description: { he: 'נצח 10 משחקים', en: 'Win 10 games', ru: 'Выиграй 10 игр' }, check: s => s.wins >= 10 },
  { id: 'fifty_wins', icon: '🥈', tier: 'epic', xp: 220, title: { he: '50 ניצחונות', en: '50 Wins', ru: '50 побед' }, description: { he: 'נצח 50 משחקים', en: 'Win 50 games', ru: 'Выиграй 50 игр' }, check: s => s.wins >= 50 },
  { id: 'hundred_wins', icon: '🥇', tier: 'legendary', xp: 500, title: { he: 'אלוף', en: 'Champion', ru: 'Чемпион' }, description: { he: 'נצח 100 משחקים', en: 'Win 100 games', ru: 'Выиграй 100 игр' }, check: s => s.wins >= 100 },
  { id: 'level_5', icon: '⭐', tier: 'common', xp: 40, title: { he: 'רמה 5', en: 'Level 5', ru: 'Уровень 5' }, description: { he: 'הגע לרמה 5', en: 'Reach level 5', ru: 'Достигни 5 уровня' }, check: s => s.level >= 5 },
  { id: 'level_10', icon: '🌟', tier: 'rare', xp: 90, title: { he: 'רמה 10', en: 'Level 10', ru: 'Уровень 10' }, description: { he: 'הגע לרמה 10', en: 'Reach level 10', ru: 'Достигни 10 уровня' }, check: s => s.level >= 10 },
  { id: 'level_25', icon: '💫', tier: 'epic', xp: 220, title: { he: 'רמה 25', en: 'Level 25', ru: 'Уровень 25' }, description: { he: 'הגע לרמה 25', en: 'Reach level 25', ru: 'Достигни 25 уровня' }, check: s => s.level >= 25 },
  { id: 'level_50', icon: '🌌', tier: 'legendary', xp: 600, title: { he: 'רמה 50', en: 'Level 50', ru: 'Уровень 50' }, description: { he: 'הגע לרמה 50', en: 'Reach level 50', ru: 'Достигни 50 уровня' }, check: s => s.level >= 50 },
  { id: 'invite_1', icon: '👥', tier: 'common', xp: 50, title: { he: 'חבר ראשון', en: 'First Friend', ru: 'Первый друг' }, description: { he: 'הזמן חבר אחד', en: 'Invite one friend', ru: 'Пригласи одного друга' }, check: s => s.friendsInvited >= 1 },
  { id: 'invite_5', icon: '🤝', tier: 'rare', xp: 180, title: { he: 'חמישה חברים', en: '5 Friends', ru: '5 друзей' }, description: { he: 'הזמן 5 חברים', en: 'Invite 5 friends', ru: 'Пригласи 5 друзей' }, check: s => s.friendsInvited >= 5 },
  { id: 'login_3', icon: '🔥', tier: 'common', xp: 40, title: { he: 'רצף 3 ימים', en: '3 Day Streak', ru: 'Серия 3 дня' }, description: { he: 'התחבר 3 ימים ברצף', en: 'Log in 3 days in a row', ru: 'Заходи 3 дня подряд' }, check: s => s.bestLoginStreak >= 3 },
  { id: 'login_7', icon: '⚡', tier: 'rare', xp: 120, title: { he: 'רצף שבועי', en: '7 Day Streak', ru: 'Серия 7 дней' }, description: { he: 'התחבר 7 ימים ברצף', en: 'Log in 7 days in a row', ru: 'Заходи 7 дней подряд' }, check: s => s.bestLoginStreak >= 7 },
];

const AVATAR_UNLOCKS = [
  { id: 'turtle', type: 'avatar', value: '🐢', rarity: 'common', unlock: { type: 'level', level: 1 } },
  { id: 'rabbit', type: 'avatar', value: '🐰', rarity: 'common', unlock: { type: 'level', level: 1 } },
  { id: 'cat', type: 'avatar', value: '🐱', rarity: 'common', unlock: { type: 'level', level: 2 } },
  { id: 'dog', type: 'avatar', value: '🐶', rarity: 'common', unlock: { type: 'level', level: 3 } },
  { id: 'panda', type: 'avatar', value: '🐼', rarity: 'common', unlock: { type: 'level', level: 5 } },
  { id: 'fox', type: 'avatar', value: '🦊', rarity: 'rare', unlock: { type: 'level', level: 10 } },
  { id: 'wolf', type: 'avatar', value: '🐺', rarity: 'rare', unlock: { type: 'level', level: 15 } },
  { id: 'owl', type: 'avatar', value: '🦉', rarity: 'rare', unlock: { type: 'achievement', achievement: 'login_7' } },
  { id: 'lion', type: 'avatar', value: '🦁', rarity: 'epic', unlock: { type: 'level', level: 25 } },
  { id: 'tiger', type: 'avatar', value: '🐯', rarity: 'epic', unlock: { type: 'achievement', achievement: 'ten_wins' } },
  { id: 'dragon', type: 'avatar', value: '🐲', rarity: 'legendary', unlock: { type: 'level', level: 50 } },
  { id: 'unicorn', type: 'avatar', value: '🦄', rarity: 'legendary', unlock: { type: 'achievement', achievement: 'hundred_wins' } },
];

const BACKGROUND_UNLOCKS = [
  { id: 'default_purple', type: 'background', label: 'Purple', rarity: 'common', unlock: { type: 'level', level: 1 } },
  { id: 'blue', type: 'background', label: 'Blue', rarity: 'common', unlock: { type: 'level', level: 3 } },
  { id: 'green', type: 'background', label: 'Green', rarity: 'common', unlock: { type: 'level', level: 5 } },
  { id: 'gold', type: 'background', label: 'Gold', rarity: 'rare', unlock: { type: 'level', level: 10 } },
  { id: 'galaxy', type: 'background', label: 'Galaxy', rarity: 'epic', unlock: { type: 'level', level: 25 } },
  { id: 'rainbow_animated', type: 'background', label: 'Rainbow', rarity: 'legendary', unlock: { type: 'level', level: 100 } },
];

const FRAME_UNLOCKS = [
  { id: 'basic', type: 'frame', label: 'Basic', rarity: 'common', unlock: { type: 'level', level: 1 } },
  { id: 'purple', type: 'frame', label: 'Purple', rarity: 'common', unlock: { type: 'level', level: 5 } },
  { id: 'gold', type: 'frame', label: 'Gold', rarity: 'rare', unlock: { type: 'achievement', achievement: 'first_win' } },
  { id: 'neon', type: 'frame', label: 'Neon', rarity: 'epic', unlock: { type: 'level', level: 25 } },
];

function localize(value, lang = 'en') {
  if (!value || typeof value !== 'object') return value;
  return value[lang] || value.en || value.he || Object.values(value)[0];
}

function buildStats(user) {
  return {
    games: user.total_games || 0,
    wins: user.total_wins || 0,
    score: user.score || 0,
    level: user.level || 1,
    friendsInvited: user.friends_invited || 0,
    loginStreak: user.login_streak || 0,
    bestLoginStreak: user.best_login_streak || 0,
    starsBought: user.stars_bought || 0,
  };
}

function getUnlockedAchievementIds(user) {
  const stats = buildStats(user);
  return new Set(ACHIEVEMENTS.filter(a => a.check(stats)).map(a => a.id));
}

function buildAchievements(user, lang = 'en') {
  const stats = buildStats(user);
  return ACHIEVEMENTS.map(a => {
    const unlocked = a.check(stats);
    return {
      id: a.id,
      icon: a.icon,
      tier: a.tier,
      xp: a.xp,
      unlocked,
      title: localize(a.title, lang),
      description: localize(a.description, lang),
    };
  });
}

function isItemUnlocked(item, user, achievementIds) {
  const unlock = item.unlock || { type: 'level', level: 1 };
  if (unlock.type === 'level') return (user.level || 1) >= unlock.level;
  if (unlock.type === 'achievement') return achievementIds.has(unlock.achievement);
  return false;
}

function unlockText(item, lang = 'en') {
  const unlock = item.unlock || { type: 'level', level: 1 };
  if (unlock.type === 'level') {
    if (lang === 'he') return `נפתח ברמה ${unlock.level}`;
    if (lang === 'ru') return `Откроется на уровне ${unlock.level}`;
    return `Unlocks at level ${unlock.level}`;
  }
  if (unlock.type === 'achievement') {
    const ach = ACHIEVEMENTS.find(a => a.id === unlock.achievement);
    const name = ach ? localize(ach.title, lang) : unlock.achievement;
    if (lang === 'he') return `נפתח בהישג: ${name}`;
    if (lang === 'ru') return `Откроется за достижение: ${name}`;
    return `Unlocks from achievement: ${name}`;
  }
  return '';
}

function buildCollection(user, lang = 'en') {
  const achievementIds = getUnlockedAchievementIds(user);
  const decorate = item => ({
    ...item,
    unlocked: isItemUnlocked(item, user, achievementIds),
    unlockText: unlockText(item, lang),
  });
  return {
    avatars: AVATAR_UNLOCKS.map(decorate),
    backgrounds: BACKGROUND_UNLOCKS.map(decorate),
    frames: FRAME_UNLOCKS.map(decorate),
  };
}

function canUseProfileItem(user, type, valueOrId) {
  const collection = buildCollection(user, 'en');
  const list = type === 'avatar' ? collection.avatars : type === 'background' ? collection.backgrounds : collection.frames;
  return list.some(item => item.unlocked && (item.value === valueOrId || item.id === valueOrId));
}

module.exports = {
  ACHIEVEMENTS,
  buildAchievements,
  buildCollection,
  canUseProfileItem,
};
