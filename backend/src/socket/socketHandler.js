// backend/src/socket/socketHandler.js
const { validateTelegramData } = require('../middleware/telegramAuth');
const { upsertUser, getUserByTelegramId } = require('../db/queries');
const { joinGame, rollDiceForPlayer, getRoomSnapshot } = require('./roomManager');

module.exports = function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    let authenticatedUser = null; // { telegramUser, dbUser }

    // ─── Auth ──────────────────────────────────────────────────────────────
    socket.on('authenticate', async ({ initData }) => {
      try {
        let telegramUser;

        if (process.env.DEV_MODE === 'true') {
          // Dev mode: initData is mock_<id>
          const mockId = initData?.replace?.('mock_', '') || '12345';
          telegramUser = {
            id: parseInt(mockId) || 12345,
            first_name: `Player${mockId}`,
            username: `player${mockId}`,
          };
        } else {
          telegramUser = validateTelegramData(initData);
          if (!telegramUser) {
            return socket.emit('auth_error', { error: 'Invalid Telegram data' });
          }
        }

        // Upsert user in DB
        const dbUser = upsertUser.get({
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
      if (!authenticatedUser) {
        return socket.emit('error', { error: 'Not authenticated' });
      }

      try {
        const result = joinGame(authenticatedUser.telegramUser, io);
        const roomCode = result.game.room_code;

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.userId = authenticatedUser.dbUser.id;

        socket.emit('joined_game', {
          game: result.game,
          players: result.players,
          user: result.user,
          roomCode,
        });

        console.log(`👤 ${authenticatedUser.dbUser.first_name} joined room ${roomCode}`);
      } catch (err) {
        const knownErrors = {
          INSUFFICIENT_BALANCE: 'Not enough credits to join (need 100)',
          ALREADY_IN_GAME: 'You are already in this game',
          USER_NOT_FOUND: 'User not found, please re-authenticate',
        };
        socket.emit('join_error', {
          error: knownErrors[err.message] || 'Failed to join game',
        });
      }
    });

    // ─── Reconnect ─────────────────────────────────────────────────────────
    socket.on('reconnect_game', ({ roomCode }) => {
      if (!authenticatedUser || !roomCode) return;

      const snapshot = getRoomSnapshot(roomCode);
      if (!snapshot) {
        return socket.emit('error', { error: 'Game not found' });
      }

      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.userId = authenticatedUser.dbUser.id;

      socket.emit('game_snapshot', snapshot);
    });

    // ─── Roll Dice ─────────────────────────────────────────────────────────
    socket.on('roll_dice', () => {
      if (!authenticatedUser) {
        return socket.emit('error', { error: 'Not authenticated' });
      }
      if (!socket.roomCode) {
        return socket.emit('error', { error: 'Not in a game room' });
      }

      try {
        const result = rollDiceForPlayer(
          socket.roomCode,
          authenticatedUser.telegramUser.id,
          io
        );

        // Refresh user balance for the roller
        const freshUser = getUserByTelegramId.get(
          String(authenticatedUser.telegramUser.id)
        );
        socket.emit('balance_updated', { balance: freshUser.balance });
      } catch (err) {
        const knownErrors = {
          NOT_YOUR_TURN: 'It is not your turn',
          GAME_NOT_ACTIVE: 'The game is not active',
          USER_NOT_FOUND: 'User not found',
          ROOM_NOT_FOUND: 'Room not found',
          NO_ACTIVE_PLAYERS: 'No active players',
        };
        socket.emit('roll_error', {
          error: knownErrors[err.message] || 'Failed to roll dice',
        });
      }
    });

    // ─── Disconnect ────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
      // Game state is preserved in DB — player can reconnect
    });
  });
};
