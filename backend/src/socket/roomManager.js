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
const { createBotPlayer, randomBotCount } = require('./botPlayers'); // חלק 1

// ─── In-memory state ──────────────────────────────────────────────────────────
const rooms = new Map();

function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
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
      botPlayers: [],        // חלק 1: רשימת בוטים in-memory
      botsScheduled: false,  // חלק 1: מניעת כפילות
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
  const allPlayers = getGamePlayers.all(game.id);
  const roomState = ensureRoomState(game.room_code);
  const playerCount = allPlayers.length;

  // FIX #2: כלול בוטים קיימים ברשימה שנשלחת לשחקן שהצטרף
  const botsAlreadyInRoom = roomState.botPlayers || [];
  const allPlayersWithBots = buildMergedPlayers(allPlayers, botsAlreadyInRoom);

  io.to(game.room_code).emit('player_joined', {
    players: allPlayersWithBots,
    pot: updatedGame.pot,
    playerCount: allPlayersWithBots.length,
  });

  if (playerCount >= 2 && !roomState.timer && !roomState.started) {
    startCountdown(game.room_code, io);
  }
  if (playerCount >= game.max_players && !roomState.started) {
    clearTimer(roomState);
    startGame(game.room_code, io);
  }

  // ─── Push notification: זמנית מבוטל ──────────────────────────────────────
  // if (playerCount === 1) {
  //   setTimeout(() => {
  //     const currentGame = getGameById.get(updatedGame.id);
  //     if (!currentGame || currentGame.status !== 'waiting') return;
  //     sendPushToWaitingPlayers(game.room_code, game.entry_fee);
  //   }, 30000);
  // }

  // ─── חלק 1: תזמן כניסת בוטים ────────────────────────────────────────────
  scheduleBotJoins(game.room_code, game.entry_fee, io);

  const countdownActive = roomState.timer !== null;
  return {
    game: updatedGame, players: allPlayersWithBots, user: dbUser,
    countdownActive,
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

// ─── חלק 1: SCHEDULE BOT JOINS ───────────────────────────────────────────────
function scheduleBotJoins(roomCode, entryFee, io) {
  const roomState = ensureRoomState(roomCode);
  if (roomState.started) return;
  if (roomState.botsScheduled) return;
  roomState.botsScheduled = true;

  const botCount = randomBotCount(); // 2-5
  let delay = 3000; // הבוט הראשון נכנס אחרי 3 שניות

  for (let i = 0; i < botCount; i++) {
    setTimeout(() => {
      const currentGame = getGameByRoomCode.get(roomCode);
      if (!currentGame || currentGame.status !== 'waiting') return;

      const realPlayers = getGamePlayers.all(currentGame.id);
      const totalCount = realPlayers.length + roomState.botPlayers.length;

      // אל תוסיף יותר מ-6
      if (totalCount >= currentGame.max_players) return;
      if (roomState.started) return;

      const bot = createBotPlayer();
      roomState.botPlayers.push({
        ...bot,
        seat_order: totalCount,
        status: 'active',
      });

      // הוסף את דמי הכניסה של הבוט לקופה
      db.prepare(`UPDATE games SET pot = pot + ? WHERE id = ?`).run(currentGame.entry_fee, currentGame.id);
      const freshGame = getGameById.get(currentGame.id);

      // בנה רשימת שחקנים מאוחדת (אמיתיים + בוטים) לשליחה ל-UI
      const allPlayers = buildMergedPlayers(realPlayers, roomState.botPlayers);

      io.to(roomCode).emit('player_joined', {
        players: allPlayers,
        pot: freshGame.pot,
        playerCount: allPlayers.length,
      });

      console.log(`Room ${roomCode}: ${allPlayers.length}/6 players`);

      // בוט לוחץ Ready אחרי שנייה אחת
      setTimeout(() => {
        if (roomState.started) return;
        roomState.readyPlayers.add(bot.id);
        const realP = getGamePlayers.all(currentGame.id).filter(p => p.status === 'active');
        const allP  = buildMergedPlayers(realP, roomState.botPlayers);
        const readyCount = allP.filter(p => roomState.readyPlayers.has(p.user_id)).length;
        io.to(roomCode).emit('ready_updated', {
          readyUserIds: Array.from(roomState.readyPlayers),
          readyCount,
          totalCount: allP.length,
        });
        // אם כולם מוכנים — התחל מיד
        if (allP.length >= 2 && readyCount === allP.length && !roomState.started) {
          clearTimer(roomState);
          io.to(roomCode).emit('all_ready', {});
          setTimeout(() => startGame(roomCode, io), 1500);
        }
      }, 1000);

      // אם הגענו ל-6 — התחל מיד
      if (allPlayers.length >= currentGame.max_players && !roomState.started) {
        clearTimer(roomState);
        startGame(roomCode, io);
      }
    }, delay);

    delay += Math.floor(Math.random() * 2000) + 1000; // 1-3 שניות בין בוט לבוט
  }

  // אחרי שכל הבוטים נכנסו — הפעל טיימר 60 שניות אם עדיין לא רץ
  setTimeout(() => {
    const currentGame = getGameByRoomCode.get(roomCode);
    if (!currentGame || currentGame.status !== 'waiting') return;
    const roomSt = rooms.get(roomCode);
    if (roomSt && !roomSt.started && !roomSt.timer) {
      startCountdown(roomCode, io);
    }
  }, delay + 500);
}

// ─── Helper: מאחד שחקנים אמיתיים + בוטים לפורמט אחיד ───────────────────────
function buildMergedPlayers(realPlayers, botPlayers) {
  return [
    ...realPlayers,
    ...botPlayers.map(b => ({
      user_id: b.id,
      telegram_id: b.telegram_id,
      first_name: b.first_name,
      username: null,
      status: b.status || 'active',
      isBot: true,
    })),
  ];
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

  const allPlayers = getGamePlayers.all(game.id);
  const activePlayers = allPlayers.filter(p => p.status === 'active');
  const readyCount = activePlayers.filter(p => roomState.readyPlayers.has(p.user_id)).length;
  const readyUserIds = Array.from(roomState.readyPlayers);

  io.to(roomCode).emit('ready_updated', { readyUserIds, readyCount, totalCount: activePlayers.length });

  if (activePlayers.length >= 2 && readyCount === activePlayers.length) {
    clearTimer(roomState);
    io.to(roomCode).emit('all_ready', {});
    setTimeout(() => startGame(roomCode, io), 1500);
  }

  return { isReady: roomState.readyPlayers.has(userId), readyUserIds };
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

    const remainingPlayers = getActivePlayers.all(game.id);
    io.to(roomCode).emit('player_abandoned', {
      userId: dbUser.id,
      firstName: dbUser.first_name,
      remainingPlayers,
    });

    if (remainingPlayers.length === 1) {
      endGame(roomCode, remainingPlayers[0], freshGame, io);
    } else if (remainingPlayers.length === 0) {
      updateGameStatus.run({ status: 'finished', id: game.id });
      rooms.delete(roomCode);
    } else {
      const activePlayers = getActivePlayers.all(game.id);
      roomState.currentPlayerIndex = roomState.currentPlayerIndex % activePlayers.length;
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

  const realPlayers = getActivePlayers.all(game.id);
  const roomState = ensureRoomState(roomCode);
  const botPlayers = roomState.botPlayers || [];

  if (realPlayers.length + botPlayers.length < 2) {
    io.to(roomCode).emit('game_cancelled', { reason: 'Not enough players' });
    return;
  }

  roomState.started = true;
  roomState.currentPlayerIndex = 0;

  updateGameStatus.run({ status: 'active', id: game.id });

  // FIX #1: ערבב סדר רנדומלי ושמור אותו ב-roomState
  const allPlayers = buildMergedPlayers(realPlayers, botPlayers);
  const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
  roomState.playerOrder = shuffled; // שמור את הסדר הרנדומלי

  const freshGameForStart = getGameById.get(game.id);
  io.to(roomCode).emit('game_started', {
    players: shuffled,
    currentPlayer: shuffled[0],
    pot: freshGameForStart.pot,
  });

  console.log(`🎮 Game ${roomCode} started — ${realPlayers.length} real + ${botPlayers.length} bots`);

  startTurnTimer(roomCode, io);
}

// ─── Helper: get active players in original shuffled order ───────────────────
function getActiveSorted(game, roomState) {
  const realActive = getActivePlayers.all(game.id);
  const botActive = (roomState.botPlayers || []).filter(b => b.status === 'active');
  const allActive = buildMergedPlayers(realActive, botActive);

  // אם יש playerOrder שמור — מיין לפיו
  if (roomState.playerOrder) {
    return roomState.playerOrder.filter(p =>
      allActive.some(a => a.user_id === p.user_id)
    );
  }
  return allActive;
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

  // אם התור הוא של בוט — זרוק אוטומטית אחרי 1-4 שניות
  const checkBotTurn = () => {
    const game = getGameByRoomCode.get(roomCode);
    if (!game || game.status !== 'active') return;
    const allActive = getActiveSorted(game, roomState);
    if (!allActive.length) return;
    const currentPlayer = allActive[roomState.currentPlayerIndex % allActive.length];
    if (currentPlayer?.isBot) {
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
  } else {
    if (isEliminated) {
      const bot = roomState.botPlayers.find(b => b.id === userId);
      if (bot) bot.status = 'eliminated';
    }
  }

  // רשימת שחקנים פעילים — לפי הסדר הרנדומלי השמור
  const remainingPlayers = getActiveSorted(game, roomState);

  io.to(roomCode).emit('dice_rolled', {
    userId, telegramId, firstName, diceResult, isEliminated, remainingPlayers,
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
    currentPlayer: remainingPlayers[roomState.currentPlayerIndex],
    remainingPlayers,
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
    // שחקן אמיתי ניצח — מקבל את הקופה כולל כסף הבוטים
    finalizeGameTransaction(game.id, winner.user_id, prize, houseCut);
  } else {
    // בוט ניצח — הכסף נשרף
    updateGameStatus.run({ status: 'finished', id: game.id });
  }

  io.to(roomCode).emit('game_over', {
    // לא חושפים שהוא בוט — נראה כמו שחקן רגיל
    winner: {
      userId: winner.user_id,
      telegramId: winner.telegram_id,
      firstName: winner.first_name,
      username: winner.username || null,
    },
    pot,
    prize: isBot ? 0 : prize,
    houseCut: isBot ? pot : houseCut,
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
  const realPlayers = getGamePlayers.all(game.id);
  const roomState = rooms.get(roomCode);
  const botPlayers = roomState?.botPlayers || [];
  const allPlayers = buildMergedPlayers(realPlayers, botPlayers);

  const realActive = getActivePlayers.all(game.id);
  const botActive = botPlayers.filter(b => b.status === 'active');
  const activePlayers = buildMergedPlayers(realActive, botActive);

  let currentPlayer = null;
  if (roomState && activePlayers.length > 0) {
    currentPlayer = activePlayers[roomState.currentPlayerIndex % activePlayers.length];
  }

  const reconnectSecondsLeft = userId && roomState
    ? (roomState.reconnectSecondsLeft.get(userId) ?? null)
    : null;

  return {
    game, players: allPlayers, activePlayers, currentPlayer,
    started: roomState?.started || false,
    turnSecondsLeft: roomState?.turnSecondsLeft ?? 10,
    reconnectSecondsLeft,
  };
}

module.exports = {
  joinGame, leaveWaitingRoom, toggleReady, rollDiceForPlayer,
  handleActiveGameDisconnect, handleReconnect,
  getRoomSnapshot, ensureRoomState,
};
