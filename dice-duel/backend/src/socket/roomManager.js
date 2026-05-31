// backend/src/socket/roomManager.js
const crypto = require('crypto');
const {
  createGame,
  getWaitingGame,
  getGameByRoomCode,
  getGameById,
  getGamePlayers,
  getActivePlayers,
  updateGameStatus,
  joinGameTransaction,
  leaveGameTransaction,
  eliminatePlayer,
  recordTurn,
  finalizeGameTransaction,
  getUserByTelegramId,
  isPlayerInGame,
} = require('../db/queries');

// In-memory room state
const rooms = new Map(); // roomCode -> RoomState

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

    game = createGame.get({
      room_code: roomCode,
      entry_fee: 100,
      house_fee_percent: 10,
      max_players: 6,
    });
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
    });
  }
  return rooms.get(roomCode);
}

function clearTimer(roomState) {
  if (roomState.timer) {
    clearInterval(roomState.timer);
    roomState.timer = null;
  }
}

// ─── Join ────────────────────────────────────────────────────────────────────
function joinGame(telegramUser, io) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) throw new Error('USER_NOT_FOUND');
  if (dbUser.balance < 100) throw new Error('INSUFFICIENT_BALANCE');

  const { game } = getOrCreateWaitingRoom();

  if (isPlayerInGame.get(game.id, dbUser.id)) throw new Error('ALREADY_IN_GAME');

  const currentPlayers = getGamePlayers.all(game.id);
  const seatOrder = currentPlayers.length;

  joinGameTransaction(dbUser.id, game.id, game.entry_fee, seatOrder);

  const updatedGame = getGameById.get(game.id);
  const allPlayers = getGamePlayers.all(game.id);
  const roomState = ensureRoomState(game.room_code);
  const playerCount = allPlayers.length;

  io.to(game.room_code).emit('player_joined', {
    players: allPlayers,
    pot: updatedGame.pot,
    playerCount,
  });

  // Start countdown only if ≥2 players and no timer yet
  if (playerCount >= 2 && !roomState.timer && !roomState.started) {
    startCountdown(game.room_code, io);
  }

  // Auto-start if room full
  if (playerCount >= game.max_players && !roomState.started) {
    clearTimer(roomState);
    startGame(game.room_code, io);
  }

  return { game: updatedGame, players: allPlayers, user: dbUser };
}

// ─── Leave (waiting room only) ───────────────────────────────────────────────
function leaveGame(telegramUser, io) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) throw new Error('USER_NOT_FOUND');

  // Find the waiting game this user is in
  // We scan all waiting games via the DB join
  const { db } = require('../db/queries');
  const row = db.prepare(`
    SELECT g.*, gp.user_id
    FROM games g
    JOIN game_players gp ON gp.game_id = g.id
    WHERE g.status = 'waiting' AND gp.user_id = ?
    LIMIT 1
  `).get(dbUser.id);

  if (!row) throw new Error('NOT_IN_WAITING_ROOM');

  const gameId = row.id;
  const roomCode = row.room_code;
  const entryFee = row.entry_fee;

  // Refund and remove
  leaveGameTransaction(dbUser.id, gameId, entryFee);

  const remainingPlayers = getGamePlayers.all(gameId);
  const updatedGame = getGameById.get(gameId);
  const roomState = rooms.get(roomCode);

  // Always stop the countdown when someone leaves
  if (roomState) {
    clearTimer(roomState);
  }

  // If still ≥2 players, restart countdown fresh
  if (remainingPlayers.length >= 2) {
    startCountdown(roomCode, io);
  } else {
    // <2 players — broadcast countdown_stopped so UI shows "waiting"
    io.to(roomCode).emit('countdown_stopped', {});
  }

  io.to(roomCode).emit('player_left', {
    userId: dbUser.id,
    firstName: dbUser.first_name,
    players: remainingPlayers,
    pot: updatedGame.pot,
    playerCount: remainingPlayers.length,
  });

  return { user: dbUser, roomCode };
}

// ─── Countdown ───────────────────────────────────────────────────────────────
function startCountdown(roomCode, io) {
  const roomState = ensureRoomState(roomCode);
  // Clear any existing timer first (safety)
  clearTimer(roomState);

  let secondsLeft = 60;
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

// ─── Start game ───────────────────────────────────────────────────────────────
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
}

// ─── Roll dice ────────────────────────────────────────────────────────────────
function rollDiceForPlayer(roomCode, telegramUserId, io) {
  const game = getGameByRoomCode.get(roomCode);
  if (!game || game.status !== 'active') throw new Error('GAME_NOT_ACTIVE');

  const dbUser = getUserByTelegramId.get(String(telegramUserId));
  if (!dbUser) throw new Error('USER_NOT_FOUND');

  const roomState = rooms.get(roomCode);
  if (!roomState) throw new Error('ROOM_NOT_FOUND');

  const activePlayers = getActivePlayers.all(game.id);
  if (activePlayers.length === 0) throw new Error('NO_ACTIVE_PLAYERS');

  const currentPlayer = activePlayers[roomState.currentPlayerIndex % activePlayers.length];
  if (!currentPlayer || currentPlayer.user_id !== dbUser.id) throw new Error('NOT_YOUR_TURN');

  const diceResult = rollDice();
  const isEliminated = diceResult === 1;

  recordTurn.run({
    game_id: game.id,
    user_id: dbUser.id,
    dice_result: diceResult,
    was_eliminated: isEliminated ? 1 : 0,
  });

  if (isEliminated) {
    eliminatePlayer.run({ game_id: game.id, user_id: dbUser.id });
  }

  const remainingPlayers = getActivePlayers.all(game.id);

  io.to(roomCode).emit('dice_rolled', {
    userId: dbUser.id,
    telegramId: String(telegramUserId),
    firstName: dbUser.first_name,
    diceResult,
    isEliminated,
    remainingPlayers,
  });

  if (remainingPlayers.length === 1) {
    endGame(roomCode, remainingPlayers[0], game, io);
    return { diceResult, isEliminated, gameOver: true };
  }

  if (remainingPlayers.length === 0) {
    io.to(roomCode).emit('game_draw', {});
    updateGameStatus.run({ status: 'finished', id: game.id });
    rooms.delete(roomCode);
    return { diceResult, isEliminated, gameOver: true };
  }

  if (!isEliminated) {
    roomState.currentPlayerIndex = (roomState.currentPlayerIndex + 1) % remainingPlayers.length;
  } else {
    roomState.currentPlayerIndex = roomState.currentPlayerIndex % remainingPlayers.length;
  }

  io.to(roomCode).emit('next_turn', {
    currentPlayer: remainingPlayers[roomState.currentPlayerIndex],
    remainingPlayers,
  });

  return { diceResult, isEliminated, gameOver: false };
}

// ─── End game ─────────────────────────────────────────────────────────────────
function endGame(roomCode, winner, game, io) {
  const freshGame = getGameById.get(game.id);
  const pot = freshGame.pot;
  const houseCut = Math.floor((pot * freshGame.house_fee_percent) / 100);
  const prize = pot - houseCut;

  finalizeGameTransaction(game.id, winner.user_id, prize, houseCut);

  io.to(roomCode).emit('game_over', {
    winner: {
      userId: winner.user_id,
      telegramId: winner.telegram_id,
      firstName: winner.first_name,
      username: winner.username,
    },
    pot,
    prize,
    houseCut,
  });

  console.log(`🏆 Game ${roomCode} won by ${winner.first_name} — prize: ${prize}`);

  const roomState = rooms.get(roomCode);
  if (roomState) clearTimer(roomState);
  rooms.delete(roomCode);
}

// ─── Snapshot (reconnect) ────────────────────────────────────────────────────
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

  return { game, players, activePlayers, currentPlayer, started: roomState?.started || false };
}

module.exports = { joinGame, leaveGame, rollDiceForPlayer, getRoomSnapshot, ensureRoomState };
