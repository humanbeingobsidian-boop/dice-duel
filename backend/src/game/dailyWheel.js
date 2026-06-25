// backend/src/game/dailyWheel.js
const { db, getUserById, getUserByTelegramId, addBalance } = require('../db/queries');
const { awardXp } = require('../db/profile');

// Order is visual as well as weighted. Gifts are intentionally scattered around the wheel.
const WHEEL_SEGMENTS = [
  { id: 'xp_5', type: 'xp', amount: 5, label: '5 XP', emoji: '✨', weight: 32 },
  { id: 'gift_teddy', type: 'gift', giftType: 'teddy', label: 'Teddy Gift', emoji: '🧸', weight: 2, dailyLimit: 2, enabled: true },
  { id: 'credits_10', type: 'credits', amount: 10, label: '10 Credits', emoji: '💰', weight: 8 },
  { id: 'xp_20', type: 'xp', amount: 20, label: '20 XP', emoji: '🌟', weight: 12 },
  { id: 'gift_diamond', type: 'gift', giftType: 'diamond', label: 'Diamond Gift', emoji: '💎', weight: 0.6, dailyLimit: 0, enabled: false },
  { id: 'credits_5', type: 'credits', amount: 5, label: '5 Credits', emoji: '🪙', weight: 13 },
  { id: 'xp_10', type: 'xp', amount: 10, label: '10 XP', emoji: '⭐', weight: 22 },
  { id: 'gift_flowers', type: 'gift', giftType: 'flowers', label: 'Flowers Gift', emoji: '💐', weight: 1.4, dailyLimit: 0, enabled: false },
  { id: 'credits_20', type: 'credits', amount: 20, label: '20 Credits', emoji: '💎', weight: 5 },
  { id: 'bonus_spin', type: 'bonus_spin', amount: 1, label: 'Bonus Spin', emoji: '🎲', weight: 4 },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function nextMidnightIso() {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

function secondsUntilNextSpin(state) {
  if (state.canSpin) return 0;
  return Math.max(0, Math.ceil((new Date(state.nextSpinAt).getTime() - Date.now()) / 1000));
}

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}

function addColumn(table, column, definition) {
  if (!hasColumn(table, column)) db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

function initWheelSchema() {
  addColumn('users', 'wheel_spin_streak', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('users', 'best_wheel_spin_streak', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('users', 'last_wheel_spin_date', 'TEXT');
  addColumn('users', 'total_wheel_spins', 'INTEGER NOT NULL DEFAULT 0');

  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_wheel_spins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      spin_date TEXT NOT NULL,
      is_bonus INTEGER NOT NULL DEFAULT 0,
      prize_id TEXT NOT NULL,
      prize_type TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      gift_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_daily_wheel_spins_user_date ON daily_wheel_spins(user_id, spin_date);

    CREATE TABLE IF NOT EXISTS daily_wheel_gift_wins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      telegram_id TEXT NOT NULL,
      username TEXT,
      first_name TEXT,
      gift_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME,
      admin_note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_daily_wheel_gifts_date ON daily_wheel_gift_wins(created_at);
  `);
}

initWheelSchema();

function getWheelState(userId) {
  const day = todayKey();
  const spins = db.prepare(`SELECT * FROM daily_wheel_spins WHERE user_id = ? AND spin_date = ? ORDER BY id ASC`).all(userId, day);
  const mainSpin = spins.find(s => !s.is_bonus);
  const bonusAwarded = spins.some(s => s.prize_id === 'bonus_spin');
  const bonusUsed = spins.some(s => s.is_bonus);
  const canSpin = !mainSpin || (bonusAwarded && !bonusUsed);
  const user = getUserById.get(userId);
  return {
    canSpin,
    canBonusSpin: Boolean(bonusAwarded && !bonusUsed),
    hasSpunToday: Boolean(mainSpin),
    bonusAwarded,
    bonusUsed,
    nextSpinAt: canSpin ? null : nextMidnightIso(),
    secondsUntilNext: 0,
    spinsToday: spins,
    wheelSpinStreak: user?.wheel_spin_streak || 0,
    bestWheelSpinStreak: user?.best_wheel_spin_streak || 0,
    totalWheelSpins: user?.total_wheel_spins || 0,
  };
}

function publicState(userId) {
  const state = getWheelState(userId);
  return { ...state, secondsUntilNext: secondsUntilNextSpin(state), segments: publicSegments() };
}

function publicSegments() {
  return WHEEL_SEGMENTS.map(({ id, type, amount, giftType, label, emoji }) => ({ id, type, amount, giftType, label, emoji }));
}

function weightedPick(segments) {
  const total = segments.reduce((sum, s) => sum + Number(s.weight || 0), 0);
  let r = Math.random() * total;
  for (const segment of segments) {
    r -= Number(segment.weight || 0);
    if (r <= 0) return segment;
  }
  return segments[0];
}

function giftCountToday(giftType) {
  const day = todayKey();
  return db.prepare(`
    SELECT COUNT(*) AS count
    FROM daily_wheel_gift_wins
    WHERE gift_type = ? AND date(created_at) = date(?)
  `).get(giftType, day).count || 0;
}

function isGiftAvailable(segment) {
  if (segment.type !== 'gift') return true;
  if (!segment.enabled) return false;
  if ((segment.dailyLimit || 0) <= 0) return false;
  return giftCountToday(segment.giftType) < segment.dailyLimit;
}

function pickPrize({ allowBonusSpin }) {
  for (let attempt = 0; attempt < 25; attempt++) {
    const prize = weightedPick(WHEEL_SEGMENTS);
    if (prize.type === 'bonus_spin' && !allowBonusSpin) continue;
    if (prize.type === 'gift' && !isGiftAvailable(prize)) continue;
    return prize;
  }
  return weightedPick(WHEEL_SEGMENTS.filter(s => s.type === 'xp' || s.type === 'credits'));
}

function updateWheelStats(userId, isBonus) {
  if (isBonus) {
    db.prepare(`UPDATE users SET total_wheel_spins = total_wheel_spins + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(userId);
    return;
  }

  const user = getUserById.get(userId);
  const today = todayKey();
  const yesterday = yesterdayKey();
  let nextStreak = 1;
  if (user?.last_wheel_spin_date === today) nextStreak = user.wheel_spin_streak || 1;
  else if (user?.last_wheel_spin_date === yesterday) nextStreak = (user.wheel_spin_streak || 0) + 1;

  db.prepare(`
    UPDATE users
    SET wheel_spin_streak = @streak,
        best_wheel_spin_streak = MAX(best_wheel_spin_streak, @streak),
        last_wheel_spin_date = @today,
        total_wheel_spins = total_wheel_spins + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @user_id
  `).run({ user_id: userId, streak: nextStreak, today });
}

function normalizeSpinResult(row, prize, state, updatedUser, xpResult = null, giftWin = null) {
  return {
    spin: row,
    prize: {
      id: prize.id,
      type: prize.type,
      amount: prize.amount || 0,
      giftType: prize.giftType || null,
      label: prize.label,
      emoji: prize.emoji,
    },
    balance: updatedUser?.balance,
    xp: updatedUser?.xp,
    level: updatedUser?.level,
    xpResult,
    giftWin,
    state: { ...state, secondsUntilNext: secondsUntilNextSpin(state), segments: publicSegments() },
  };
}

function spinWheel(telegramId) {
  const user = getUserByTelegramId.get(String(telegramId));
  if (!user) throw new Error('USER_NOT_FOUND');

  const beforeState = getWheelState(user.id);
  if (!beforeState.canSpin) throw new Error('ALREADY_SPUN');

  const isBonus = beforeState.hasSpunToday && beforeState.bonusAwarded && !beforeState.bonusUsed;
  const prize = pickPrize({ allowBonusSpin: !beforeState.bonusAwarded && !isBonus });
  const day = todayKey();

  const row = db.prepare(`
    INSERT INTO daily_wheel_spins (user_id, spin_date, is_bonus, prize_id, prize_type, amount, gift_type)
    VALUES (@user_id, @spin_date, @is_bonus, @prize_id, @prize_type, @amount, @gift_type)
    RETURNING *
  `).get({
    user_id: user.id,
    spin_date: day,
    is_bonus: isBonus ? 1 : 0,
    prize_id: prize.id,
    prize_type: prize.type,
    amount: prize.amount || 0,
    gift_type: prize.giftType || null,
  });

  updateWheelStats(user.id, isBonus);

  let xpResult = null;
  let giftWin = null;

  if (prize.type === 'xp') {
    xpResult = awardXp(user.id, prize.amount, 'daily_wheel', { prizeId: prize.id, isBonus });
  } else if (prize.type === 'credits') {
    addBalance.run(prize.amount, user.id);
  } else if (prize.type === 'gift') {
    giftWin = db.prepare(`
      INSERT INTO daily_wheel_gift_wins (user_id, telegram_id, username, first_name, gift_type)
      VALUES (@user_id, @telegram_id, @username, @first_name, @gift_type)
      RETURNING *
    `).get({
      user_id: user.id,
      telegram_id: user.telegram_id,
      username: user.username || null,
      first_name: user.nickname || user.first_name,
      gift_type: prize.giftType,
    });
  }

  const updatedUser = getUserById.get(user.id);
  const afterState = getWheelState(user.id);
  return normalizeSpinResult(row, prize, afterState, updatedUser, xpResult, giftWin);
}

async function notifyGiftWin(giftWin, user, prize) {
  if (!giftWin || !user || !prize) return;
  const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;
  const username = user.username ? `@${user.username}` : `ID: ${user.telegram_id}`;
  const text =
    `🎡 *Daily Wheel Gift Win!*\n\n` +
    `👤 User: ${user.nickname || user.first_name} (${username})\n` +
    `🎁 Gift: ${prize.emoji} ${prize.label}\n` +
    `🆔 Gift Win ID: ${giftWin.id}\n` +
    `📅 Time: ${new Date().toLocaleString('he-IL')}`;

  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (BOT_TOKEN && ADMIN_TELEGRAM_ID) {
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: ADMIN_TELEGRAM_ID, text, parse_mode: 'Markdown' }),
      });
    } catch (err) {
      console.error('Wheel admin notify error:', err.message);
    }
  }

  const USERBOT_URL = process.env.USERBOT_URL || 'http://localhost:3002';
  const USERBOT_SECRET = process.env.USERBOT_SECRET || 'userbot_secret';
  try {
    await fetch(`${USERBOT_URL}/send-prize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Userbot-Secret': USERBOT_SECRET },
      body: JSON.stringify({
        user_id: user.telegram_id,
        prize_label: `Daily Wheel ${prize.label}`,
        order_id: `wheel_${giftWin.id}`,
      }),
    });
  } catch (err) {
    console.error('Wheel userbot notify error:', err.message);
  }
}

function getPrizeById(id) {
  return WHEEL_SEGMENTS.find(s => s.id === id);
}

module.exports = {
  WHEEL_SEGMENTS,
  publicSegments,
  publicState,
  spinWheel,
  notifyGiftWin,
  getPrizeById,
};
