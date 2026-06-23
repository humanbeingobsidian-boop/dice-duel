// backend/src/game/levelSystem.js

const XP_REWARDS = {
  GAME_PARTICIPATION: 10,
  GAME_WIN: 25,
  DAILY_LOGIN: 15,
  DAILY_STREAK_BONUS_PER_DAY: 5,
  INVITE_FRIEND: 100,
  INVITE_REDEEMED: 25,
  STAR_PURCHASE_PER_STAR: 1,
};

function xpRequiredForLevel(level) {
  const n = Math.max(1, Number(level) || 1);
  // Gentle early game, hard long-term grind. Level 100 is intentionally very rare.
  return Math.floor(80 + Math.pow(n, 2.08) * 34);
}

function calculateLevel(totalXp = 0) {
  let xp = Math.max(0, Number(totalXp) || 0);
  let level = 1;
  let needed = xpRequiredForLevel(level);

  while (xp >= needed && level < 1000) {
    xp -= needed;
    level++;
    needed = xpRequiredForLevel(level);
  }

  return {
    level,
    xpIntoLevel: xp,
    xpNeeded: needed,
    xpToNext: Math.max(0, needed - xp),
    progress: needed > 0 ? Math.min(100, Math.round((xp / needed) * 100)) : 0,
  };
}

function normalizeDailyLogin(lastLoginDate, currentStreak) {
  const today = new Date().toISOString().slice(0, 10);
  if (!lastLoginDate) return { shouldAward: true, streak: 1, today };
  if (lastLoginDate === today) return { shouldAward: false, streak: currentStreak || 0, today };

  const last = new Date(`${lastLoginDate}T00:00:00Z`);
  const now = new Date(`${today}T00:00:00Z`);
  const diffDays = Math.round((now - last) / 86400000);
  const nextStreak = diffDays === 1 ? (Number(currentStreak) || 0) + 1 : 1;
  return { shouldAward: true, streak: nextStreak, today };
}

module.exports = {
  XP_REWARDS,
  xpRequiredForLevel,
  calculateLevel,
  normalizeDailyLogin,
};
