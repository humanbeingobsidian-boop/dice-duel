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
      currentPlayerIndex: 0,
      started: false,
      turnTimer: null,
      turnSecondsLeft: 10,
      reconnectTimers: new Map(),
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

  return { game: updatedGame, players: allPlayers, user: dbUser };
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

// ─── DISCONNECT DURING ACTIVE GAME — 10s reconnect window ────────────────────
function handleActiveGameDisconnect(telegramUser, roomCode, io) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) return;

  const game = getGameByRoomCode.get(roomCode);
  if (!game || game.status !== 'active') return;

  const roomState = rooms.get(roomCode);
  if (!roomState) return;

  // Cancel any existing reconnect timer for this user
  if (roomState.reconnectTimers.has(dbUser.id)) {
    clearTimeout(roomState.reconnectTimers.get(dbUser.id));
  }

  let secondsLeft = 10;
  // Tell everyone this player disconnected and has 10s
  io.to(roomCode).emit('player_disconnected', {
    userId: dbUser.id,
    firstName: dbUser.first_name,
    secondsLeft,
  });

  // Countdown tick to everyone
  const tickInterval = setInterval(() => {
    secondsLeft--;
    io.to(roomCode).emit('reconnect_tick', { userId: dbUser.id, secondsLeft });
    if (secondsLeft <= 0) clearInterval(tickInterval);
  }, 1000);

  // After 10s — eliminate the player for abandoning
  const timeout = setTimeout(() => {
    clearInterval(tickInterval);
    roomState.reconnectTimers.delete(dbUser.id);

    // Re-check game is still active
    const freshGame = getGameByRoomCode.get(roomCode);
    if (!freshGame || freshGame.status !== 'active') return;

    // Eliminate them
    eliminatePlayer.run({ game_id: game.id, user_id: dbUser.id });
    recordTurn.run({ game_id: game.id, user_id: dbUser.id, dice_result: 0, was_eliminated: 1 });

    const remainingPlayers = getActivePlayers.all(game.id);
    io.to(roomCode).emit('player_abandoned', {
      userId: dbUser.id,
      firstName: dbUser.first_name,
      remainingPlayers,
    });

    if (remainingPlayers.length === 1) {
      // Clear turn timer and end game
      clearTurnTimer(roomState);
      endGame(roomCode, remainingPlayers[0], freshGame, io);
    } else if (remainingPlayers.length === 0) {
      updateGameStatus.run({ status: 'finished', id: game.id });
      rooms.delete(roomCode);
    } else {
      // Adjust index and start next turn timer
      roomState.currentPlayerIndex = roomState.currentPlayerIndex % remainingPlayers.length;
      clearTurnTimer(roomState);
      startTurnTimer(roomCode, io);
    }
  }, 10000);

  roomState.reconnectTimers.set(dbUser.id, timeout);
  // Store tick interval so we can clear it on reconnect
  roomState.reconnectTimers.set(`${dbUser.id}_tick`, tickInterval);
}

// ─── RECONNECT during active game ────────────────────────────────────────────
function handleReconnect(telegramUser, roomCode) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) return false;

  const roomState = rooms.get(roomCode);
  if (!roomState) return false;

  // Cancel the abandon timer
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

  return true;
}

// ─── LOBBY COUNTDOWN ─────────────────────────────────────────────────────────
function startCountdown(roomCode, io) {
  const roomState = ensureRoomState(roomCode);
  clearTimer(roomState);

  let secondsLeft = 60;
  // FIX #1: emit immediately so all clients sync
  io.to(roomCode).emit('countdown_started', { secondsLeft });

  roomState.timer = setInterval(() => {
    secondsLeft--;
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
function getRoomSnapshot(roomCode) {
  const game = getGameByRoomCode.get(roomCode);
  if (!game) return null;
  const players = getGamePlayers.all(game.id);
  const activePlayers = getActivePlayers.all(game.id);
  const roomState = rooms.get(roomCode);
  let currentPlayer = null;
  if (roomState && activePlayers.length > 0) {
    currentPlayer = activePlayers[roomState.currentPlayerIndex % activePlayers.length];
  }
  return {
    game, players, activePlayers, currentPlayer,
    started: roomState?.started || false,
    turnSecondsLeft: roomState?.turnSecondsLeft ?? 10,
  };
}

module.exports = {
  joinGame, leaveWaitingRoom, rollDiceForPlayer,
  handleActiveGameDisconnect, handleReconnect,
  getRoomSnapshot, ensureRoomState,
};
