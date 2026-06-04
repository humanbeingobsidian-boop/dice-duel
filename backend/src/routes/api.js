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
  getPendingOrders,
  markOrderSent,
  buyPrizeTransaction,
} = require('../db/queries');

// ─── Prize catalog ────────────────────────────────────────────────────────────
const PRIZES = [
  {
    id: 'gift_15stars',
    label: '🎁 Gift — 15 כוכבי Telegram',
    description: 'תקבל Gift ששווה 15 Telegram Stars דרך הבוט',
    cost: 30,
    emoji: '🎁',
  },
  {
    id: 'gift_100stars',
    label: '⭐ Gift — 100 כוכבי Telegram',
    description: 'תקבל Gift ששווה 100 Telegram Stars דרך הבוט',
    cost: 200,
    emoji: '⭐',
  },
  {
    id: 'gift_1000stars',
    label: '💫 Gift — 1000 כוכבי Telegram',
    description: 'תקבל Gift ששווה 1000 Telegram Stars דרך הבוט',
    cost: 2000,
    emoji: '💫',
  },
];

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

// ─── Prizes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/prizes
 * Returns the prize catalog.
 */
router.get('/prizes', (req, res) => {
  res.json({ prizes: PRIZES });
});

/**
 * POST /api/prizes/buy
 * Deducts coins and creates a pending order.
 * Admin gets notified via bot.
 */
router.post('/prizes/buy', requireTelegramAuth, (req, res) => {
  const { prize_id } = req.body;
  const prize = PRIZES.find(p => p.id === prize_id);
  if (!prize) return res.status(400).json({ error: 'פרס לא קיים' });

  const tgUser = req.telegramUser;
  const dbUser = getUserByTelegramId.get(String(tgUser.id));
  if (!dbUser) return res.status(404).json({ error: 'משתמש לא נמצא' });
  if (dbUser.balance < prize.cost) {
    return res.status(400).json({ error: 'אין מספיק מטבעות' });
  }

  try {
    const order = buyPrizeTransaction(
      dbUser.id,
      String(tgUser.id),
      tgUser.username || null,
      tgUser.first_name || 'Player',
      prize
    );

    // Notify admin via bot (non-blocking)
    notifyAdmin(order, dbUser, prize).catch(err =>
      console.error('Admin notify error:', err)
    );

    const updatedUser = getUserByTelegramId.get(String(tgUser.id));
    res.json({ success: true, order, balance: updatedUser.balance });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ error: 'אין מספיק מטבעות' });
    }
    console.error('Buy prize error:', err);
    res.status(500).json({ error: 'שגיאה ברכישה' });
  }
});

/**
 * GET /api/admin/orders
 * Admin only — list pending orders.
 */
router.get('/admin/orders', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (secret !== (process.env.ADMIN_SECRET || 'admin_dev')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const orders = getPendingOrders.all();
  res.json({ orders });
});

/**
 * POST /api/admin/orders/:id/sent
 * Admin marks an order as sent.
 */
router.post('/admin/orders/:id/sent', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (secret !== (process.env.ADMIN_SECRET || 'admin_dev')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { note } = req.body;
  markOrderSent.run({ id: req.params.id, note: note || 'נשלח על ידי אדמין' });
  res.json({ success: true });
});

// ─── Admin bot notification ───────────────────────────────────────────────────
async function notifyAdmin(order, dbUser, prize) {
  const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;
  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!ADMIN_TELEGRAM_ID || !BOT_TOKEN) return;

  const username = dbUser.username ? `@${dbUser.username}` : `ID: ${dbUser.telegram_id}`;
  const message =
    `🛍️ *הזמנת פרס חדשה!*\n\n` +
    `👤 שחקן: ${dbUser.first_name} (${username})\n` +
    `🎁 פרס: ${prize.label}\n` +
    `💰 עלות: ${prize.cost} מטבעות\n` +
    `🆔 Order ID: ${order.id}\n` +
    `📅 זמן: ${new Date().toLocaleString('he-IL')}\n\n` +
    `_שלח את הפרס ואז סמן כנשלח:_\n` +
    `/sent_${order.id}`;

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: ADMIN_TELEGRAM_ID,
      text: message,
      parse_mode: 'Markdown',
    }),
  });
}

/**
 * POST /api/credits/add
 * Called by the bot after successful Stars payment.
 */
router.post('/credits/add', (req, res) => {
  const secret = req.headers['x-bot-secret'];
  if (secret !== (process.env.BOT_SECRET || 'dev_secret')) {
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
    console.log(`⭐ ${stars} stars → +${credits} credits for ${telegram_id} (balance: ${updated.balance})`);
    res.json({ success: true, balance: updated.balance });
  } catch (err) {
    console.error('Credits add error:', err);
    res.status(500).json({ error: 'Failed to add credits' });
  }
});

module.exports = router;
