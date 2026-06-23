// backend/src/db/profile.js
const queries = require('./queries');
const { db, getUserByTelegramId, getUserById } = queries;
const { calculateLevel, normalizeDailyLogin, XP_REWARDS } = require('../game/levelSystem');

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}

function addColumn(table, column, definition) {
  if (!hasColumn(table, column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

// Backward-compatible profile schema migration.
addColumn('users', 'xp', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'level', 'INTEGER NOT NULL DEFAULT 1');
addColumn('users', 'nickname', 'TEXT');
addColumn('users', 'selected_avatar', "TEXT NOT NULL DEFAULT '🐢'");
addColumn('users', 'selected_background', "TEXT NOT NULL DEFAULT 'default_purple'");
addColumn('users', 'selected_frame', "TEXT NOT NULL DEFAULT 'basic'");
addColumn('users', 'selected_title', 'TEXT');
addColumn('users', 'login_streak', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'best_login_streak', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'last_login_date', 'TEXT');
addColumn('users', 'current_win_streak', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'best_win_streak', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'friends_invited', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'stars_bought', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'stars_spent', 'INTEGER NOT NULL DEFAULT 0');

const profilePlayerSelect = `
    gp.*,
    u.telegram_id,
    u.username,
    COALESCE(u.nickname, u.first_name) AS first_name,
    COALESCE(u.nickname, u.first_name) AS display_name,
    u.first_name AS original_first_name,
    u.nickname,
    u.level,
    u.selected_avatar AS avatar,
    u.selected_avatar,
    u.selected_background AS background,
    u.selected_background,
    u.selected_frame AS frame,
    u.selected_frame,
    u.selected_title AS title,
    u.selected_title
`;

// Now that profile columns exist, replace game-player queries with profile-aware versions.
queries.getGamePlayers = db.prepare(`
  SELECT ${profilePlayerSelect}
  FROM game_players gp
  JOIN users u ON u.id = gp.user_id
  WHERE gp.game_id = ?
  ORDER BY gp.seat_order ASC
`);

queries.getActivePlayers = db.prepare(`
  SELECT ${profilePlayerSelect}
  FROM game_players gp
  JOIN users u ON u.id = gp.user_id
  WHERE gp.game_id = ? AND gp.status = 'active'
  ORDER BY gp.seat_order ASC
`);

// XP ledger. This is intentionally separate from balance transactions.
db.exec(`
  CREATE TABLE IF NOT EXISTS xp_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    meta_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_xp_events_user_id ON xp_events(user_id);

  CREATE TRIGGER IF NOT EXISTS trg_game_finished_participation_xp
  AFTER UPDATE OF status ON games
  WHEN NEW.status = 'finished' AND OLD.status <> 'finished'
  BEGIN
    INSERT INTO xp_events (user_id, amount, reason, meta_json)
    SELECT gp.user_id, ${XP_REWARDS.GAME_PARTICIPATION}, 'game_participation', NULL
    FROM game_players gp
    WHERE gp.game_id = NEW.id;

    UPDATE users
    SET xp = xp + ${XP_REWARDS.GAME_PARTICIPATION}, updated_at = CURRENT_TIMESTAMP
    WHERE id IN (SELECT user_id FROM game_players WHERE game_id = NEW.id);

    INSERT INTO xp_events (user_id, amount, reason, meta_json)
    SELECT NEW.winner_user_id, ${XP_REWARDS.GAME_WIN}, 'game_win', NULL
    WHERE NEW.winner_user_id IS NOT NULL;

    UPDATE users
    SET xp = xp + ${XP_REWARDS.GAME_WIN}, updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.winner_user_id AND NEW.winner_user_id IS NOT NULL;
  END;
`);

const insertXpEvent = db.prepare(`
  INSERT INTO xp_events (user_id, amount, reason, meta_json)
  VALUES (@user_id, @amount, @reason, @meta_json)
`);

const updateUserXp = db.prepare(`
  UPDATE users
  SET xp = xp + @amount,
      level = @level,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = @user_id
`);

function awardXp(userId, amount, reason, meta = {}) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  if (!userId || n <= 0) return null;

  const user = getUserById.get(userId);
  if (!user) return null;

  const nextXp = (Number(user.xp) || 0) + n;
  const progress = calculateLevel(nextXp);

  insertXpEvent.run({
    user_id: userId,
    amount: n,
    reason,
    meta_json: JSON.stringify(meta || {}),
  });
  updateUserXp.run({ user_id: userId, amount: n, level: progress.level });

  return { amount: n, reason, totalXp: nextXp, ...progress };
}

function awardDailyLogin(userId) {
  const user = getUserById.get(userId);
  if (!user) return null;

  const login = normalizeDailyLogin(user.last_login_date, user.login_streak);
  if (!login.shouldAward) return { awarded: false, streak: login.streak };

  const streakBonus = Math.min(100, login.streak * XP_REWARDS.DAILY_STREAK_BONUS_PER_DAY);
  const total = XP_REWARDS.DAILY_LOGIN + streakBonus;

  db.prepare(`
    UPDATE users
    SET login_streak = @streak,
        best_login_streak = MAX(best_login_streak, @streak),
        last_login_date = @today,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @user_id
  `).run({ user_id: userId, streak: login.streak, today: login.today });

  const result = awardXp(userId, total, 'daily_login', { streak: login.streak, streakBonus });
  return { awarded: true, streak: login.streak, xp: result };
}

function recordStarPurchase(userId, stars = 0) {
  const count = Math.max(0, Math.floor(Number(stars) || 0));
  if (!userId || count <= 0) return null;
  db.prepare(`
    UPDATE users
    SET stars_bought = stars_bought + ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(count, userId);
  return awardXp(userId, count * XP_REWARDS.STAR_PURCHASE_PER_STAR, 'stars_purchase', { stars: count });
}

function recordInviteReward(inviterUserId, redeemerUserId) {
  if (inviterUserId) {
    db.prepare(`UPDATE users SET friends_invited = friends_invited + 1 WHERE id = ?`).run(inviterUserId);
    awardXp(inviterUserId, XP_REWARDS.INVITE_FRIEND, 'invite_friend', { redeemerUserId });
  }
  if (redeemerUserId) {
    awardXp(redeemerUserId, XP_REWARDS.INVITE_REDEEMED, 'invite_redeemed', { inviterUserId });
  }
}

function getProfileByTelegramId(telegramId) {
  const user = getUserByTelegramId.get(String(telegramId));
  if (!user) return null;
  return buildProfile(user);
}

function buildProfile(user) {
  const progress = calculateLevel(user.xp || 0);
  return {
    user: {
      ...user,
      display_name: user.nickname || user.first_name,
      level: progress.level,
    },
    progress,
    stats: {
      games: user.total_games || 0,
      wins: user.total_wins || 0,
      winRate: user.total_games > 0 ? Math.round((user.total_wins / user.total_games) * 100) : 0,
      score: user.score || 0,
      loginStreak: user.login_streak || 0,
      bestLoginStreak: user.best_login_streak || 0,
      currentWinStreak: user.current_win_streak || 0,
      bestWinStreak: user.best_win_streak || 0,
      friendsInvited: user.friends_invited || 0,
      starsBought: user.stars_bought || 0,
      starsSpent: user.stars_spent || 0,
    },
  };
}

function updateProfile(userId, updates = {}) {
  const allowed = {};
  if (typeof updates.nickname === 'string') {
    const nickname = updates.nickname.trim().slice(0, 24);
    allowed.nickname = nickname || null;
  }
  if (typeof updates.selected_avatar === 'string') allowed.selected_avatar = updates.selected_avatar.slice(0, 16);
  if (typeof updates.selected_background === 'string') allowed.selected_background = updates.selected_background.slice(0, 64);
  if (typeof updates.selected_frame === 'string') allowed.selected_frame = updates.selected_frame.slice(0, 64);
  if (typeof updates.selected_title === 'string') allowed.selected_title = updates.selected_title.trim().slice(0, 32) || null;

  const keys = Object.keys(allowed);
  if (!keys.length) return getUserById.get(userId);

  const setClause = keys.map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = @user_id`)
    .run({ ...allowed, user_id: userId });
  return getUserById.get(userId);
}

module.exports = {
  XP_REWARDS,
  awardXp,
  awardDailyLogin,
  recordStarPurchase,
  recordInviteReward,
  getProfileByTelegramId,
  buildProfile,
  updateProfile,
};
