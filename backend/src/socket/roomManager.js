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

const rooms = new Map();

const PUBLIC_AVATARS = ['🦊', '🐼', '🐯', '🐵', '🐨', '🐺', '🦁', '🐸', '🐧', '🐰', '🦄', '🐲', '🦉', '🐙', '🦋', '⭐', '🔥', '⚡', '🌙', '🍀'];
const PUBLIC_COLORS = [
  'linear-gradient(135deg, #7c3aed, #a855f7)',
  'linear-gradient(135deg, #2563eb, #38bdf8)',
  'linear-gradient(135deg, #059669, #34d399)',
  'linear-gradient(135deg, #dc2626, #fb7185)',
  'linear-gradient(135deg, #d97706, #fbbf24)',
  'linear-gradient(135deg, #9333ea, #ec4899)',
  'linear-gradient(135deg, #0f766e, #2dd4bf)',
  'linear-gradient(135deg, #4f46e5, #818cf8)',
];

function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function stableIndex(value, mod) {
  const str = String(value || '0');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return Math.abs(hash) % mod;
}

function shufflePlayers(players) {
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function sanitizePlayer(player) {
  if (!player) return player;
  const { isBot, balance, readyDelayMs, turnDelayMinMs, turnDelayMaxMs, ...safe } = player;
  const stableId = safe.user_id || safe.telegram_id || safe.id;
  if (!safe.avatar) safe.avatar = PUBLIC_AVATARS[stableIndex(stableId, PUBLIC_AVATARS.length)];
  if (!safe.avatarColor) safe.avatarColor = PUBLIC_COLORS[stableIndex(`${stableId}:color`, PUBLIC_COLORS.length)];
  return safe;
}

function sanitizePlayers(players = []) {
  return players.map(sanitizePlayer);
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
      turnToken: 0,
      reconnectTimers: new Map(),
      reconnectSecondsLeft: new Map(),
      readyPlayers: new Set(),
      botPlayers: [],
      botsScheduled: false,
      playerOrder: null,
      fastStartTimer: null,
    });
  }
  return rooms.get(roomCode);
}

function clearTimer(roomState) {
  if (roomState?.timer) {
    clearInterval(roomState.timer);
    roomState.timer = null;
  }
}

function clearTurnTimer(roomState) {
  if (roomState?.turnTimer) {
    clearInterval(roomState.turnTimer);
    roomState.turnTimer = null;
  }
}

function clearFastStartTimer(roomState) {
  if (roomState?.fastStartTimer) {
    clearTimeout(roomState.fastStartTimer);
    roomState.fastStartTimer = null;
  }
}

function clearRoomRuntime(roomState) {
  if (!roomState) return;
  clearTimer(roomState);
  clearTurnTimer(roomState);
  clearFastStartTimer(roomState);
  roomState.turnToken++;
  for (const timer of roomState.reconnectTimers.values()) {
    clearTimeout(timer);
    clearInterval(timer);
  }
  roomState.reconnectTimers.clear();
  roomState.reconnectSecondsLeft.clear();
  roomState.readyPlayers.clear();
  roomState.botPlayers = [];
  roomState.playerOrder = null;
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
      avatar: b.avatar,
      avatarColor: b.avatarColor,
      readyDelayMs: b.readyDelayMs,
      turnDelayMinMs: b.turnDelayMinMs,
      turnDelayMaxMs: b.turnDelayMaxMs,
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

function closeWaitingRoom(roomCode, game, io, reason = 'Room closed') {
  const roomState = rooms.get(roomCode);
  clearRoomRuntime(roomState);
  db.prepare('DELETE FROM game_players WHERE game_id = ?').run(game.id);
  db.prepare('UPDATE games SET pot = 0 WHERE id = ?').run(game.id);
  updateGameStatus.run({ status: 'finished', id: game.id });
  io.to(roomCode).emit('countdown_stopped', {});
  io.to(roomCode).emit('game_cancelled', { reason });
  rooms.delete(roomCode);
}

function closeIfNoRealPlayers(roomCode, game, io) {
  const realPlayers = getGamePlayers.all(game.id);
  if (realPlayers.length > 0) return false;
  closeWaitingRoom(roomCode, game, io, 'Room closed');
  return true;
}

function cleanupExistingWaitingMembership(userId, io) {
  const rows = db.prepare(`
    SELECT g.* FROM games g
    JOIN game_players gp ON gp.game_id = g.id
    WHERE g.status = 'waiting' AND gp.user_id = ?
  `).all(userId);

  for (const row of rows) {
    const removed = leaveGameTransaction(userId, row.id, row.entry_fee);
    if (!removed) continue;

    const freshGame = getGameById.get(row.id);
    const remainingRealPlayers = getGamePlayers.all(row.id);
    const roomState = rooms.get(row.room_code);

    if (remainingRealPlayers.length === 0) {
      closeWaitingRoom(row.room_code, freshGame, io, 'Room closed');
      continue;
    }

    if (roomState) roomState.readyPlayers.delete(userId);
    const players = roomState ? getDisplayPlayers(freshGame, roomState) : remainingRealPlayers;
    io.to(row.room_code).emit('player_left', {
      userId,
      players: sanitizePlayers(players),
      pot: freshGame.pot,
      playerCount: players.filter(p => p.status === 'active').length,
    });
  }
}

function emitPlayers(roomCode, io, game, eventName = 'player_joined') {
  const roomState = ensureRoomState(roomCode);
  const freshGame = getGameById.get(game.id);
  const players = getDisplayPlayers(freshGame, roomState);
  io.to(roomCode).emit(eventName, {
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
  db.prepare('UPDATE games SET pot = MAX(0, pot - ?) WHERE id = ?').run(game.entry_fee, game.id);

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
  if (closeIfNoRealPlayers(roomCode, game, io)) return false;

  const { activePlayers, readyCount } = emitReady(roomCode, io, game);
  if (activePlayers.length >= 2 && readyCount === activePlayers.length) {
    clearTimer(roomState);
    clearFastStartTimer(roomState);
    const hasBot = activePlayers.some(p => (roomState.botPlayers || []).some(b => b.id === p.user_id));
    const delay = hasBot ? randomBetween(2800, 5200) : 1500;
    io.to(roomCode).emit('all_ready', { startsInMs: delay });
    roomState.fastStartTimer = setTimeout(() => startGame(roomCode, io), delay);
    return true;
  }

  clearFastStartTimer(roomState);
  return false;
}

function joinGame(telegramUser, io, entryFee = 100) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) throw new Error('USER_NOT_FOUND');
  if (dbUser.balance < entryFee) throw new Error('INSUFFICIENT_BALANCE');

  cleanupExistingWaitingMembership(dbUser.id, io);

  const { game } = getOrCreateWaitingRoom(entryFee);
  const currentPlayers = getGamePlayers.all(game.id);
  joinGameTransaction(dbUser.id, game.id, game.entry_fee, currentPlayers.length);

  const roomState = ensureRoomState(game.room_code);
  const updatedGame = getGameById.get(game.id);
  removeOneWaitingBotForRealPlayer(game.room_code, updatedGame, io);

  const freshGame = getGameById.get(game.id);
  const allPlayersWithBots = getDisplayPlayers(freshGame, roomState);

  io.to(game.room_code).emit('player_joined', {
    players: sanitizePlayers(allPlayersWithBots),
    pot: freshGame.pot,
    playerCount: allPlayersWithBots.filter(p => p.status === 'active').length,
  });

  if (!roomState.timer && !roomState.started) startCountdown(game.room_code, io);

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

function scheduleBotJoins(roomCode, entryFee, io) {
  const roomState = ensureRoomState(roomCode);
  if (roomState.started || roomState.botsScheduled) return;
  roomState.botsScheduled = true;

  const botCount = randomBotCount();
  let delay = randomBetween(1800, 6500);

  for (let i = 0; i < botCount; i++) {
    setTimeout(() => {
      const currentGame = getGameByRoomCode.get(roomCode);
      if (!currentGame || currentGame.status !== 'waiting') return;
      if (roomState.started) return;

      const realPlayers = getGamePlayers.all(currentGame.id);
      if (realPlayers.length === 0) {
        closeWaitingRoom(roomCode, currentGame, io, 'Room closed');
        return;
      }

      const totalCount = realPlayers.length + roomState.botPlayers.filter(b => b.status === 'active').length;
      if (totalCount >= currentGame.max_players) return;

      const bot = createBotPlayer();
      roomState.botPlayers.push({ ...bot, seat_order: totalCount, status: 'active' });

      db.prepare('UPDATE games SET pot = pot + ? WHERE id = ?').run(currentGame.entry_fee, currentGame.id);
      emitPlayers(roomCode, io, currentGame);

      const readyDelay = bot.readyDelayMs || randomBetween(2500, 14000);
      setTimeout(() => {
        const freshGame = getGameByRoomCode.get(roomCode);
        if (!freshGame || freshGame.status !== 'waiting') return;
        if (roomState.started) return;
        if (!roomState.botPlayers.some(b => b.id === bot.id && b.status === 'active')) return;
        if (getGamePlayers.all(freshGame.id).length === 0) {
          closeWaitingRoom(roomCode, freshGame, io, 'Room closed');
          return;
        }
        roomState.readyPlayers.add(bot.id);
        maybeStartIfAllReady(roomCode, io, freshGame);
      }, readyDelay);
    }, delay);

    delay += randomBetween(2400, 9000);
  }
}

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

  const freshGame = getGameById.get(row.id);
  const roomState = rooms.get(row.room_code);
  if (roomState) roomState.readyPlayers.delete(dbUser.id);

  const remainingRealPlayers = getGamePlayers.all(row.id);
  if (remainingRealPlayers.length === 0) {
    closeWaitingRoom(row.room_code, freshGame, io, 'Room closed');
    return { user: dbUser, roomCode: row.room_code, refunded: row.entry_fee };
  }

  if (roomState) clearFastStartTimer(roomState);

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

function leaveActiveGame(telegramUser, roomCode) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) throw new Error('USER_NOT_FOUND');

  const game = getGameByRoomCode.get(roomCode);
  if (!game || game.status !== 'active') throw new Error('GAME_NOT_ACTIVE');

  const player = db.prepare('SELECT status FROM game_players WHERE game_id = ? AND user_id = ? LIMIT 1').get(game.id, dbUser.id);
  if (!player) throw new Error('NOT_IN_GAME');
  if (player.status !== 'eliminated') throw new Error('NOT_ELIMINATED');

  return { user: dbUser, roomCode };
}

function toggleReady(telegramUser, roomCode, io) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) throw new Error('USER_NOT_FOUND');

  const game = getGameByRoomCode.get(roomCode);
  if (!game || game.status !== 'waiting') throw new Error('NOT_IN_WAITING_ROOM');
  if (closeIfNoRealPlayers(roomCode, game, io)) return { isReady: false, readyUserIds: [] };

  const roomState = ensureRoomState(roomCode);
  if (roomState.readyPlayers.has(dbUser.id)) roomState.readyPlayers.delete(dbUser.id);
  else roomState.readyPlayers.add(dbUser.id);

  maybeStartIfAllReady(roomCode, io, game);
  return { isReady: roomState.readyPlayers.has(dbUser.id), readyUserIds: Array.from(roomState.readyPlayers) };
}

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
      const game = getGameByRoomCode.get(roomCode);
      if (!game || game.status !== 'waiting') return;
      if (closeIfNoRealPlayers(roomCode, game, io)) return;
      startGame(roomCode, io);
    }
  }, 1000);
}

function startGame(roomCode, io) {
  const game = getGameByRoomCode.get(roomCode);
  if (!game || game.status !== 'waiting') return;

  const roomState = ensureRoomState(roomCode);
  clearFastStartTimer(roomState);

  const realPlayers = getActivePlayers.all(game.id);
  if (realPlayers.length === 0) {
    closeWaitingRoom(roomCode, game, io, 'Room closed');
    return;
  }

  const allPlayers = getAllActivePlayers(game, roomState);
  if (allPlayers.length < 2) {
    io.to(roomCode).emit('game_cancelled', { reason: 'Not enough players' });
    return;
  }

  roomState.started = true;
  roomState.currentPlayerIndex = 0;
  updateGameStatus.run({ status: 'active', id: game.id });

  const shuffled = shufflePlayers(allPlayers);
  roomState.playerOrder = shuffled;

  const freshGame = getGameById.get(game.id);
  io.to(roomCode).emit('game_started', {
    players: sanitizePlayers(shuffled),
    currentPlayer: sanitizePlayer(shuffled[0]),
    pot: freshGame.pot,
  });

  console.log(`🎮 Game ${roomCode} started — ${realPlayers.length} real + ${(roomState.botPlayers || []).filter(b => b.status === 'active').length} bots`);
  startTurnTimer(roomCode, io);
}

function startTurnTimer(roomCode, io) {
  const roomState = rooms.get(roomCode);
  if (!roomState) return;

  clearTurnTimer(roomState);
  roomState.turnSecondsLeft = 10;
  roomState.turnToken = (roomState.turnToken || 0) + 1;
  const turnToken = roomState.turnToken;
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

  const game = getGameByRoomCode.get(roomCode);
  if (!game || game.status !== 'active') return;
  const allActive = getActiveSorted(game, roomState);
  const currentPlayer = allActive[roomState.currentPlayerIndex % allActive.length];
  const bot = (roomState.botPlayers || []).find(b => b.id === currentPlayer?.user_id && b.status === 'active');
  if (bot) {
    const min = bot.turnDelayMinMs || 1200;
    const max = bot.turnDelayMaxMs || 7000;
    const delay = Math.min(randomBetween(min, max), 9400);
    setTimeout(() => {
      if (roomState.turnToken !== turnToken) return;
      if (!roomState.turnTimer) return;
      const freshGame = getGameByRoomCode.get(roomCode);
      if (!freshGame || freshGame.status !== 'active') return;
      const freshActive = getActiveSorted(freshGame, roomState);
      const freshCurrent = freshActive[roomState.currentPlayerIndex % freshActive.length];
      if (!freshCurrent || freshCurrent.user_id !== currentPlayer.user_id) return;
      clearTurnTimer(roomState);
      _executeRoll(roomCode, currentPlayer.user_id, currentPlayer.telegram_id, currentPlayer.first_name, freshGame, roomState, io);
    }, delay);
  }
}

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
  roomState.turnToken++;
  return _executeRoll(roomCode, dbUser.id, String(telegramUserId), dbUser.first_name, game, roomState, io);
}

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
    userId,
    telegramId,
    firstName,
    diceResult,
    isEliminated,
    remainingPlayers: sanitizePlayers(remainingPlayers),
    players: sanitizePlayers(displayPlayers),
  });

  if (remainingPlayers.length <= 1) {
    setTimeout(() => {
      const freshGame = getGameByRoomCode.get(roomCode) || game;
      if (remainingPlayers.length === 1) endGame(roomCode, remainingPlayers[0], freshGame, io);
      else {
        io.to(roomCode).emit('game_draw', {});
        updateGameStatus.run({ status: 'finished', id: game.id });
        clearRoomRuntime(roomState);
        rooms.delete(roomCode);
      }
    }, 2500);
    return { diceResult, isEliminated, gameOver: true };
  }

  if (!isEliminated) roomState.currentPlayerIndex = (roomState.currentPlayerIndex + 1) % remainingPlayers.length;
  else roomState.currentPlayerIndex = roomState.currentPlayerIndex % remainingPlayers.length;

  io.to(roomCode).emit('next_turn', {
    currentPlayer: sanitizePlayer(remainingPlayers[roomState.currentPlayerIndex]),
    remainingPlayers: sanitizePlayers(remainingPlayers),
  });

  startTurnTimer(roomCode, io);
  return { diceResult, isEliminated, gameOver: false };
}

function endGame(roomCode, winner, game, io) {
  const freshGame = getGameById.get(game.id);
  if (!freshGame || freshGame.status === 'finished') return;

  const pot = freshGame.pot;
  const houseCut = Math.floor((pot * freshGame.house_fee_percent) / 100);
  const prize = pot - houseCut;
  const isBot = winner.isBot === true;

  if (!isBot) finalizeGameTransaction(game.id, winner.user_id, prize, houseCut);
  else updateGameStatus.run({ status: 'finished', id: game.id });

  io.to(roomCode).emit('game_over', {
    winner: {
      userId: winner.user_id,
      telegramId: winner.telegram_id,
      firstName: winner.first_name,
      username: winner.username || null,
      avatar: sanitizePlayer(winner).avatar,
      avatarColor: sanitizePlayer(winner).avatarColor,
    },
    pot,
    prize,
    houseCut,
  });

  const roomState = rooms.get(roomCode);
  clearRoomRuntime(roomState);
  rooms.delete(roomCode);
}

function handleActiveGameDisconnect(telegramUser, roomCode, io) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) return;

  const game = getGameByRoomCode.get(roomCode);
  if (!game || game.status !== 'active') return;

  const roomState = rooms.get(roomCode);
  if (!roomState) return;

  clearTurnTimer(roomState);
  roomState.turnToken++;
  io.to(roomCode).emit('turn_timer_paused', { userId: dbUser.id });

  if (roomState.reconnectTimers.has(dbUser.id)) clearTimeout(roomState.reconnectTimers.get(dbUser.id));
  const tickKey = `${dbUser.id}_tick`;
  if (roomState.reconnectTimers.has(tickKey)) clearInterval(roomState.reconnectTimers.get(tickKey));

  let secondsLeft = roomState.reconnectSecondsLeft.get(dbUser.id) || 30;
  io.to(roomCode).emit('player_disconnected', { userId: dbUser.id, firstName: dbUser.first_name, secondsLeft });

  const tickInterval = setInterval(() => {
    secondsLeft--;
    roomState.reconnectSecondsLeft.set(dbUser.id, secondsLeft);
    io.to(roomCode).emit('reconnect_tick', { userId: dbUser.id, secondsLeft });
    if (secondsLeft <= 0) clearInterval(tickInterval);
  }, 1000);

  const timeout = setTimeout(() => {
    clearInterval(tickInterval);
    roomState.reconnectTimers.delete(dbUser.id);
    roomState.reconnectTimers.delete(tickKey);
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

    if (remainingPlayers.length === 1) endGame(roomCode, remainingPlayers[0], freshGame, io);
    else if (remainingPlayers.length === 0) {
      updateGameStatus.run({ status: 'finished', id: game.id });
      clearRoomRuntime(roomState);
      rooms.delete(roomCode);
    } else {
      roomState.currentPlayerIndex = roomState.currentPlayerIndex % remainingPlayers.length;
      startTurnTimer(roomCode, io);
    }
  }, secondsLeft * 1000);

  roomState.reconnectTimers.set(dbUser.id, timeout);
  roomState.reconnectTimers.set(tickKey, tickInterval);
}

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
  roomState.reconnectSecondsLeft.delete(dbUser.id);

  const game = getGameByRoomCode.get(roomCode);
  if (game && game.status === 'active' && !roomState.turnTimer) {
    if (io) io.to(roomCode).emit('turn_timer_resumed', { userId: dbUser.id });
    startTurnTimer(roomCode, io);
  }

  return true;
}

function getRoomSnapshot(roomCode, userId) {
  const game = getGameByRoomCode.get(roomCode);
  if (!game) return null;
  const roomState = rooms.get(roomCode) || ensureRoomState(roomCode);
  const players = getDisplayPlayers(game, roomState);
  const activePlayers = getActiveSorted(game, roomState);
  const currentPlayer = activePlayers.length > 0 ? activePlayers[roomState.currentPlayerIndex % activePlayers.length] : null;
  const reconnectSecondsLeft = userId ? (roomState.reconnectSecondsLeft.get(userId) ?? null) : null;

  return {
    game,
    players: sanitizePlayers(players),
    activePlayers: sanitizePlayers(activePlayers),
    currentPlayer: sanitizePlayer(currentPlayer),
    started: roomState.started || false,
    turnSecondsLeft: roomState.turnSecondsLeft ?? 10,
    reconnectSecondsLeft,
  };
}

module.exports = {
  joinGame,
  leaveWaitingRoom,
  leaveActiveGame,
  toggleReady,
  rollDiceForPlayer,
  handleActiveGameDisconnect,
  handleReconnect,
  getRoomSnapshot,
  ensureRoomState,
};
