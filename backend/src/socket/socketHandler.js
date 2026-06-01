// backend/src/socket/socketHandler.js
const { validateTelegramData } = require('../middleware/telegramAuth');
const { upsertUser, getUserByTelegramId } = require('../db/queries');
const {
  joinGame, leaveWaitingRoom, rollDiceForPlayer,
  handleActiveGameDisconnect, handleReconnect, getRoomSnapshot,
} = require('./roomManager');

module.exports = function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    let authenticatedUser = null;

    // ─── Auth ──────────────────────────────────────────────────────────────
    socket.on('authenticate', async ({ initData }) => {
      try {
        let telegramUser;
        if (process.env.DEV_MODE === 'true') {
          const mockId = initData?.replace?.('mock_', '') || '12345';
          telegramUser = { id: parseInt(mockId) || 12345, first_name: `Player${mockId}`, username: `player${mockId}` };
        } else {
          telegramUser = validateTelegramData(initData);
          if (!telegramUser) return socket.emit('auth_error', { error: 'Invalid Telegram data' });
        }

        const dbUser = upsertUser({
          telegram_id: String(telegramUser.id),
          username: telegramUser.username || null,
          first_name: telegramUser.first_name || 'Player',
        });

        authenticatedUser = { telegramUser, dbUser };
        socket.emit('authenticated', { user: dbUser });
        console.log(`✅ Authenticated: ${dbUser.first_name} (${dbUser.telegram_id})`);
      } catch (err) {
        console.error('Auth error:', err);
        socket.emit('auth_error', { error: 'Authentication failed' });
      }
    });

    // ─── Join Game ─────────────────────────────────────────────────────────
    socket.on('join_game', () => {
      if (!authenticatedUser) return socket.emit('error', { error: 'Not authenticated' });
      try {
        const result = joinGame(authenticatedUser.telegramUser, io);
        const roomCode = result.game.room_code;
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.userId = authenticatedUser.dbUser.id;
        socket.emit('joined_game', {
          game: result.game, players: result.players, user: result.user, roomCode,
          countdownActive: result.countdownActive,
          countdownSecondsLeft: result.countdownSecondsLeft,
        });
        console.log(`👤 ${authenticatedUser.dbUser.first_name} joined room ${roomCode}`);
      } catch (err) {
        const msgs = {
          INSUFFICIENT_BALANCE: 'אין מספיק קרדיטים (צריך 100)',
          ALREADY_IN_GAME: 'אתה כבר בחדר זה',
          USER_NOT_FOUND: 'משתמש לא נמצא',
        };
        socket.emit('join_error', { error: msgs[err.message] || 'שגיאה בהצטרפות' });
      }
    });

    // ─── Leave Waiting Room (FIX #4 & #5: explicit leave, free, no cost) ──
    socket.on('leave_game', () => {
      if (!authenticatedUser) return;
      _doLeaveWaiting(socket, authenticatedUser, io);
    });

    // ─── Reconnect to active game ───────────────────────────────────────────
    socket.on('reconnect_game', ({ roomCode }) => {
      if (!authenticatedUser || !roomCode) return;

      // FIX #1: cancel abandon timer AND resume turn timer
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

    // ─── Auto-reconnect: find active game for this user on authenticate ────
    socket.on('find_active_game', () => {
      if (!authenticatedUser) return;
      const { db } = require('../db/queries');
      // Find any active game this user is still an active player in
      const row = db.prepare(`
        SELECT g.room_code FROM games g
        JOIN game_players gp ON gp.game_id = g.id
        WHERE g.status = 'active' AND gp.user_id = ? AND gp.status = 'active'
        LIMIT 1
      `).get(authenticatedUser.dbUser.id);

      if (row) {
        // They have an active game — auto-reconnect them
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

    // ─── Roll Dice ─────────────────────────────────────────────────────────
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

    // ─── Disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔌 Disconnected: ${socket.id}`);
      if (!authenticatedUser) return;

      if (socket.roomCode) {
        // Try to leave waiting room first (FIX #5: auto-leave lobby on close)
        const leftWaiting = _doLeaveWaiting(socket, authenticatedUser, io);

        // If not in waiting room, must be in active game → start 10s timer (FIX #6)
        if (!leftWaiting) {
          handleActiveGameDisconnect(authenticatedUser.telegramUser, socket.roomCode, io);
        }
      }
    });
  });
};

// ─── Leave waiting room helper — returns true if succeeded ───────────────────
function _doLeaveWaiting(socket, authenticatedUser, io) {
  try {
    const result = leaveWaitingRoom(authenticatedUser.telegramUser, io);
    socket.leave(result.roomCode);
    socket.roomCode = null;
    socket.emit('left_game', { refunded: result.refunded });
    console.log(`👋 ${authenticatedUser.dbUser.first_name} left waiting room ${result.roomCode}`);
    return true;
  } catch (err) {
    if (err.message !== 'NOT_IN_WAITING_ROOM') {
      console.error('Leave error:', err.message);
    }
    return false;
  }
}
