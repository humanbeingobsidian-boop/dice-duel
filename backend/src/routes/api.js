// backend/src/routes/api.js
const express = require('express');
const router = express.Router();
const { requireTelegramAuth } = require('../middleware/telegramAuth');
const {
  upsertUser,
  getUserByTelegramId,
  getLeaderboard,
  getGameByRoomCode,
  getGamePlayers,
  getGameTurns,
} = require('../db/queries');

// ─── Auth / User ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth
 * Validates Telegram initData, upserts user, returns user data.
 */
router.post('/auth', requireTelegramAuth, (req, res) => {
  try {
    const tgUser = req.telegramUser;
    const user = upsertUser({
      telegram_id: String(tgUser.id),
      username: tgUser.username || null,
      first_name: tgUser.first_name || 'Player',
    });
    res.json({ success: true, user });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Auth failed' });
  }
});

/**
 * GET /api/me
 * Returns current user's profile and balance.
 */
router.get('/me', requireTelegramAuth, (req, res) => {
  try {
    const user = getUserByTelegramId.get(String(req.telegramUser.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ─── Leaderboard ─────────────────────────────────────────────────────────────

/**
 * GET /api/leaderboard
 */
router.get('/leaderboard', (req, res) => {
  try {
    const rows = getLeaderboard.all();
    res.json({ leaderboard: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ─── Game info ────────────────────────────────────────────────────────────────

/**
 * GET /api/game/:roomCode
 */
router.get('/game/:roomCode', requireTelegramAuth, (req, res) => {
  try {
    const game = getGameByRoomCode.get(req.params.roomCode);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    const players = getGamePlayers.all(game.id);
    const turns = getGameTurns.all(game.id);
    res.json({ game, players, turns });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

/**
 * POST /api/credits/add
 * Called by the bot after successful_payment.
 * Protected by x-bot-secret header.
 */
router.post('/credits/add', (req, res) => {
  const secret = req.headers['x-bot-secret'];
  const expectedSecret = process.env.BOT_SECRET || 'dev_secret';
  if (secret !== expectedSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { telegram_id, credits, stars } = req.body;
  if (!telegram_id || !credits || credits <= 0) {
    return res.status(400).json({ error: 'Invalid params' });
  }

  try {
    const { getUserByTelegramId, addBalance } = require('../db/queries');
    const user = getUserByTelegramId.get(String(telegram_id));
    if (!user) return res.status(404).json({ error: 'User not found' });

    addBalance.run(credits, user.id);
    const updated = getUserByTelegramId.get(String(telegram_id));

    console.log(`⭐ ${stars} stars → +${credits} credits for user ${telegram_id} (new balance: ${updated.balance})`);
    res.json({ success: true, balance: updated.balance });
  } catch (err) {
    console.error('Credits add error:', err);
    res.status(500).json({ error: 'Failed to add credits' });
  }
});

module.exports = router;
