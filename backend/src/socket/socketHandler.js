// backend/src/socket/socketHandler.js
const { validateTelegramData } = require('../middleware/telegramAuth');
const {
  upsertUser, upsertUserWithReferral, payReferralBonus, getUserByTelegramId,
  getGameByRoomCode, getGamePlayers, updateGameStatus,
} = require('../db/queries');
const {
  joinGame, leaveWaitingRoom, leaveActiveGame, toggleReady, rollDiceForPlayer,
  handleActiveGameDisconnect, handleReconnect, getRoomSnapshot,
} = require('./roomManager');

module.exports = function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    let authenticatedUser = null;

    socket.on('authenticate', async ({ initData, referralCode }) => {
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

        authenticatedUser = { telegramUser, dbUser };
        socket.emit('authenticated', { user: dbUser });
        console.log(`✅ Authenticated: ${dbUser.first_name} (${dbUser.telegram_id})`);
      } catch (err) {
        console.error('Auth error:', err);
        socket.emit('auth_error', { error: 'Authentication failed' });
      }
    });

    socket.on('join_game', ({ entryFee = 100 } = {}) => {
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
      if (!authenticatedUser || !socket.roomCode) return;
      try {
        toggleReady(authenticatedUser.telegramUser, socket.roomCode, io);
      } catch (err) {
        socket.emit('error', { error: err.message });
      }
    });

    socket.on('leave_game', () => {
      if (!authenticatedUser) return;
      _doLeaveWaiting(socket, authenticatedUser, io);
    });

    socket.on('leave_active_game', () => {
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
      if (!authenticatedUser || !roomCode) return;
      handleReconnect(authenticatedUser.telegramUser, roomCode, io);
      const snapshot = getRoomSnapshot(roomCode, authenticatedUser.dbUser.id);
      if (!snapshot) return socket.emit('error', { error: 'Game not found' });
      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.userId = authenticatedUser.dbUser.id;
      io.to(roomCode).emit('player_reconnected', {
        userId: authenticatedUser.dbUser.id,
        firstName: authenticatedUser.dbUser.first_name,
      });
      socket.emit('game_snapshot', { ...snapshot });
      console.log(`🔄 ${authenticatedUser.dbUser.first_name} reconnected to ${roomCode}`);
    });

    socket.on('find_active_game', () => {
      if (!authenticatedUser) return;
      const { db } = require('../db/queries');
      const row = db.prepare(`
        SELECT g.room_code FROM games g
        JOIN game_players gp ON gp.game_id = g.id
        WHERE g.status = 'active' AND gp.user_id = ? AND gp.status = 'active'
        LIMIT 1
      `).get(authenticatedUser.dbUser.id);

      if (row) {
        const roomCode = row.room_code;
        handleReconnect(authenticatedUser.telegramUser, roomCode, io);
        const snapshot = getRoomSnapshot(roomCode, authenticatedUser.dbUser.id);
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.userId = authenticatedUser.dbUser.id;
        io.to(roomCode).emit('player_reconnected', {
          userId: authenticatedUser.dbUser.id,
          firstName: authenticatedUser.dbUser.first_name,
        });
        socket.emit('active_game_found', { roomCode, snapshot });
      } else {
        socket.emit('no_active_game', {});
      }
    });

    socket.on('roll_dice', () => {
      if (!authenticatedUser) return socket.emit('error', { error: 'Not authenticated' });
      if (!socket.roomCode) return socket.emit('error', { error: 'Not in a game room' });
      try {
        rollDiceForPlayer(socket.roomCode, authenticatedUser.telegramUser.id, io);
        const freshUser = getUserByTelegramId.get(String(authenticatedUser.telegramUser.id));
        socket.emit('balance_updated', { balance: freshUser.balance });
      } catch (err) {
        const msgs = {
          NOT_YOUR_TURN: 'לא התור שלך',
          GAME_NOT_ACTIVE: 'המשחק לא פעיל',
          USER_NOT_FOUND: 'משתמש לא נמצא',
          ROOM_NOT_FOUND: 'חדר לא נמצא',
          NO_ACTIVE_PLAYERS: 'אין שחקנים פעילים',
        };
        socket.emit('roll_error', { error: msgs[err.message] || 'שגיאה בזריקת קובייה' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Disconnected: ${socket.id}`);
      if (!authenticatedUser) return;
      if (socket.roomCode) {
        const leftWaiting = _doLeaveWaiting(socket, authenticatedUser, io);
        if (!leftWaiting) {
          handleActiveGameDisconnect(authenticatedUser.telegramUser, socket.roomCode, io);
        }
      }
    });
  });
};

function joinGameWithStaleRetry(socket, authenticatedUser, io, fee) {
  try {
    return _joinAndAttach(socket, authenticatedUser, io, fee);
  } catch (err) {
    if (err.message !== 'ALREADY_IN_GAME') throw err;
    _doLeaveWaiting(socket, authenticatedUser, io, { silent: true });
    return _joinAndAttach(socket, authenticatedUser, io, fee);
  }
}

function _joinAndAttach(socket, authenticatedUser, io, fee) {
  const result = joinGame(authenticatedUser.telegramUser, io, fee);
  const roomCode = result.game.room_code;
  socket.join(roomCode);
  socket.roomCode = roomCode;
  socket.userId = authenticatedUser.dbUser.id;
  socket.emit('joined_game', {
    game: result.game,
    players: result.players,
    user: result.user,
    roomCode,
    countdownActive: result.countdownActive,
    countdownSecondsLeft: result.countdownSecondsLeft,
  });
  return result;
}

function closeEmptyWaitingRoom(roomCode) {
  const game = getGameByRoomCode.get(roomCode);
  if (!game || game.status !== 'waiting') return;
  const realPlayers = getGamePlayers.all(game.id);
  if (realPlayers.length > 0) return;
  updateGameStatus.run({ status: 'finished', id: game.id });
}

function _doLeaveWaiting(socket, authenticatedUser, io, options = {}) {
  try {
    const result = leaveWaitingRoom(authenticatedUser.telegramUser, io);
    socket.leave(result.roomCode);
    socket.roomCode = null;
    closeEmptyWaitingRoom(result.roomCode);
    const freshUser = getUserByTelegramId.get(String(authenticatedUser.telegramUser.id));
    if (!options.silent) socket.emit('left_game', { balance: freshUser.balance });
    console.log(`👋 ${authenticatedUser.dbUser.first_name} left waiting room ${result.roomCode}, balance: ${freshUser.balance}`);
    return true;
  } catch (err) {
    if (err.message !== 'NOT_IN_WAITING_ROOM') {
      console.error('Leave error:', err.message);
    }
    return false;
  }
}
