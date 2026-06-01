// backend/src/socket/roomManager.js
const crypto = require('crypto');
const {
  createGame, getWaitingGame, getGameByRoomCode, getGameById,
  getGamePlayers, getActivePlayers, updateGameStatus,
  joinGameTransaction, leaveGameTransaction,
  eliminatePlayer, recordTurn, finalizeGameTransaction,
  getUserByTelegramId, isPlayerInGame,
} = require('../db/queries');

const { db } = require('../db/queries');

// ─── In-memory state ──────────────────────────────────────────────────────────
// roomCode -> {
//   timer, currentPlayerIndex, started,
//   turnTimer, turnSecondsLeft,
//   reconnectTimers: Map<userId, timeoutId>
// }
const rooms = new Map();

function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

function getOrCreateWaitingRoom() {
  let game = getWaitingGame.get();
  if (!game) {
    let roomCode;
    do { roomCode = generateRoomCode(); }
    while (getGameByRoomCode.get(roomCode));
    game = createGame.get({ room_code: roomCode, entry_fee: 100, house_fee_percent: 10, max_players: 6 });
  }
  return { game };
}

function ensureRoomState(roomCode) {
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, {
      roomCode,
      timer: null,
      countdownSecondsLeft: 60,   // FIX #1: track current lobby countdown
      currentPlayerIndex: 0,
      started: false,
      turnTimer: null,
      turnSecondsLeft: 10,
      reconnectTimers: new Map(),
      reconnectSecondsLeft: new Map(), // FIX #3: remember time remaining per user
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

// ─── JOIN ─────────────────────────────────────────────────────────────────────
function joinGame(telegramUser, io) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) throw new Error('USER_NOT_FOUND');
  if (dbUser.balance < 100) throw new Error('INSUFFICIENT_BALANCE');

  const { game } = getOrCreateWaitingRoom();
  if (isPlayerInGame.get(game.id, dbUser.id)) throw new Error('ALREADY_IN_GAME');

  const currentPlayers = getGamePlayers.all(game.id);
  joinGameTransaction(dbUser.id, game.id, game.entry_fee, currentPlayers.length);

  const updatedGame = getGameById.get(game.id);
  const allPlayers = getGamePlayers.all(game.id);
  const roomState = ensureRoomState(game.room_code);
  const playerCount = allPlayers.length;

  io.to(game.room_code).emit('player_joined', { players: allPlayers, pot: updatedGame.pot, playerCount });

  if (playerCount >= 2 && !roomState.timer && !roomState.started) {
    startCountdown(game.room_code, io);
  }
  if (playerCount >= game.max_players && !roomState.started) {
    clearTimer(roomState);
    startGame(game.room_code, io);
  }

  // FIX #1: tell the joining player the current countdown state
  const countdownActive = roomState.timer !== null;
  return {
    game: updatedGame, players: allPlayers, user: dbUser,
    countdownActive,
    countdownSecondsLeft: roomState.countdownSecondsLeft,
  };
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

  const remainingPlayers = getGamePlayers.all(row.id);
  const updatedGame = getGameById.get(row.id);
  const roomState = rooms.get(row.room_code);

  if (roomState) clearTimer(roomState);

  if (remainingPlayers.length >= 2) {
    startCountdown(row.room_code, io);
  } else {
    io.to(row.room_code).emit('countdown_stopped', {});
  }

  io.to(row.room_code).emit('player_left', {
    userId: dbUser.id,
    firstName: dbUser.first_name,
    players: remainingPlayers,
    pot: updatedGame.pot,
    playerCount: remainingPlayers.length,
  });

  return { user: dbUser, roomCode: row.room_code, refunded: row.entry_fee };
}

// ─── DISCONNECT DURING ACTIVE GAME — 30s reconnect window ────────────────────
function handleActiveGameDisconnect(telegramUser, roomCode, io) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) return;

  const game = getGameByRoomCode.get(roomCode);
  if (!game || game.status !== 'active') return;

  const roomState = rooms.get(roomCode);
  if (!roomState) return;

  // Cancel any existing reconnect timer for this user (they disconnected again)
  if (roomState.reconnectTimers.has(dbUser.id)) {
    clearTimeout(roomState.reconnectTimers.get(dbUser.id));
    roomState.reconnectTimers.delete(dbUser.id);
  }
  const tickKey = `${dbUser.id}_tick`;
  if (roomState.reconnectTimers.has(tickKey)) {
    clearInterval(roomState.reconnectTimers.get(tickKey));
    roomState.reconnectTimers.delete(tickKey);
  }

  // FIX #3: resume from saved seconds, or start fresh at 30
  const savedSeconds = roomState.reconnectSecondsLeft.get(dbUser.id);
  let secondsLeft = (savedSeconds && savedSeconds > 0) ? savedSeconds : 30; // FIX #2: 30s

  io.to(roomCode).emit('player_disconnected', {
    userId: dbUser.id,
    firstName: dbUser.first_name,
    secondsLeft,
  });

  const tickInterval = setInterval(() => {
    secondsLeft--;
    // FIX #3: save current seconds so we can resume if they reconnect+disconnect again
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

    const remainingPlayers = getActivePlayers.all(game.id);
    io.to(roomCode).emit('player_abandoned', {
      userId: dbUser.id,
      firstName: dbUser.first_name,
      remainingPlayers,
    });

    if (remainingPlayers.length === 1) {
      clearTurnTimer(roomState);
      endGame(roomCode, remainingPlayers[0], freshGame, io);
    } else if (remainingPlayers.length === 0) {
      updateGameStatus.run({ status: 'finished', id: game.id });
      rooms.delete(roomCode);
    } else {
      roomState.currentPlayerIndex = roomState.currentPlayerIndex % remainingPlayers.length;
      clearTurnTimer(roomState);
      startTurnTimer(roomCode, io);
    }
  }, secondsLeft * 1000);

  roomState.reconnectTimers.set(dbUser.id, timeout);
  roomState.reconnectTimers.set(tickKey, tickInterval);
}

// ─── RECONNECT during active game ────────────────────────────────────────────
function handleReconnect(telegramUser, roomCode) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) return false;

  const roomState = rooms.get(roomCode);
  if (!roomState) return false;

  // Cancel the abandon timeout
  if (roomState.reconnectTimers.has(dbUser.id)) {
    clearTimeout(roomState.reconnectTimers.get(dbUser.id));
    roomState.reconnectTimers.delete(dbUser.id);
  }
  // Cancel tick interval
  const tickKey = `${dbUser.id}_tick`;
  if (roomState.reconnectTimers.has(tickKey)) {
    clearInterval(roomState.reconnectTimers.get(tickKey));
    roomState.reconnectTimers.delete(tickKey);
  }
  // FIX #3: DON'T clear reconnectSecondsLeft here — keep it so if they disconnect
  // again on the same turn, the timer resumes from where it stopped.
  // It gets cleared only when they actually roll (in _executeRoll).

  return true;
}

// Called from _executeRoll to reset saved reconnect seconds after a successful roll
function clearReconnectSeconds(userId, roomCode) {
  const roomState = rooms.get(roomCode);
  if (roomState) roomState.reconnectSecondsLeft.delete(userId);
}

// ─── LOBBY COUNTDOWN ─────────────────────────────────────────────────────────
function startCountdown(roomCode, io) {
  const roomState = ensureRoomState(roomCode);
  clearTimer(roomState);

  let secondsLeft = 60;
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

  const players = getActivePlayers.all(game.id);
  if (players.length < 2) {
    io.to(roomCode).emit('game_cancelled', { reason: 'Not enough players' });
    return;
  }

  const roomState = ensureRoomState(roomCode);
  roomState.started = true;
  roomState.currentPlayerIndex = 0;

  updateGameStatus.run({ status: 'active', id: game.id });

  io.to(roomCode).emit('game_started', {
    players,
    currentPlayer: players[0],
    pot: game.pot,
  });

  console.log(`🎮 Game ${roomCode} started with ${players.length} players`);

  // Start the first turn timer
  startTurnTimer(roomCode, io);
}

// ─── TURN TIMER (10s auto-roll) ───────────────────────────────────────────────
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
      // Auto-roll for the current player
      const game = getGameByRoomCode.get(roomCode);
      if (!game || game.status !== 'active') return;
      const activePlayers = getActivePlayers.all(game.id);
      if (!activePlayers.length) return;
      const currentPlayer = activePlayers[roomState.currentPlayerIndex % activePlayers.length];
      if (!currentPlayer) return;

      console.log(`⏰ Auto-rolling for ${currentPlayer.first_name} in room ${roomCode}`);
      _executeRoll(roomCode, currentPlayer.user_id, currentPlayer.telegram_id, currentPlayer.first_name, game, roomState, io);
    }
  }, 1000);
}

// ─── ROLL DICE (called by player or auto-timer) ───────────────────────────────
function rollDiceForPlayer(roomCode, telegramUserId, io) {
  const game = getGameByRoomCode.get(roomCode);
  if (!game || game.status !== 'active') throw new Error('GAME_NOT_ACTIVE');

  const dbUser = getUserByTelegramId.get(String(telegramUserId));
  if (!dbUser) throw new Error('USER_NOT_FOUND');

  const roomState = rooms.get(roomCode);
  if (!roomState) throw new Error('ROOM_NOT_FOUND');

  const activePlayers = getActivePlayers.all(game.id);
  if (!activePlayers.length) throw new Error('NO_ACTIVE_PLAYERS');

  const currentPlayer = activePlayers[roomState.currentPlayerIndex % activePlayers.length];
  if (!currentPlayer || currentPlayer.user_id !== dbUser.id) throw new Error('NOT_YOUR_TURN');

  clearTurnTimer(roomState);
  return _executeRoll(roomCode, dbUser.id, String(telegramUserId), dbUser.first_name, game, roomState, io);
}

// ─── CORE ROLL LOGIC ─────────────────────────────────────────────────────────
function _executeRoll(roomCode, userId, telegramId, firstName, game, roomState, io) {
  // FIX #3: player rolled successfully — clear their saved reconnect seconds
  roomState.reconnectSecondsLeft.delete(userId);
  const diceResult = rollDice();
  const isEliminated = diceResult === 1;

  recordTurn.run({ game_id: game.id, user_id: userId, dice_result: diceResult, was_eliminated: isEliminated ? 1 : 0 });
  if (isEliminated) eliminatePlayer.run({ game_id: game.id, user_id: userId });

  const remainingPlayers = getActivePlayers.all(game.id);

  io.to(roomCode).emit('dice_rolled', {
    userId, telegramId, firstName, diceResult, isEliminated, remainingPlayers,
  });

  // FIX #3: delay end-of-game by 2.5s so players see the final dice result
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

  // Advance turn index
  if (!isEliminated) {
    roomState.currentPlayerIndex = (roomState.currentPlayerIndex + 1) % remainingPlayers.length;
  } else {
    roomState.currentPlayerIndex = roomState.currentPlayerIndex % remainingPlayers.length;
  }

  io.to(roomCode).emit('next_turn', {
    currentPlayer: remainingPlayers[roomState.currentPlayerIndex],
    remainingPlayers,
  });

  // Start next turn timer
  startTurnTimer(roomCode, io);

  return { diceResult, isEliminated, gameOver: false };
}

// ─── END GAME ─────────────────────────────────────────────────────────────────
function endGame(roomCode, winner, game, io) {
  const freshGame = getGameById.get(game.id);
  if (!freshGame || freshGame.status === 'finished') return; // guard double-call

  const pot = freshGame.pot;
  const houseCut = Math.floor((pot * freshGame.house_fee_percent) / 100);
  const prize = pot - houseCut;

  finalizeGameTransaction(game.id, winner.user_id, prize, houseCut);

  io.to(roomCode).emit('game_over', {
    winner: { userId: winner.user_id, telegramId: winner.telegram_id, firstName: winner.first_name, username: winner.username },
    pot, prize, houseCut,
  });

  console.log(`🏆 Game ${roomCode} won by ${winner.first_name} — prize: ${prize}`);

  const roomState = rooms.get(roomCode);
  if (roomState) { clearTimer(roomState); clearTurnTimer(roomState); }
  rooms.delete(roomCode);
}

// ─── SNAPSHOT ────────────────────────────────────────────────────────────────
function getRoomSnapshot(roomCode, userId) {
  const game = getGameByRoomCode.get(roomCode);
  if (!game) return null;
  const players = getGamePlayers.all(game.id);
  const activePlayers = getActivePlayers.all(game.id);
  const roomState = rooms.get(roomCode);
  let currentPlayer = null;
  if (roomState && activePlayers.length > 0) {
    currentPlayer = activePlayers[roomState.currentPlayerIndex % activePlayers.length];
  }
  // Tell this user their remaining reconnect window (if any)
  const reconnectSecondsLeft = userId && roomState
    ? (roomState.reconnectSecondsLeft.get(userId) ?? null)
    : null;
  return {
    game, players, activePlayers, currentPlayer,
    started: roomState?.started || false,
    turnSecondsLeft: roomState?.turnSecondsLeft ?? 10,
    reconnectSecondsLeft,
  };
}

module.exports = {
  joinGame, leaveWaitingRoom, rollDiceForPlayer,
  handleActiveGameDisconnect, handleReconnect,
  getRoomSnapshot, ensureRoomState,
};
