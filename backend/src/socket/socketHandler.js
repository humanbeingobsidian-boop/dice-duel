// backend/src/socket/socketHandler.js
const { validateTelegramData } = require('../middleware/telegramAuth');
const {
  db, upsertUser, upsertUserWithReferral, payReferralBonus, getUserByTelegramId,
  getGameByRoomCode, getGamePlayers, updateGameStatus,
} = require('../db/queries');
const { awardDailyLogin, recordInviteReward } = require('../db/profile');
const {
  joinGame, leaveWaitingRoom, leaveActiveGame, toggleReady, rollDiceForPlayer,
  handleActiveGameDisconnect, handleReconnect, getRoomSnapshot,
} = require('./roomManager');

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}

function ensureLanguageColumn() {
  if (!hasColumn('users', 'ui_lang')) {
    db.prepare("ALTER TABLE users ADD COLUMN ui_lang TEXT NOT NULL DEFAULT 'he'").run();
  }
}

function normalizeLang(lang) {
  return ['he', 'en', 'ru'].includes(lang) ? lang : null;
}

module.exports = function setupSocket(io) {
  ensureLanguageColumn();

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    let authenticatedUser = null;
    const actionLocks = new Map();

    function blocked(action, ms = 700) {
      const now = Date.now();
      const last = actionLocks.get(action) || 0;
      if (now - last < ms) return true;
      actionLocks.set(action, now);
      return false;
    }

    socket.on('authenticate', async ({ initData, referralCode, lang } = {}) => {
      if (blocked('authenticate', 400)) return;
      try {
        let telegramUser;
        if (process.env.DEV_MODE === 'true') {
          const mockId = initData?.replace?.('mock_', '') || '12345';
          telegramUser = { id: parseInt(mockId) || 12345, first_name: `Player${mockId}`, username: `player${mockId}` };
        } else {
          telegramUser = validateTelegramData(initData);
          if (!telegramUser) return socket.emit('auth_error', { error: 'Invalid Telegram data' });
        }

        const isNewUser = !getUserByTelegramId.get(String(telegramUser.id));
        let dbUser;
        if (isNewUser && referralCode && referralCode !== String(telegramUser.id)) {
          dbUser = upsertUserWithReferral({
            telegram_id: String(telegramUser.id),
            username: telegramUser.username || null,
            first_name: telegramUser.first_name || 'Player',
            referred_by: referralCode,
          });
          const referrer = payReferralBonus(dbUser.id, referralCode);
          if (referrer) {
            recordInviteReward(referrer.id, dbUser.id);
            console.log(`🎁 Referral bonus: +5 credits to ${referrer.first_name} for inviting ${dbUser.first_name}`);
            io.emit(`referral_bonus_${referralCode}`, {
              newUser: dbUser.first_name,
              bonus: 5,
              newBalance: referrer.balance,
            });
          }
        } else {
          dbUser = upsertUser({
            telegram_id: String(telegramUser.id),
            username: telegramUser.username || null,
            first_name: telegramUser.first_name || 'Player',
          });
        }

        const uiLang = normalizeLang(lang) || normalizeLang(telegramUser.language_code) || 'he';
        db.prepare(`UPDATE users SET ui_lang = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(uiLang, dbUser.id);

        const daily = awardDailyLogin(dbUser.id);
        dbUser = getUserByTelegramId.get(String(telegramUser.id));
        authenticatedUser = { telegramUser, dbUser };
        socket.emit('authenticated', { user: dbUser, daily });
        console.log(`✅ Authenticated: ${dbUser.first_name} (${dbUser.telegram_id}) lang:${uiLang}`);
      } catch (err) {
        console.error('Auth error:', err);
        socket.emit('auth_error', { error: 'Authentication failed' });
      }
    });

    socket.on('join_game', ({ entryFee = 100 } = {}) => {
      if (blocked('join_game', 1200)) return;
      if (!authenticatedUser) return socket.emit('error', { error: 'Not authenticated' });
      const fee = [5, 100].includes(Number(entryFee)) ? Number(entryFee) : 100;
      try {
        const result = joinGameWithStaleRetry(socket, authenticatedUser, io, fee);
        console.log(`👤 ${authenticatedUser.dbUser.first_name} joined room ${result.game.room_code} (fee:${fee})`);
      } catch (err) {
        socket.emit('join_error', { code: err.message, requiredFee: fee });
      }
    });

    socket.on('toggle_ready', () => {
      if (blocked('toggle_ready', 800)) return;
      if (!authenticatedUser || !socket.roomCode) return;
      try {
        toggleReady(authenticatedUser.telegramUser, socket.roomCode, io);
      } catch (err) {
        socket.emit('error', { error: err.message });
      }
    });

    socket.on('leave_game', () => {
      if (blocked('leave_game', 1200)) return;
      if (!authenticatedUser) return;
      _doLeaveWaiting(socket, authenticatedUser, io);
    });

    socket.on('leave_active_game', () => {
      if (blocked('leave_active_game', 1200)) return;
      if (!authenticatedUser || !socket.roomCode) return;
      try {
        const result = leaveActiveGame(authenticatedUser.telegramUser, socket.roomCode);
        socket.leave(result.roomCode);
        socket.roomCode = null;
        socket.emit('left_active_game', {});
        console.log(`🚪 ${authenticatedUser.dbUser.first_name} left active game after elimination`);
      } catch (err) {
        const msgs = {
          NOT_ELIMINATED: 'אפשר לצאת רק אחרי הדחה',
          GAME_NOT_ACTIVE: 'המשחק לא פעיל',
          NOT_IN_GAME: 'אתה לא במשחק',
          USER_NOT_FOUND: 'משתמש לא נמצא',
        };
        socket.emit('leave_active_error', { error: msgs[err.message] || 'שגיאה ביציאה מהמשחק' });
      }
    });

    socket.on('reconnect_game', ({ roomCode }) => {
      if (blocked('reconnect_game', 1000)) return;
      if (!authenticatedUser || !roomCode) return;
      handleReconnect(authenticatedUser.telegramUser, roomCode, io);
      const snapshot = getRoomSnapshot(roomCode, authenticatedUser.dbUser.id);
      if (!snapshot) return socket.emit('error', { error: 'Game not found' });
      socket.roomCode = roomCode;
      socket.join(roomCode);
      socket.emit('game_snapshot', snapshot);
    });

    socket.on('find_active_game', () => {
      if (blocked('find_active_game', 1000)) return;
      if (!authenticatedUser) return;
      const rooms = require('./roomManager').getRooms?.() || new Map();
      for (const [roomCode] of rooms) {
        const snapshot = getRoomSnapshot(roomCode, authenticatedUser.dbUser.id);
        if (snapshot) {
          socket.roomCode = roomCode;
          socket.join(roomCode);
          return socket.emit('active_game_found', { snapshot });
        }
      }
      socket.emit('no_active_game', {});
    });

    socket.on('roll_dice', () => {
      if (blocked('roll_dice', 900)) return;
      if (!authenticatedUser || !socket.roomCode) return;
      rollDiceForPlayer(authenticatedUser.telegramUser, socket.roomCode, io, socket);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
      if (authenticatedUser && socket.roomCode) {
        handleActiveGameDisconnect(authenticatedUser.telegramUser, socket.roomCode, io);
      }
    });
  });
};

function joinGameWithStaleRetry(socket, authenticatedUser, io, fee) {
  try {
    return joinGame(authenticatedUser.telegramUser, io, socket, fee);
  } catch (err) {
    if (err.message !== 'ALREADY_IN_GAME') throw err;
    const staleRows = db.prepare(`
      SELECT gp.game_id, g.room_code, g.entry_fee
      FROM game_players gp
      JOIN games g ON g.id = gp.game_id
      WHERE gp.user_id = ? AND g.status = 'waiting'
    `).all(authenticatedUser.dbUser.id);
    for (const row of staleRows) {
      try { leaveWaitingRoom(authenticatedUser.telegramUser, row.room_code, io); } catch {}
    }
    return joinGame(authenticatedUser.telegramUser, io, socket, fee);
  }
}

function _doLeaveWaiting(socket, authenticatedUser, io) {
  if (!socket.roomCode) return;
  try {
    const result = leaveWaitingRoom(authenticatedUser.telegramUser, socket.roomCode, io);
    socket.leave(result.roomCode);
    socket.roomCode = null;
    socket.emit('left_game', { balance: result.balance });
  } catch (err) {
    socket.emit('error', { error: err.message });
  }
}
