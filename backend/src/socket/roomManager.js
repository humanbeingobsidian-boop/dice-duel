// backend/src/socket/roomManager.js
const crypto = require('crypto');
const {
  createGame, getGameByRoomCode, getGameById,
  getGamePlayers, getActivePlayers, updateGameStatus,
  joinGameTransaction, leaveGameTransaction,
  eliminatePlayer, recordTurn, finalizeGameTransaction,
  getUserByTelegramId,
} = require('../db/queries');

const { db } = require('../db/queries');
const { createBotPlayer, randomBotCount } = require('./botPlayers');

// ─── In-memory state ──────────────────────────────────────────────────────────
const rooms = new Map();

function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

function shufflePlayers(players) {
  return [...players].sort(() => Math.random() - 0.5);
}

function sanitizePlayer(player) {
  if (!player) return player;
  const { isBot, balance, ...safe } = player;
  return safe;
}

function sanitizePlayers(players = []) {
  return players.map(sanitizePlayer);
}

function getOrCreateWaitingRoom(entryFee = 100) {
  const game = db.prepare(`
    SELECT g.*, COUNT(gp.id) as player_count
    FROM games g
    LEFT JOIN game_players gp ON gp.game_id = g.id AND gp.status = 'active'
    WHERE g.status = 'waiting' AND g.entry_fee = ?
    GROUP BY g.id
    HAVING player_count < g.max_players
    ORDER BY g.created_at ASC
    LIMIT 1
  `).get(entryFee);

  if (game) return { game };

  let roomCode;
  do { roomCode = generateRoomCode(); }
  while (getGameByRoomCode.get(roomCode));
  const newGame = createGame.get({ room_code: roomCode, entry_fee: entryFee, house_fee_percent: 10, max_players: 6 });
  return { game: newGame };
}

function ensureRoomState(roomCode) {
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, {
      roomCode,
      timer: null,
      countdownSecondsLeft: 60,
      currentPlayerIndex: 0,
      started: false,
      turnTimer: null,
      turnSecondsLeft: 10,
      reconnectTimers: new Map(),
      reconnectSecondsLeft: new Map(),
      readyPlayers: new Set(),
      botPlayers: [],
      botsScheduled: false,
      playerOrder: null,
    });
  }
  return rooms.get(roomCode);
}

function clearTimer(roomState) {
  if (roomState.timer) { clearInterval(roomState.timer); roomState.timer = null; }
}

function clearTurnTimer(roomState) {
  if (roomState.turnTimer) { clearInterval(roomState.turnTimer); roomState.turnTimer = null; }
}

function buildMergedPlayers(realPlayers, botPlayers) {
  return [
    ...realPlayers,
    ...botPlayers.map(b => ({
      user_id: b.id,
      telegram_id: b.telegram_id,
      first_name: b.first_name,
      username: null,
      status: b.status || 'active',
      seat_order: b.seat_order,
      isBot: true,
    })),
  ];
}

function getAllPlayers(game, roomState) {
  return buildMergedPlayers(getGamePlayers.all(game.id), roomState?.botPlayers || []);
}

function getAllActivePlayers(game, roomState) {
  const realActive = getActivePlayers.all(game.id);
  const botActive = (roomState?.botPlayers || []).filter(b => b.status === 'active');
  return buildMergedPlayers(realActive, botActive);
}

function getActiveSorted(game, roomState) {
  const allActive = getAllActivePlayers(game, roomState);
  if (roomState?.playerOrder) {
    return roomState.playerOrder.filter(p => allActive.some(a => a.user_id === p.user_id));
  }
  return allActive;
}

function getDisplayPlayers(game, roomState) {
  const allPlayers = getAllPlayers(game, roomState);
  if (roomState?.playerOrder) {
    const orderedIds = new Set(roomState.playerOrder.map(p => p.user_id));
    const ordered = roomState.playerOrder.map(p => allPlayers.find(a => a.user_id === p.user_id)).filter(Boolean);
    const rest = allPlayers.filter(p => !orderedIds.has(p.user_id));
    return [...ordered, ...rest];
  }
  return allPlayers;
}

function emitPlayers(roomCode, io, game) {
  const roomState = ensureRoomState(roomCode);
  const freshGame = getGameById.get(game.id);
  const players = getDisplayPlayers(freshGame, roomState);
  io.to(roomCode).emit('player_joined', {
    players: sanitizePlayers(players),
    pot: freshGame.pot,
    playerCount: players.filter(p => p.status === 'active').length,
  });
}

function emitReady(roomCode, io, game) {
  const roomState = ensureRoomState(roomCode);
  const activePlayers = getAllActivePlayers(game, roomState);
  const readyCount = activePlayers.filter(p => roomState.readyPlayers.has(p.user_id)).length;
  io.to(roomCode).emit('ready_updated', {
    readyUserIds: Array.from(roomState.readyPlayers),
    readyCount,
    totalCount: activePlayers.length,
  });
  return { activePlayers, readyCount };
}

function removeOneWaitingBotForRealPlayer(roomCode, game, io) {
  const roomState = ensureRoomState(roomCode);
  const realPlayers = getGamePlayers.all(game.id);
  if (realPlayers.length < 2) return null;

  const index = roomState.botPlayers.findIndex(b => b.status === 'active');
  if (index === -1) return null;

  const [bot] = roomState.botPlayers.splice(index, 1);
  roomState.readyPlayers.delete(bot.id);
  db.prepare(`UPDATE games SET pot = MAX(0, pot - ?) WHERE id = ?`).run(game.entry_fee, game.id);

  const freshGame = getGameById.get(game.id);
  const players = getDisplayPlayers(freshGame, roomState);
  io.to(roomCode).emit('player_left', {
    userId: bot.id,
    firstName: bot.first_name,
    players: sanitizePlayers(players),
    pot: freshGame.pot,
    playerCount: players.filter(p => p.status === 'active').length,
  });
  return bot;
}

function maybeStartIfAllReady(roomCode, io, game) {
  const roomState = ensureRoomState(roomCode);
  if (roomState.started) return false;
  const { activePlayers, readyCount } = emitReady(roomCode, io, game);
  if (activePlayers.length >= 2 && readyCount === activePlayers.length) {
    clearTimer(roomState);
    io.to(roomCode).emit('all_ready', {});
    setTimeout(() => startGame(roomCode, io), 1500);
    return true;
  }
  return false;
}

// ─── JOIN ─────────────────────────────────────────────────────────────────────
function joinGame(telegramUser, io, entryFee = 100) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) throw new Error('USER_NOT_FOUND');
  if (dbUser.balance < entryFee) throw new Error('INSUFFICIENT_BALANCE');

  const { game } = getOrCreateWaitingRoom(entryFee);
  const alreadyInActiveGame = db.prepare(`
    SELECT 1 FROM game_players gp
    JOIN games g ON g.id = gp.game_id
    WHERE gp.user_id = ? AND g.status = 'waiting'
  `).get(dbUser.id);
  if (alreadyInActiveGame) throw new Error('ALREADY_IN_GAME');

  const currentPlayers = getGamePlayers.all(game.id);
  joinGameTransaction(dbUser.id, game.id, game.entry_fee, currentPlayers.length);

  const updatedGame = getGameById.get(game.id);
  const roomState = ensureRoomState(game.room_code);

  // Prefer real players over bots. When a new real player joins an occupied bot room,
  // remove one active bot and subtract its virtual entry fee from the pot.
  removeOneWaitingBotForRealPlayer(game.room_code, updatedGame, io);

  const freshGame = getGameById.get(game.id);
  const allPlayersWithBots = getDisplayPlayers(freshGame, roomState);

  io.to(game.room_code).emit('player_joined', {
    players: sanitizePlayers(allPlayersWithBots),
    pot: freshGame.pot,
    playerCount: allPlayersWithBots.filter(p => p.status === 'active').length,
  });

  // Timer now starts as soon as the first real player enters.
  if (!roomState.timer && !roomState.started) {
    startCountdown(game.room_code, io);
  }

  scheduleBotJoins(game.room_code, game.entry_fee, io);

  const activeCount = allPlayersWithBots.filter(p => p.status === 'active').length;
  if (activeCount >= freshGame.max_players && !roomState.started) {
    clearTimer(roomState);
    startGame(game.room_code, io);
  }

  return {
    game: freshGame,
    players: sanitizePlayers(allPlayersWithBots),
    user: dbUser,
    countdownActive: roomState.timer !== null,
    countdownSecondsLeft: roomState.countdownSecondsLeft,
  };
}

// ─── PUSH NOTIFICATION ───────────────────────────────────────────────────────
async function sendPushToWaitingPlayers(roomCode, entryFee) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) return;

  const game = getGameByRoomCode.get(roomCode);
  if (!game || game.status !== 'waiting') return;

  const players = getGamePlayers.all(game.id);
  const tableType = entryFee >= 100 ? '💎 הימור גבוה' : '🎲 הימור נמוך';
  const MINI_APP_URL = process.env.MINI_APP_URL || '';

  for (const player of players) {
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: player.telegram_id,
          text:
            `🎲 *יש שחקנים שממתינים!*\n\n` +
            `שולחן: ${tableType}\n` +
            `חזור למשחק ותתחיל לשחק! 🏆`,
          parse_mode: 'Markdown',
          reply_markup: MINI_APP_URL ? {
            inline_keyboard: [[{
              text: '🎲 חזור למשחק',
              web_app: { url: MINI_APP_URL },
            }]],
          } : undefined,
        }),
      });
    } catch {}
  }
}

// ─── BOT JOINS ───────────────────────────────────────────────────────────────
function scheduleBotJoins(roomCode, entryFee, io) {
  const roomState = ensureRoomState(roomCode);
  if (roomState.started) return;
  if (roomState.botsScheduled) return;
  roomState.botsScheduled = true;

  const botCount = randomBotCount(); // 1-4
  let delay = 3000;

  for (let i = 0; i < botCount; i++) {
    setTimeout(() => {
      const currentGame = getGameByRoomCode.get(roomCode);
      if (!currentGame || currentGame.status !== 'waiting') return;
      if (roomState.started) return;

      const realPlayers = getGamePlayers.all(currentGame.id);
      const totalCount = realPlayers.length + roomState.botPlayers.filter(b => b.status === 'active').length;
      if (totalCount >= currentGame.max_players) return;

      const bot = createBotPlayer();
      roomState.botPlayers.push({
        ...bot,
        seat_order: totalCount,
        status: 'active',
      });
      roomState.readyPlayers.add(bot.id);

      db.prepare(`UPDATE games SET pot = pot + ? WHERE id = ?`).run(currentGame.entry_fee, currentGame.id);
      emitPlayers(roomCode, io, currentGame);
      maybeStartIfAllReady(roomCode, io, currentGame);

      console.log(`Room ${roomCode}: ${totalCount + 1}/${currentGame.max_players} players`);
    }, delay);

    delay += Math.floor(Math.random() * 2000) + 1000;
  }
}

// ─── LEAVE WAITING ROOM ───────────────────────────────────────────────────────
function leaveWaitingRoom(telegramUser, io) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) throw new Error('USER_NOT_FOUND');

  const row = db.prepare(`
    SELECT g.* FROM games g
    JOIN game_players gp ON gp.game_id = g.id
    WHERE g.status = 'waiting' AND gp.user_id = ? LIMIT 1
  `).get(dbUser.id);
  if (!row) throw new Error('NOT_IN_WAITING_ROOM');

  leaveGameTransaction(dbUser.id, row.id, row.entry_fee);

  const remainingRealPlayers = getGamePlayers.all(row.id);
  const updatedGame = getGameById.get(row.id);
  const roomState = rooms.get(row.room_code);

  if (roomState && remainingRealPlayers.length === 0) {
    clearTimer(roomState);
    roomState.readyPlayers.clear();
    roomState.botPlayers = [];
    db.prepare(`UPDATE games SET pot = 0 WHERE id = ?`).run(row.id);
    io.to(row.room_code).emit('countdown_stopped', {});
  } else if (roomState && !roomState.timer && !roomState.started) {
    startCountdown(row.room_code, io);
  }

  const freshGame = getGameById.get(row.id);
  const players = roomState ? getDisplayPlayers(freshGame, roomState) : remainingRealPlayers;
  io.to(row.room_code).emit('player_left', {
    userId: dbUser.id,
    firstName: dbUser.first_name,
    players: sanitizePlayers(players),
    pot: freshGame.pot,
    playerCount: players.filter(p => p.status === 'active').length,
  });

  return { user: dbUser, roomCode: row.room_code, refunded: row.entry_fee };
}

// ─── LEAVE ACTIVE GAME AFTER ELIMINATION ─────────────────────────────────────
function leaveActiveGame(telegramUser, roomCode) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) throw new Error('USER_NOT_FOUND');

  const game = getGameByRoomCode.get(roomCode);
  if (!game || game.status !== 'active') throw new Error('GAME_NOT_ACTIVE');

  const player = db.prepare(`
    SELECT status FROM game_players WHERE game_id = ? AND user_id = ? LIMIT 1
  `).get(game.id, dbUser.id);

  if (!player) throw new Error('NOT_IN_GAME');
  if (player.status !== 'eliminated') throw new Error('NOT_ELIMINATED');

  return { user: dbUser, roomCode };
}

// ─── READY TOGGLE ────────────────────────────────────────────────────────────
function toggleReady(telegramUser, roomCode, io) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) throw new Error('USER_NOT_FOUND');

  const game = getGameByRoomCode.get(roomCode);
  if (!game || game.status !== 'waiting') throw new Error('NOT_IN_WAITING_ROOM');

  const roomState = ensureRoomState(roomCode);
  const userId = dbUser.id;

  if (roomState.readyPlayers.has(userId)) {
    roomState.readyPlayers.delete(userId);
  } else {
    roomState.readyPlayers.add(userId);
  }

  maybeStartIfAllReady(roomCode, io, game);
  return { isReady: roomState.readyPlayers.has(userId), readyUserIds: Array.from(roomState.readyPlayers) };
}

// ─── DISCONNECT ───────────────────────────────────────────────────────────────
function handleActiveGameDisconnect(telegramUser, roomCode, io) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) return;

  const game = getGameByRoomCode.get(roomCode);
  if (!game || game.status !== 'active') return;

  const roomState = rooms.get(roomCode);
  if (!roomState) return;

  clearTurnTimer(roomState);
  io.to(roomCode).emit('turn_timer_paused', { userId: dbUser.id });

  if (roomState.reconnectTimers.has(dbUser.id)) {
    clearTimeout(roomState.reconnectTimers.get(dbUser.id));
    roomState.reconnectTimers.delete(dbUser.id);
  }
  const tickKey = `${dbUser.id}_tick`;
  if (roomState.reconnectTimers.has(tickKey)) {
    clearInterval(roomState.reconnectTimers.get(tickKey));
    roomState.reconnectTimers.delete(tickKey);
  }

  const savedSeconds = roomState.reconnectSecondsLeft.get(dbUser.id);
  let secondsLeft = (savedSeconds && savedSeconds > 0) ? savedSeconds : 30;

  io.to(roomCode).emit('player_disconnected', {
    userId: dbUser.id,
    firstName: dbUser.first_name,
    secondsLeft,
  });

  const tickInterval = setInterval(() => {
    secondsLeft--;
    roomState.reconnectSecondsLeft.set(dbUser.id, secondsLeft);
    io.to(roomCode).emit('reconnect_tick', { userId: dbUser.id, secondsLeft });
    if (secondsLeft <= 0) clearInterval(tickInterval);
  }, 1000);

  const timeout = setTimeout(() => {
    clearInterval(tickInterval);
    roomState.reconnectTimers.delete(dbUser.id);
    roomState.reconnectSecondsLeft.delete(dbUser.id);

    const freshGame = getGameByRoomCode.get(roomCode);
    if (!freshGame || freshGame.status !== 'active') return;

    eliminatePlayer.run({ game_id: game.id, user_id: dbUser.id });
    recordTurn.run({ game_id: game.id, user_id: dbUser.id, dice_result: 0, was_eliminated: 1 });

    const remainingPlayers = getActiveSorted(game, roomState);
    io.to(roomCode).emit('player_abandoned', {
      userId: dbUser.id,
      firstName: dbUser.first_name,
      remainingPlayers: sanitizePlayers(remainingPlayers),
    });

    if (remainingPlayers.length === 1) {
      endGame(roomCode, remainingPlayers[0], freshGame, io);
    } else if (remainingPlayers.length === 0) {
      updateGameStatus.run({ status: 'finished', id: game.id });
      rooms.delete(roomCode);
    } else {
      roomState.currentPlayerIndex = roomState.currentPlayerIndex % remainingPlayers.length;
      startTurnTimer(roomCode, io);
    }
  }, secondsLeft * 1000);

  roomState.reconnectTimers.set(dbUser.id, timeout);
  roomState.reconnectTimers.set(tickKey, tickInterval);
}

// ─── RECONNECT ────────────────────────────────────────────────────────────────
function handleReconnect(telegramUser, roomCode, io) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) return false;

  const roomState = rooms.get(roomCode);
  if (!roomState) return false;

  if (roomState.reconnectTimers.has(dbUser.id)) {
    clearTimeout(roomState.reconnectTimers.get(dbUser.id));
    roomState.reconnectTimers.delete(dbUser.id);
  }
  const tickKey = `${dbUser.id}_tick`;
  if (roomState.reconnectTimers.has(tickKey)) {
    clearInterval(roomState.reconnectTimers.get(tickKey));
    roomState.reconnectTimers.delete(tickKey);
  }

  const game = getGameByRoomCode.get(roomCode);
  if (game && game.status === 'active' && !roomState.turnTimer) {
    if (io) io.to(roomCode).emit('turn_timer_resumed', { userId: dbUser.id });
    startTurnTimer(roomCode, io);
  }

  return true;
}

function clearReconnectSeconds(userId, roomCode) {
  const roomState = rooms.get(roomCode);
  if (roomState) roomState.reconnectSecondsLeft.delete(userId);
}

// ─── LOBBY COUNTDOWN ─────────────────────────────────────────────────────────
function startCountdown(roomCode, io) {
  const roomState = ensureRoomState(roomCode);
  clearTimer(roomState);

  let secondsLeft = roomState.countdownSecondsLeft > 0 ? roomState.countdownSecondsLeft : 60;
  roomState.countdownSecondsLeft = secondsLeft;
  io.to(roomCode).emit('countdown_started', { secondsLeft });

  roomState.timer = setInterval(() => {
    secondsLeft--;
    roomState.countdownSecondsLeft = secondsLeft;
    io.to(roomCode).emit('countdown_tick', { secondsLeft });
    if (secondsLeft <= 0) {
      clearTimer(roomState);
      startGame(roomCode, io);
    }
  }, 1000);
}

// ─── START GAME ───────────────────────────────────────────────────────────────
function startGame(roomCode, io) {
  const game = getGameByRoomCode.get(roomCode);
  if (!game || game.status !== 'waiting') return;

  const roomState = ensureRoomState(roomCode);
  const allPlayers = getAllActivePlayers(game, roomState);

  if (allPlayers.length < 2) {
    io.to(roomCode).emit('game_cancelled', { reason: 'Not enough players' });
    return;
  }

  roomState.started = true;
  roomState.currentPlayerIndex = 0;

  updateGameStatus.run({ status: 'active', id: game.id });

  // Random order is selected once at game start and is kept top-to-bottom.
  const shuffled = shufflePlayers(allPlayers);
  roomState.playerOrder = shuffled;

  const freshGameForStart = getGameById.get(game.id);
  io.to(roomCode).emit('game_started', {
    players: sanitizePlayers(shuffled),
    currentPlayer: sanitizePlayer(shuffled[0]),
    pot: freshGameForStart.pot,
  });

  console.log(`🎮 Game ${roomCode} started — ${getActivePlayers.all(game.id).length} real + ${(roomState.botPlayers || []).filter(b => b.status === 'active').length} bots`);

  startTurnTimer(roomCode, io);
}

// ─── TURN TIMER ───────────────────────────────────────────────────────────────
function startTurnTimer(roomCode, io) {
  const roomState = rooms.get(roomCode);
  if (!roomState) return;

  clearTurnTimer(roomState);
  roomState.turnSecondsLeft = 10;

  io.to(roomCode).emit('turn_timer_tick', { secondsLeft: 10 });

  roomState.turnTimer = setInterval(() => {
    roomState.turnSecondsLeft--;
    io.to(roomCode).emit('turn_timer_tick', { secondsLeft: roomState.turnSecondsLeft });

    if (roomState.turnSecondsLeft <= 0) {
      clearTurnTimer(roomState);
      const game = getGameByRoomCode.get(roomCode);
      if (!game || game.status !== 'active') return;

      const allActive = getActiveSorted(game, roomState);
      if (!allActive.length) return;

      const currentPlayer = allActive[roomState.currentPlayerIndex % allActive.length];
      if (!currentPlayer) return;

      _executeRoll(roomCode, currentPlayer.user_id, currentPlayer.telegram_id, currentPlayer.first_name, game, roomState, io);
    }
  }, 1000);

  const checkBotTurn = () => {
    const game = getGameByRoomCode.get(roomCode);
    if (!game || game.status !== 'active') return;
    const allActive = getActiveSorted(game, roomState);
    if (!allActive.length) return;
    const currentPlayer = allActive[roomState.currentPlayerIndex % allActive.length];
    const isBot = (roomState.botPlayers || []).some(b => b.id === currentPlayer?.user_id);
    if (isBot) {
      const delay = Math.floor(Math.random() * 3000) + 1000;
      setTimeout(() => {
        if (!roomState.turnTimer) return;
        clearTurnTimer(roomState);
        const freshGame = getGameByRoomCode.get(roomCode);
        if (!freshGame || freshGame.status !== 'active') return;
        _executeRoll(roomCode, currentPlayer.user_id, currentPlayer.telegram_id, currentPlayer.first_name, freshGame, roomState, io);
      }, delay);
    }
  };
  checkBotTurn();
}

// ─── ROLL DICE ────────────────────────────────────────────────────────────────
function rollDiceForPlayer(roomCode, telegramUserId, io) {
  const game = getGameByRoomCode.get(roomCode);
  if (!game || game.status !== 'active') throw new Error('GAME_NOT_ACTIVE');

  const dbUser = getUserByTelegramId.get(String(telegramUserId));
  if (!dbUser) throw new Error('USER_NOT_FOUND');

  const roomState = rooms.get(roomCode);
  if (!roomState) throw new Error('ROOM_NOT_FOUND');

  const allActive = getActiveSorted(game, roomState);
  if (!allActive.length) throw new Error('NO_ACTIVE_PLAYERS');

  const currentPlayer = allActive[roomState.currentPlayerIndex % allActive.length];
  if (!currentPlayer || currentPlayer.user_id !== dbUser.id) throw new Error('NOT_YOUR_TURN');

  clearTurnTimer(roomState);
  return _executeRoll(roomCode, dbUser.id, String(telegramUserId), dbUser.first_name, game, roomState, io);
}

// ─── CORE ROLL LOGIC ─────────────────────────────────────────────────────────
function _executeRoll(roomCode, userId, telegramId, firstName, game, roomState, io) {
  roomState.reconnectSecondsLeft.delete(userId);
  const diceResult = rollDice();
  const isEliminated = diceResult === 1;

  const isBot = (roomState.botPlayers || []).some(b => b.id === userId);

  if (!isBot) {
    recordTurn.run({ game_id: game.id, user_id: userId, dice_result: diceResult, was_eliminated: isEliminated ? 1 : 0 });
    if (isEliminated) eliminatePlayer.run({ game_id: game.id, user_id: userId });
  } else if (isEliminated) {
    const bot = roomState.botPlayers.find(b => b.id === userId);
    if (bot) bot.status = 'eliminated';
  }

  const remainingPlayers = getActiveSorted(game, roomState);
  const displayPlayers = getDisplayPlayers(game, roomState);

  io.to(roomCode).emit('dice_rolled', {
    userId, telegramId, firstName, diceResult, isEliminated,
    remainingPlayers: sanitizePlayers(remainingPlayers),
    players: sanitizePlayers(displayPlayers),
  });

  if (remainingPlayers.length <= 1) {
    setTimeout(() => {
      if (remainingPlayers.length === 1) {
        endGame(roomCode, remainingPlayers[0], game, io);
      } else {
        io.to(roomCode).emit('game_draw', {});
        updateGameStatus.run({ status: 'finished', id: game.id });
        rooms.delete(roomCode);
      }
    }, 2500);
    return { diceResult, isEliminated, gameOver: true };
  }

  if (!isEliminated) {
    roomState.currentPlayerIndex = (roomState.currentPlayerIndex + 1) % remainingPlayers.length;
  } else {
    roomState.currentPlayerIndex = roomState.currentPlayerIndex % remainingPlayers.length;
  }

  io.to(roomCode).emit('next_turn', {
    currentPlayer: sanitizePlayer(remainingPlayers[roomState.currentPlayerIndex]),
    remainingPlayers: sanitizePlayers(remainingPlayers),
  });

  startTurnTimer(roomCode, io);
  return { diceResult, isEliminated, gameOver: false };
}

// ─── END GAME ─────────────────────────────────────────────────────────────────
function endGame(roomCode, winner, game, io) {
  const freshGame = getGameById.get(game.id);
  if (!freshGame || freshGame.status === 'finished') return;

  const pot = freshGame.pot;
  const houseCut = Math.floor((pot * freshGame.house_fee_percent) / 100);
  const prize = pot - houseCut;

  const isBot = winner.isBot === true;

  console.log(`🔍 endGame: winner=${winner.first_name} isBot=${isBot} user_id=${winner.user_id} pot=${pot} prize=${prize}`);

  if (!isBot) {
    finalizeGameTransaction(game.id, winner.user_id, prize, houseCut);
  } else {
    updateGameStatus.run({ status: 'finished', id: game.id });
  }

  io.to(roomCode).emit('game_over', {
    winner: {
      userId: winner.user_id,
      telegramId: winner.telegram_id,
      firstName: winner.first_name,
      username: winner.username || null,
    },
    pot,
    // If a bot wins, show the same visible prize amount, but do not credit any DB user.
    prize,
    houseCut,
  });

  if (!isBot) {
    console.log(`🏆 ${winner.first_name} won — prize: ${prize}`);
  }

  const roomState = rooms.get(roomCode);
  if (roomState) { clearTimer(roomState); clearTurnTimer(roomState); }
  rooms.delete(roomCode);
}

// ─── SNAPSHOT ────────────────────────────────────────────────────────────────
function getRoomSnapshot(roomCode, userId) {
  const game = getGameByRoomCode.get(roomCode);
  if (!game) return null;
  const roomState = rooms.get(roomCode) || ensureRoomState(roomCode);
  const players = getDisplayPlayers(game, roomState);
  const activePlayers = getActiveSorted(game, roomState);

  let currentPlayer = null;
  if (roomState && activePlayers.length > 0) {
    currentPlayer = activePlayers[roomState.currentPlayerIndex % activePlayers.length];
  }

  const reconnectSecondsLeft = userId && roomState
    ? (roomState.reconnectSecondsLeft.get(userId) ?? null)
    : null;

  return {
    game,
    players: sanitizePlayers(players),
    activePlayers: sanitizePlayers(activePlayers),
    currentPlayer: sanitizePlayer(currentPlayer),
    started: roomState?.started || false,
    turnSecondsLeft: roomState?.turnSecondsLeft ?? 10,
    reconnectSecondsLeft,
  };
}

module.exports = {
  joinGame, leaveWaitingRoom, leaveActiveGame, toggleReady, rollDiceForPlayer,
  handleActiveGameDisconnect, handleReconnect,
  getRoomSnapshot, ensureRoomState,
};
