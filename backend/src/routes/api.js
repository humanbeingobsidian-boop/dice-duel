// backend/src/routes/api.js
const express = require('express');
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
  ensureInviteCode,
  redeemInviteCode,
} = require('../db/queries');

module.exports = function createRouter(io) {
  const router = express.Router();

// ─── Prize catalog (multilingual) ────────────────────────────────────────────
const PRIZES = [
  {
    id: 'telegram_teddy_15stars',
    emoji: '🧸',
    visual: 'teddy',
    starsValue: 15,
    cost: 30,
    labels: {
      he: { label: '🧸 מתנת דובי Telegram', description: 'תקבל מתנת דובי בשווי 15 Telegram Stars דרך הבוט' },
      en: { label: '🧸 Telegram Teddy Gift', description: 'Receive a Teddy Gift worth 15 Telegram Stars via bot' },
      ru: { label: '🧸 Telegram Teddy Gift', description: 'Получи подарок Teddy стоимостью 15 Telegram Stars через бота' },
    },
  },
  {
    id: 'telegram_diamond_100stars',
    emoji: '💎',
    visual: 'diamond',
    starsValue: 100,
    cost: 200,
    labels: {
      he: { label: '💎 מתנת יהלום Telegram', description: 'תקבל מתנת יהלום בשווי 100 Telegram Stars דרך הבוט' },
      en: { label: '💎 Telegram Diamond Gift', description: 'Receive a Diamond Gift worth 100 Telegram Stars via bot' },
      ru: { label: '💎 Telegram Diamond Gift', description: 'Получи подарок Diamond стоимостью 100 Telegram Stars через бота' },
    },
  },
  {
    id: 'telegram_collectible_1000stars',
    emoji: '🎁',
    visual: 'collectible',
    starsValue: 1000,
    cost: 2000,
    labels: {
      he: { label: '🎁 מתנת אספנות רנדומלית', description: 'תקבל מתנת Collectible רנדומלית בשווי 1000 Telegram Stars דרך הבוט' },
      en: { label: '🎁 Random Collectible Gift', description: 'Receive a random Collectible Gift worth 1000 Telegram Stars via bot' },
      ru: { label: '🎁 Random Collectible Gift', description: 'Получи случайный Collectible подарок стоимостью 1000 Telegram Stars через бота' },
    },
  },
];

// Helper: get prize with labels for a specific lang
function getPrizesForLang(lang = 'en') {
  const l = ['he', 'en', 'ru'].includes(lang) ? lang : 'en';
  return PRIZES.map(p => ({
    id: p.id,
    emoji: p.emoji,
    visual: p.visual,
    starsValue: p.starsValue,
    cost: p.cost,
    label: p.labels[l].label,
    description: p.labels[l].description,
    // keep label for admin notifications (always Hebrew)
    label_he: p.labels.he.label,
  }));
}

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
 * GET /api/prizes?lang=en
 * Returns localized prize catalog.
 */
router.get('/prizes', (req, res) => {
  const lang = req.query.lang || 'en';
  res.json({ prizes: getPrizesForLang(lang) });
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
      { id: prize.id, label: prize.labels.he.label, cost: prize.cost }
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

// ─── Shared helper: send via Bot API ─────────────────────────────────────────
async function sendBotMessage(chatId, text) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch (err) {
    console.error('sendBotMessage error:', err.message);
  }
}

// ─── Admin + Userbot notification ────────────────────────────────────────────
async function notifyAdmin(order, dbUser, prize) {
  const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;
  if (!ADMIN_TELEGRAM_ID) return;

  const username = dbUser.username ? `@${dbUser.username}` : `ID: ${dbUser.telegram_id}`;
  const message =
    `🛍️ *הזמנת פרס חדשה!*\n\n` +
    `👤 שחקן: ${dbUser.first_name} (${username})\n` +
    `🎁 פרס: ${prize.labels.he.label}\n` +
    `⭐ שווי: ${prize.starsValue} Telegram Stars\n` +
    `💰 עלות: ${prize.cost} קרדיטים\n` +
    `🆔 Order ID: ${order.id}\n` +
    `📅 זמן: ${new Date().toLocaleString('he-IL')}\n\n` +
    `לאחר שליחת הפרס:\n/sent_${order.id}`;

  await sendBotMessage(ADMIN_TELEGRAM_ID, message);

  // קרא ל-userbot
  const USERBOT_URL    = process.env.USERBOT_URL || 'http://localhost:3002';
  const USERBOT_SECRET = process.env.USERBOT_SECRET || 'userbot_secret';
  try {
    await fetch(`${USERBOT_URL}/send-prize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Userbot-Secret': USERBOT_SECRET,
      },
      body: JSON.stringify({
        user_id:     dbUser.telegram_id,
        prize_label: prize.labels.he.label,
        order_id:    String(order.id),
      }),
    });
    console.log(`📨 Userbot notified for user ${dbUser.telegram_id}`);
  } catch (err) {
    console.error('Userbot notify error:', err.message);
  }
}

// ─── Invite Code ──────────────────────────────────────────────────────────────

/**
 * GET /api/invite-code
 * Returns the current user's invite code (generates one if needed).
 */
router.get('/invite-code', requireTelegramAuth, (req, res) => {
  try {
    const user = getUserByTelegramId.get(String(req.telegramUser.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    const code = ensureInviteCode(user);
    res.json({ code, bonus: 5 });
  } catch (err) {
    console.error('Get invite code error:', err);
    res.status(500).json({ error: 'Failed to get invite code' });
  }
});

/**
 * POST /api/invite-code/redeem
 * Body: { code: " " }
 * Gives +5 credits to both the redeemer and the inviter.
 */
router.post('/invite-code/redeem', requireTelegramAuth, (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'INVALID_CODE' });
    }
    const user = getUserByTelegramId.get(String(req.telegramUser.id));
    if (!user) return res.status(404).json({ error: 'User not found' });

    const result = redeemInviteCode(user.id, code.trim().toUpperCase());

    if (!result.success) {
      const msgs = {
        ALREADY_USED: 'כבר השתמשת בקוד הזמנה',
        OWN_CODE:     'לא ניתן להשתמש בקוד שלך',
        INVALID_CODE: 'קוד לא קיים',
        USER_NOT_FOUND: 'משתמש לא נמצא',
      };
      return res.status(400).json({ error: result.error, message: msgs[result.error] || result.error });
    }

    const updatedUser = getUserByTelegramId.get(String(req.telegramUser.id));

    console.log(`🎁 Invite redeemed: ${user.first_name} used code of ${result.inviterName} → both +${result.bonus}`);

    // Notify inviter via socket if they're online
    if (io && result.inviterTelegramId) {
      io.emit(`invite_bonus_${result.inviterTelegramId}`, {
        redeemerName: user.first_name,
        bonus: result.bonus,
      });
    }

    res.json({
      success: true,
      inviterName: result.inviterName,
      bonus: result.bonus,
      balance: updatedUser.balance,
      inviterTelegramId: result.inviterTelegramId,
    });
  } catch (err) {
    console.error('Redeem invite error:', err);
    res.status(500).json({ error: 'Failed to redeem code' });
  }
});

/**
 * POST /api/credits/add — bot Stars payment webhook
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

  return router;
};
