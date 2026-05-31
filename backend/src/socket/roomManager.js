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
  eliminatePlayer,
  recordTurn,
  finalizeGameTransaction,
  countActivePlayers,
  getUserByTelegramId,
  isPlayerInGame,
} = require('../db/queries');

// In-memory room state (augments DB)
const rooms = new Map(); // roomCode -> RoomState

function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function rollDice() {
  // CRITICAL: dice rolled server-side only
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Get or create waiting room.
 * Returns { game, isNew }
 */
function getOrCreateWaitingRoom() {
  let game = getWaitingGame.get();
  let isNew = false;
  if (!game) {
    let roomCode;
    do {
      roomCode = generateRoomCode();
    } while (getGameByRoomCode.get(roomCode));

    game = createGame.get({
      room_code: roomCode,
      entry_fee: 100,
      house_fee_percent: 10,
      max_players: 6,
    });
    isNew = true;
  }
  return { game, isNew };
}

/**
 * Initialize in-memory state for a room.
 */
function ensureRoomState(roomCode) {
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, {
      roomCode,
      timer: null,
      currentPlayerIndex: 0,
      turnTimer: null,
      started: false,
    });
  }
  return rooms.get(roomCode);
}

/**
 * Join a player to a game.
 */
function joinGame(telegramUser, io) {
  const dbUser = getUserByTelegramId.get(String(telegramUser.id));
  if (!dbUser) throw new Error('USER_NOT_FOUND');
  if (dbUser.balance < 100) throw new Error('INSUFFICIENT_BALANCE');

  // Find or create a waiting room
  const { game } = getOrCreateWaitingRoom();

  // Prevent duplicate join
  if (isPlayerInGame.get(game.id, dbUser.id)) {
    throw new Error('ALREADY_IN_GAME');
  }

  // Get current player count for seat_order
  const currentPlayers = getGamePlayers.all(game.id);
  const seatOrder = currentPlayers.length;

  // Deduct balance and add to room (transaction)
  joinGameTransaction(dbUser.id, game.id, game.entry_fee, seatOrder);

  // Re-fetch game with updated pot
  const updatedGame = getGameById.get(game.id);
  const allPlayers = getGamePlayers.all(game.id);
  const roomState = ensureRoomState(game.room_code);

  const playerCount = allPlayers.length;

  // Broadcast to room
  io.to(game.room_code).emit('player_joined', {
    players: allPlayers,
    pot: updatedGame.pot,
    playerCount,
  });

  // Start countdown if we have ≥2 players and no timer running
  if (playerCount >= 2 && !roomState.timer && !roomState.started) {
    startCountdown(game.room_code, io);
  }

  // Auto-start if room full (6 players)
  if (playerCount >= game.max_players && !roomState.started) {
    clearTimer(roomState);
    startGame(game.room_code, io);
  }

  return { game: updatedGame, players: allPlayers, user: dbUser };
}

/**
 * Start 60-second countdown to game start.
 */
function startCountdown(roomCode, io) {
  const roomState = ensureRoomState(roomCode);
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

function clearTimer(roomState) {
  if (roomState.timer) {
    clearInterval(roomState.timer);
    roomState.timer = null;
  }
}

/**
 * Start the game.
 */
function startGame(roomCode, io) {
  const game = getGameByRoomCode.get(roomCode);
  if (!game || game.status !== 'waiting') return;

  const players = getActivePlayers.all(game.id);
  if (players.length < 2) {
    // Not enough players — reset
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

/**
 * Handle a player rolling the dice.
 */
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
  if (!currentPlayer || currentPlayer.user_id !== dbUser.id) {
    throw new Error('NOT_YOUR_TURN');
  }

  // Roll dice — server-side only!
  const diceResult = rollDice();
  const isEliminated = diceResult === 1;

  // Record the turn
  recordTurn.run({
    game_id: game.id,
    user_id: dbUser.id,
    dice_result: diceResult,
    was_eliminated: isEliminated ? 1 : 0,
  });

  if (isEliminated) {
    eliminatePlayer.run({ game_id: game.id, user_id: dbUser.id });
  }

  // Re-fetch active players after potential elimination
  const remainingPlayers = getActivePlayers.all(game.id);

  io.to(roomCode).emit('dice_rolled', {
    userId: dbUser.id,
    telegramId: String(telegramUserId),
    firstName: dbUser.first_name,
    diceResult,
    isEliminated,
    remainingPlayers,
  });

  // Check for winner
  if (remainingPlayers.length === 1) {
    const winner = remainingPlayers[0];
    endGame(roomCode, winner, game, io);
    return { diceResult, isEliminated, gameOver: true };
  }

  if (remainingPlayers.length === 0) {
    // Edge case: last two players both got 1 (shouldn't happen in current rules)
    io.to(roomCode).emit('game_draw', {});
    updateGameStatus.run({ status: 'finished', id: game.id });
    rooms.delete(roomCode);
    return { diceResult, isEliminated, gameOver: true };
  }

  // Advance to next player
  if (!isEliminated) {
    // Move to next seat
    roomState.currentPlayerIndex = (roomState.currentPlayerIndex + 1) % remainingPlayers.length;
  } else {
    // Player was eliminated; currentIndex might need adjustment
    const newIndex = roomState.currentPlayerIndex % remainingPlayers.length;
    roomState.currentPlayerIndex = newIndex;
  }

  const nextPlayer = remainingPlayers[roomState.currentPlayerIndex];
  io.to(roomCode).emit('next_turn', {
    currentPlayer: nextPlayer,
    remainingPlayers,
  });

  return { diceResult, isEliminated, gameOver: false };
}

/**
 * End the game and pay out winner.
 */
function endGame(roomCode, winner, game, io) {
  const freshGame = getGameById.get(game.id);
  const pot = freshGame.pot;
  const houseFeePercent = freshGame.house_fee_percent;
  const houseCut = Math.floor((pot * houseFeePercent) / 100);
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

  console.log(`🏆 Game ${roomCode} won by ${winner.first_name} — prize: ${prize} credits`);

  // Clean up in-memory state
  const roomState = rooms.get(roomCode);
  if (roomState) clearTimer(roomState);
  rooms.delete(roomCode);
}

/**
 * Get snapshot of a room for reconnecting clients.
 */
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
    game,
    players,
    activePlayers,
    currentPlayer,
    started: roomState?.started || false,
  };
}

module.exports = {
  joinGame,
  rollDiceForPlayer,
  getRoomSnapshot,
  ensureRoomState,
};
