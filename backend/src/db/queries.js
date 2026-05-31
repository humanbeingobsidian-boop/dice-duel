// backend/src/db/queries.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/dice_duel.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ─────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 500,
    total_games INTEGER NOT NULL DEFAULT 0,
    total_wins INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','active','finished')),
    entry_fee INTEGER NOT NULL DEFAULT 100,
    house_fee_percent INTEGER NOT NULL DEFAULT 10,
    pot INTEGER NOT NULL DEFAULT 0,
    max_players INTEGER NOT NULL DEFAULT 6,
    winner_user_id INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    finished_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS game_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL REFERENCES games(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','eliminated','winner')),
    seat_order INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    eliminated_at DATETIME,
    UNIQUE(game_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL REFERENCES games(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    dice_result INTEGER NOT NULL,
    was_eliminated INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
  CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
  CREATE INDEX IF NOT EXISTS idx_games_room_code ON games(room_code);
  CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);
  CREATE INDEX IF NOT EXISTS idx_turns_game_id ON turns(game_id);
`);

// ─── User queries ────────────────────────────────────────────────────────────
const upsertUser = db.prepare(`
  INSERT INTO users (telegram_id, username, first_name)
  VALUES (@telegram_id, @username, @first_name)
  ON CONFLICT(telegram_id) DO UPDATE SET
    username = excluded.username,
    first_name = excluded.first_name,
    updated_at = CURRENT_TIMESTAMP
  RETURNING *
`);

const getUserByTelegramId = db.prepare(`
  SELECT * FROM users WHERE telegram_id = ?
`);

const getUserById = db.prepare(`
  SELECT * FROM users WHERE id = ?
`);

const deductBalance = db.prepare(`
  UPDATE users SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ? AND balance >= ?
`);

const addBalance = db.prepare(`
  UPDATE users SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const incrementStats = db.prepare(`
  UPDATE users SET
    total_games = total_games + 1,
    total_wins = total_wins + @wins,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = @user_id
`);

const getLeaderboard = db.prepare(`
  SELECT telegram_id, username, first_name, balance, total_games, total_wins
  FROM users
  ORDER BY total_wins DESC, balance DESC
  LIMIT 20
`);

// ─── Game queries ────────────────────────────────────────────────────────────
const createGame = db.prepare(`
  INSERT INTO games (room_code, entry_fee, house_fee_percent, max_players)
  VALUES (@room_code, @entry_fee, @house_fee_percent, @max_players)
  RETURNING *
`);

const getGameByRoomCode = db.prepare(`
  SELECT * FROM games WHERE room_code = ?
`);

const getGameById = db.prepare(`
  SELECT * FROM games WHERE id = ?
`);

const getWaitingGame = db.prepare(`
  SELECT g.*, COUNT(gp.id) as player_count
  FROM games g
  LEFT JOIN game_players gp ON gp.game_id = g.id AND gp.status = 'active'
  WHERE g.status = 'waiting'
  GROUP BY g.id
  HAVING player_count < g.max_players
  ORDER BY g.created_at ASC
  LIMIT 1
`);

const updateGameStatus = db.prepare(`
  UPDATE games SET status = @status,
    started_at = CASE WHEN @status = 'active' THEN CURRENT_TIMESTAMP ELSE started_at END,
    finished_at = CASE WHEN @status = 'finished' THEN CURRENT_TIMESTAMP ELSE finished_at END
  WHERE id = @id
`);

const updateGameWinner = db.prepare(`
  UPDATE games SET winner_user_id = @winner_user_id, status = 'finished', finished_at = CURRENT_TIMESTAMP
  WHERE id = @game_id
`);

const addPot = db.prepare(`
  UPDATE games SET pot = pot + ? WHERE id = ?
`);

// ─── GamePlayer queries ──────────────────────────────────────────────────────
const addPlayerToGame = db.prepare(`
  INSERT INTO game_players (game_id, user_id, seat_order)
  VALUES (@game_id, @user_id, @seat_order)
`);

const getGamePlayers = db.prepare(`
  SELECT gp.*, u.telegram_id, u.username, u.first_name
  FROM game_players gp
  JOIN users u ON u.id = gp.user_id
  WHERE gp.game_id = ?
  ORDER BY gp.seat_order ASC
`);

const getActivePlayers = db.prepare(`
  SELECT gp.*, u.telegram_id, u.username, u.first_name
  FROM game_players gp
  JOIN users u ON u.id = gp.user_id
  WHERE gp.game_id = ? AND gp.status = 'active'
  ORDER BY gp.seat_order ASC
`);

const eliminatePlayer = db.prepare(`
  UPDATE game_players SET status = 'eliminated', eliminated_at = CURRENT_TIMESTAMP
  WHERE game_id = @game_id AND user_id = @user_id
`);

const setPlayerWinner = db.prepare(`
  UPDATE game_players SET status = 'winner'
  WHERE game_id = @game_id AND user_id = @user_id
`);

const isPlayerInGame = db.prepare(`
  SELECT 1 FROM game_players WHERE game_id = ? AND user_id = ?
`);

const countActivePlayers = db.prepare(`
  SELECT COUNT(*) as count FROM game_players
  WHERE game_id = ? AND status = 'active'
`);

// ─── Turn queries ────────────────────────────────────────────────────────────
const recordTurn = db.prepare(`
  INSERT INTO turns (game_id, user_id, dice_result, was_eliminated)
  VALUES (@game_id, @user_id, @dice_result, @was_eliminated)
  RETURNING *
`);

const getGameTurns = db.prepare(`
  SELECT t.*, u.username, u.first_name
  FROM turns t JOIN users u ON u.id = t.user_id
  WHERE t.game_id = ?
  ORDER BY t.created_at ASC
`);

// ─── Transactions ────────────────────────────────────────────────────────────
const joinGameTransaction = db.transaction((userId, gameId, entryFee, seatOrder) => {
  const deducted = deductBalance.run(entryFee, userId, entryFee);
  if (deducted.changes === 0) throw new Error('INSUFFICIENT_BALANCE');
  addPot.run(entryFee, gameId);
  addPlayerToGame.run({ game_id: gameId, user_id: userId, seat_order: seatOrder });
  return true;
});

// Remove player from waiting room (refund entry fee)
const removePlayerFromGame = db.prepare(`
  DELETE FROM game_players WHERE game_id = @game_id AND user_id = @user_id
`);

const subtractPot = db.prepare(`
  UPDATE games SET pot = pot - ? WHERE id = ?
`);

const leaveGameTransaction = db.transaction((userId, gameId, entryFee) => {
  removePlayerFromGame.run({ game_id: gameId, user_id: userId });
  subtractPot.run(entryFee, gameId);
  addBalance.run(entryFee, userId); // full refund
  return true;
});

const finalizeGameTransaction = db.transaction((gameId, winnerId, prize, houseFee) => {
  updateGameWinner.run({ game_id: gameId, winner_user_id: winnerId });
  setPlayerWinner.run({ game_id: gameId, user_id: winnerId });
  addBalance.run(prize, winnerId);
  incrementStats.run({ user_id: winnerId, wins: 1 });

  // Update all eliminated players stats
  const allPlayers = getGamePlayers.all(gameId);
  for (const p of allPlayers) {
    if (p.user_id !== winnerId) {
      incrementStats.run({ user_id: p.user_id, wins: 0 });
    }
  }
});

module.exports = {
  db,
  upsertUser,
  getUserByTelegramId,
  getUserById,
  deductBalance,
  addBalance,
  getLeaderboard,
  createGame,
  getGameByRoomCode,
  getGameById,
  getWaitingGame,
  updateGameStatus,
  addPot,
  getGamePlayers,
  getActivePlayers,
  eliminatePlayer,
  setPlayerWinner,
  isPlayerInGame,
  countActivePlayers,
  recordTurn,
  getGameTurns,
  joinGameTransaction,
  leaveGameTransaction,
  finalizeGameTransaction,
};
