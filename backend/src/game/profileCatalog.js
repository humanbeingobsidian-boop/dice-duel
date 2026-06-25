// backend/src/game/profileCatalog.js

const ACHIEVEMENTS = [
  { id: 'first_game', icon: '🎲', tier: 'common', xp: 20, title: { he: 'משחק ראשון', en: 'First Game', ru: 'Первая игра' }, description: { he: 'שחק משחק אחד', en: 'Play one game', ru: 'Сыграй одну игру' }, check: s => s.games >= 1 },
  { id: 'first_win', icon: '🏆', tier: 'common', xp: 35, title: { he: 'ניצחון ראשון', en: 'First Win', ru: 'Первая победа' }, description: { he: 'נצח משחק אחד', en: 'Win one game', ru: 'Выиграй одну игру' }, check: s => s.wins >= 1 },
  { id: 'five_games', icon: '🎯', tier: 'common', xp: 30, title: { he: 'מתחמם', en: 'Warming Up', ru: 'Разогрев' }, description: { he: 'שחק 5 משחקים', en: 'Play 5 games', ru: 'Сыграй 5 игр' }, check: s => s.games >= 5 },
  { id: 'ten_games', icon: '🎮', tier: 'common', xp: 40, title: { he: 'שחקן פעיל', en: 'Active Player', ru: 'Активный игрок' }, description: { he: 'שחק 10 משחקים', en: 'Play 10 games', ru: 'Сыграй 10 игр' }, check: s => s.games >= 10 },
  { id: 'twenty_five_games', icon: '🧩', tier: 'rare', xp: 80, title: { he: 'קבוע בשולחן', en: 'Table Regular', ru: 'Постоянный игрок' }, description: { he: 'שחק 25 משחקים', en: 'Play 25 games', ru: 'Сыграй 25 игр' }, check: s => s.games >= 25 },
  { id: 'fifty_games', icon: '🕹️', tier: 'rare', xp: 120, title: { he: 'ותיק', en: 'Veteran', ru: 'Ветеран' }, description: { he: 'שחק 50 משחקים', en: 'Play 50 games', ru: 'Сыграй 50 игр' }, check: s => s.games >= 50 },
  { id: 'hundred_games', icon: '💪', tier: 'epic', xp: 250, title: { he: 'מכור לקוביות', en: 'Dice Addict', ru: 'Фанат кубиков' }, description: { he: 'שחק 100 משחקים', en: 'Play 100 games', ru: 'Сыграй 100 игр' }, check: s => s.games >= 100 },
  { id: 'five_hundred_games', icon: '🧠', tier: 'legendary', xp: 900, title: { he: 'אגדת השולחן', en: 'Table Legend', ru: 'Легенда стола' }, description: { he: 'שחק 500 משחקים', en: 'Play 500 games', ru: 'Сыграй 500 игр' }, check: s => s.games >= 500 },

  { id: 'five_wins', icon: '🥉', tier: 'common', xp: 55, title: { he: '5 ניצחונות', en: '5 Wins', ru: '5 побед' }, description: { he: 'נצח 5 משחקים', en: 'Win 5 games', ru: 'Выиграй 5 игр' }, check: s => s.wins >= 5 },
  { id: 'ten_wins', icon: '🥉', tier: 'rare', xp: 90, title: { he: '10 ניצחונות', en: '10 Wins', ru: '10 побед' }, description: { he: 'נצח 10 משחקים', en: 'Win 10 games', ru: 'Выиграй 10 игр' }, check: s => s.wins >= 10 },
  { id: 'twenty_five_wins', icon: '🏅', tier: 'rare', xp: 150, title: { he: '25 ניצחונות', en: '25 Wins', ru: '25 побед' }, description: { he: 'נצח 25 משחקים', en: 'Win 25 games', ru: 'Выиграй 25 игр' }, check: s => s.wins >= 25 },
  { id: 'fifty_wins', icon: '🥈', tier: 'epic', xp: 220, title: { he: '50 ניצחונות', en: '50 Wins', ru: '50 побед' }, description: { he: 'נצח 50 משחקים', en: 'Win 50 games', ru: 'Выиграй 50 игр' }, check: s => s.wins >= 50 },
  { id: 'hundred_wins', icon: '🥇', tier: 'legendary', xp: 500, title: { he: 'אלוף', en: 'Champion', ru: 'Чемпион' }, description: { he: 'נצח 100 משחקים', en: 'Win 100 games', ru: 'Выиграй 100 игр' }, check: s => s.wins >= 100 },
  { id: 'five_hundred_wins', icon: '👑', tier: 'mythic', xp: 1200, title: { he: 'מלך הקוביות', en: 'Dice King', ru: 'Король кубиков' }, description: { he: 'נצח 500 משחקים', en: 'Win 500 games', ru: 'Выиграй 500 игр' }, check: s => s.wins >= 500 },

  { id: 'score_25', icon: '⭐', tier: 'common', xp: 40, title: { he: '25 ניקוד', en: '25 Score', ru: '25 очков' }, description: { he: 'הגע ל־25 ניקוד', en: 'Reach 25 score', ru: 'Набери 25 очков' }, check: s => s.score >= 25 },
  { id: 'score_100', icon: '🌟', tier: 'rare', xp: 120, title: { he: '100 ניקוד', en: '100 Score', ru: '100 очков' }, description: { he: 'הגע ל־100 ניקוד', en: 'Reach 100 score', ru: 'Набери 100 очков' }, check: s => s.score >= 100 },
  { id: 'score_500', icon: '💎', tier: 'epic', xp: 350, title: { he: '500 ניקוד', en: '500 Score', ru: '500 очков' }, description: { he: 'הגע ל־500 ניקוד', en: 'Reach 500 score', ru: 'Набери 500 очков' }, check: s => s.score >= 500 },
  { id: 'score_2000', icon: '🌌', tier: 'legendary', xp: 900, title: { he: '2000 ניקוד', en: '2000 Score', ru: '2000 очков' }, description: { he: 'הגע ל־2000 ניקוד', en: 'Reach 2000 score', ru: 'Набери 2000 очков' }, check: s => s.score >= 2000 },

  { id: 'level_5', icon: '⭐', tier: 'common', xp: 40, title: { he: 'רמה 5', en: 'Level 5', ru: 'Уровень 5' }, description: { he: 'הגע לרמה 5', en: 'Reach level 5', ru: 'Достигни 5 уровня' }, check: s => s.level >= 5 },
  { id: 'level_10', icon: '🌟', tier: 'rare', xp: 90, title: { he: 'רמה 10', en: 'Level 10', ru: 'Уровень 10' }, description: { he: 'הגע לרמה 10', en: 'Reach level 10', ru: 'Достигни 10 уровня' }, check: s => s.level >= 10 },
  { id: 'level_25', icon: '💫', tier: 'epic', xp: 220, title: { he: 'רמה 25', en: 'Level 25', ru: 'Уровень 25' }, description: { he: 'הגע לרמה 25', en: 'Reach level 25', ru: 'Достигни 25 уровня' }, check: s => s.level >= 25 },
  { id: 'level_50', icon: '🌌', tier: 'legendary', xp: 600, title: { he: 'רמה 50', en: 'Level 50', ru: 'Уровень 50' }, description: { he: 'הגע לרמה 50', en: 'Reach level 50', ru: 'Достигни 50 уровня' }, check: s => s.level >= 50 },
  { id: 'level_75', icon: '☄️', tier: 'legendary', xp: 900, title: { he: 'רמה 75', en: 'Level 75', ru: 'Уровень 75' }, description: { he: 'הגע לרמה 75', en: 'Reach level 75', ru: 'Достигни 75 уровня' }, check: s => s.level >= 75 },
  { id: 'level_100', icon: '🌈', tier: 'mythic', xp: 1500, title: { he: 'רמה 100', en: 'Level 100', ru: 'Уровень 100' }, description: { he: 'הגע לרמה 100', en: 'Reach level 100', ru: 'Достигни 100 уровня' }, check: s => s.level >= 100 },

  { id: 'invite_1', icon: '👥', tier: 'common', xp: 50, title: { he: 'חבר ראשון', en: 'First Friend', ru: 'Первый друг' }, description: { he: 'הזמן חבר אחד', en: 'Invite one friend', ru: 'Пригласи одного друга' }, check: s => s.friendsInvited >= 1 },
  { id: 'invite_5', icon: '🤝', tier: 'rare', xp: 180, title: { he: 'חמישה חברים', en: '5 Friends', ru: '5 друзей' }, description: { he: 'הזמן 5 חברים', en: 'Invite 5 friends', ru: 'Пригласи 5 друзей' }, check: s => s.friendsInvited >= 5 },
  { id: 'invite_20', icon: '📣', tier: 'epic', xp: 500, title: { he: 'קהילה קטנה', en: 'Small Community', ru: 'Маленькое сообщество' }, description: { he: 'הזמן 20 חברים', en: 'Invite 20 friends', ru: 'Пригласи 20 друзей' }, check: s => s.friendsInvited >= 20 },
  { id: 'invite_100', icon: '🌍', tier: 'mythic', xp: 2000, title: { he: 'יוצר קהילה', en: 'Community Builder', ru: 'Создатель сообщества' }, description: { he: 'הזמן 100 חברים', en: 'Invite 100 friends', ru: 'Пригласи 100 друзей' }, check: s => s.friendsInvited >= 100 },

  { id: 'wheel_streak_3', icon: '🎡', tier: 'common', xp: 40, title: { he: 'רצף גלגל 3 ימים', en: '3 Day Spin Streak', ru: 'Серия колеса 3 дня' }, description: { he: 'סובב את הגלגל 3 ימים ברצף', en: 'Spin the wheel 3 days in a row', ru: 'Крути колесо 3 дня подряд' }, check: s => s.bestWheelSpinStreak >= 3 },
  { id: 'wheel_streak_7', icon: '🔥', tier: 'rare', xp: 120, title: { he: 'רצף גלגל שבועי', en: '7 Day Spin Streak', ru: 'Серия колеса 7 дней' }, description: { he: 'סובב את הגלגל 7 ימים ברצף', en: 'Spin the wheel 7 days in a row', ru: 'Крути колесо 7 дней подряд' }, check: s => s.bestWheelSpinStreak >= 7 },
  { id: 'wheel_streak_14', icon: '⚡', tier: 'rare', xp: 220, title: { he: 'רצף גלגל 14 ימים', en: '14 Day Spin Streak', ru: 'Серия колеса 14 дней' }, description: { he: 'סובב את הגלגל 14 ימים ברצף', en: 'Spin the wheel 14 days in a row', ru: 'Крути колесо 14 дней подряд' }, check: s => s.bestWheelSpinStreak >= 14 },
  { id: 'wheel_streak_30', icon: '📅', tier: 'epic', xp: 600, title: { he: 'רצף גלגל חודשי', en: '30 Day Spin Streak', ru: 'Серия колеса 30 дней' }, description: { he: 'סובב את הגלגל 30 ימים ברצף', en: 'Spin the wheel 30 days in a row', ru: 'Крути колесо 30 дней подряд' }, check: s => s.bestWheelSpinStreak >= 30 },
  { id: 'wheel_streak_100', icon: '👑', tier: 'legendary', xp: 1600, title: { he: '100 ימי גלגל', en: '100 Day Spin Streak', ru: 'Серия колеса 100 дней' }, description: { he: 'סובב את הגלגל 100 ימים ברצף', en: 'Spin the wheel 100 days in a row', ru: 'Крути колесо 100 дней подряд' }, check: s => s.bestWheelSpinStreak >= 100 },
  { id: 'wheel_spins_10', icon: '🔁', tier: 'common', xp: 50, title: { he: '10 סיבובים', en: '10 Spins', ru: '10 спинов' }, description: { he: 'סובב את הגלגל 10 פעמים', en: 'Spin the wheel 10 times', ru: 'Прокрути колесо 10 раз' }, check: s => s.totalWheelSpins >= 10 },
  { id: 'wheel_spins_50', icon: '🌀', tier: 'rare', xp: 180, title: { he: '50 סיבובים', en: '50 Spins', ru: '50 спинов' }, description: { he: 'סובב את הגלגל 50 פעמים', en: 'Spin the wheel 50 times', ru: 'Прокрути колесо 50 раз' }, check: s => s.totalWheelSpins >= 50 },
  { id: 'wheel_spins_100', icon: '🎰', tier: 'epic', xp: 450, title: { he: '100 סיבובים', en: '100 Spins', ru: '100 спинов' }, description: { he: 'סובב את הגלגל 100 פעמים', en: 'Spin the wheel 100 times', ru: 'Прокрути колесо 100 раз' }, check: s => s.totalWheelSpins >= 100 },
  { id: 'wheel_spins_365', icon: '🗓️', tier: 'legendary', xp: 1400, title: { he: '365 סיבובים', en: '365 Spins', ru: '365 спинов' }, description: { he: 'סובב את הגלגל 365 פעמים', en: 'Spin the wheel 365 times', ru: 'Прокрути колесо 365 раз' }, check: s => s.totalWheelSpins >= 365 },
  { id: 'wheel_spins_1000', icon: '🌈', tier: 'mythic', xp: 3500, title: { he: '1000 סיבובים', en: '1000 Spins', ru: '1000 спинов' }, description: { he: 'סובב את הגלגל 1000 פעמים', en: 'Spin the wheel 1000 times', ru: 'Прокрути колесо 1000 раз' }, check: s => s.totalWheelSpins >= 1000 },

  { id: 'stars_50', icon: '⭐', tier: 'rare', xp: 100, title: { he: '50 כוכבים', en: '50 Stars', ru: '50 Stars' }, description: { he: 'קנה 50 כוכבים', en: 'Buy 50 Stars', ru: 'Купи 50 Stars' }, check: s => s.starsBought >= 50 },
  { id: 'stars_500', icon: '💫', tier: 'epic', xp: 500, title: { he: '500 כוכבים', en: '500 Stars', ru: '500 Stars' }, description: { he: 'קנה 500 כוכבים', en: 'Buy 500 Stars', ru: 'Купи 500 Stars' }, check: s => s.starsBought >= 500 },
  { id: 'stars_2000', icon: '🌠', tier: 'legendary', xp: 1500, title: { he: '2000 כוכבים', en: '2000 Stars', ru: '2000 Stars' }, description: { he: 'קנה 2000 כוכבים', en: 'Buy 2000 Stars', ru: 'Купи 2000 Stars' }, check: s => s.starsBought >= 2000 },
];

const AVATAR_UNLOCKS = [
  { id: 'turtle', type: 'avatar', value: '🐢', rarity: 'common', unlock: { type: 'level', level: 1 } },
  { id: 'rabbit', type: 'avatar', value: '🐰', rarity: 'common', unlock: { type: 'level', level: 1 } },
  { id: 'cat', type: 'avatar', value: '🐱', rarity: 'common', unlock: { type: 'level', level: 2 } },
  { id: 'dog', type: 'avatar', value: '🐶', rarity: 'common', unlock: { type: 'level', level: 3 } },
  { id: 'frog', type: 'avatar', value: '🐸', rarity: 'common', unlock: { type: 'level', level: 4 } },
  { id: 'panda', type: 'avatar', value: '🐼', rarity: 'common', unlock: { type: 'level', level: 5 } },
  { id: 'penguin', type: 'avatar', value: '🐧', rarity: 'common', unlock: { type: 'level', level: 7 } },
  { id: 'fox', type: 'avatar', value: '🦊', rarity: 'rare', unlock: { type: 'level', level: 10 } },
  { id: 'wolf', type: 'avatar', value: '🐺', rarity: 'rare', unlock: { type: 'level', level: 15 } },
  { id: 'owl', type: 'avatar', value: '🦉', rarity: 'rare', unlock: { type: 'achievement', achievement: 'wheel_streak_7' } },
  { id: 'lion', type: 'avatar', value: '🦁', rarity: 'epic', unlock: { type: 'level', level: 25 } },
  { id: 'tiger', type: 'avatar', value: '🐯', rarity: 'epic', unlock: { type: 'achievement', achievement: 'ten_wins' } },
  { id: 'octopus', type: 'avatar', value: '🐙', rarity: 'epic', unlock: { type: 'achievement', achievement: 'score_500' } },
  { id: 'dragon', type: 'avatar', value: '🐲', rarity: 'legendary', unlock: { type: 'level', level: 50 } },
  { id: 'unicorn', type: 'avatar', value: '🦄', rarity: 'legendary', unlock: { type: 'achievement', achievement: 'hundred_wins' } },
  { id: 'phoenix', type: 'avatar', value: '🔥', rarity: 'mythic', unlock: { type: 'level', level: 100 } },
];

const BACKGROUND_UNLOCKS = [
  { id: 'default_purple', type: 'background', label: 'Purple', rarity: 'common', unlock: { type: 'level', level: 1 } },
  { id: 'blue', type: 'background', label: 'Blue', rarity: 'common', unlock: { type: 'level', level: 3 } },
  { id: 'green', type: 'background', label: 'Green', rarity: 'common', unlock: { type: 'level', level: 5 } },
  { id: 'gold', type: 'background', label: 'Gold', rarity: 'rare', unlock: { type: 'level', level: 10 } },
  { id: 'galaxy', type: 'background', label: 'Galaxy', rarity: 'epic', unlock: { type: 'level', level: 25 } },
  { id: 'fire', type: 'background', label: 'Fire', rarity: 'epic', unlock: { type: 'achievement', achievement: 'fifty_wins' } },
  { id: 'rainbow_animated', type: 'background', label: 'Rainbow', rarity: 'mythic', unlock: { type: 'level', level: 100 } },
];

const FRAME_UNLOCKS = [
  { id: 'basic', type: 'frame', label: 'Basic', rarity: 'common', unlock: { type: 'level', level: 1 } },
  { id: 'purple', type: 'frame', label: 'Purple', rarity: 'common', unlock: { type: 'level', level: 5 } },
  { id: 'gold', type: 'frame', label: 'Gold', rarity: 'rare', unlock: { type: 'achievement', achievement: 'first_win' } },
  { id: 'neon', type: 'frame', label: 'Neon', rarity: 'epic', unlock: { type: 'level', level: 25 } },
  { id: 'crown', type: 'frame', label: 'Crown', rarity: 'legendary', unlock: { type: 'achievement', achievement: 'hundred_wins' } },
  { id: 'rainbow', type: 'frame', label: 'Rainbow', rarity: 'mythic', unlock: { type: 'level', level: 100 } },
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
    wheelSpinStreak: user.wheel_spin_streak || 0,
    bestWheelSpinStreak: user.best_wheel_spin_streak || 0,
    totalWheelSpins: user.total_wheel_spins || 0,
    starsBought: user.stars_bought || 0,
  };
}

function getUnlockedAchievementIds(user) {
  const stats = buildStats(user);
  return new Set(ACHIEVEMENTS.filter(a => a.check(stats)).map(a => a.id));
}

function buildAchievements(user, lang = 'en') {
  const stats = buildStats(user);
  return ACHIEVEMENTS.map(a => ({ id: a.id, icon: a.icon, tier: a.tier, xp: a.xp, unlocked: a.check(stats), title: localize(a.title, lang), description: localize(a.description, lang) }));
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
  const decorate = item => ({ ...item, unlocked: isItemUnlocked(item, user, achievementIds), unlockText: unlockText(item, lang) });
  return { avatars: AVATAR_UNLOCKS.map(decorate), backgrounds: BACKGROUND_UNLOCKS.map(decorate), frames: FRAME_UNLOCKS.map(decorate) };
}

function canUseProfileItem(user, type, valueOrId) {
  const collection = buildCollection(user, 'en');
  const list = type === 'avatar' ? collection.avatars : type === 'background' ? collection.backgrounds : collection.frames;
  return list.some(item => item.unlocked && (item.value === valueOrId || item.id === valueOrId));
}

module.exports = { ACHIEVEMENTS, buildAchievements, buildCollection, canUseProfileItem };
