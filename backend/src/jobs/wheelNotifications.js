// backend/src/jobs/wheelNotifications.js
const { InlineKeyboard } = require('grammy');
const { db } = require('../db/queries');

const I18N = {
  he: {
    text: '🎡 הסיבוב היומי שלך מוכן!\n\nיש לך סיבוב חינם בגלגל המזל. אולי היום יוצא לך Teddy Gift? 🧸',
    button: '🎡 סובב עכשיו',
  },
  en: {
    text: '🎡 Your daily spin is ready!\n\nYou have a free Lucky Wheel spin. Maybe today is your Teddy Gift day? 🧸',
    button: '🎡 Spin now',
  },
  ru: {
    text: '🎡 Твой ежедневный спин готов!\n\nУ тебя есть бесплатный спин в колесе удачи. Может, сегодня выпадет Teddy Gift? 🧸',
    button: '🎡 Крутить',
  },
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function utcHour() {
  return new Date().getUTCHours();
}

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}

function addColumn(table, column, definition) {
  if (!hasColumn(table, column)) db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

function initSchema() {
  addColumn('users', 'ui_lang', "TEXT NOT NULL DEFAULT 'he'");
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_wheel_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      notify_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','blocked','failed')),
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME,
      UNIQUE(user_id, notify_date)
    );
    CREATE INDEX IF NOT EXISTS idx_wheel_notifications_date ON daily_wheel_notifications(notify_date);
  `);
}

initSchema();

function normalizeLang(lang) {
  return ['he', 'en', 'ru'].includes(lang) ? lang : 'he';
}

async function sendTelegramMessage(botToken, telegramId, lang) {
  const l = I18N[normalizeLang(lang)] || I18N.he;
  const miniAppUrl = process.env.MINI_APP_URL || process.env.FRONTEND_URL || 'https://your-game.vercel.app';
  const keyboard = new InlineKeyboard().webApp(l.button, miniAppUrl);

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: telegramId,
      text: l.text,
      reply_markup: keyboard,
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const err = new Error(data.description || `Telegram HTTP ${res.status}`);
    err.telegram = data;
    throw err;
  }
}

async function sendDailyWheelNotifications({ force = false } = {}) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return { sent: 0, skipped: true, reason: 'BOT_TOKEN missing' };

  // Wheel resets at UTC midnight. To avoid sending stale notifications after deploy/restart,
  // automatic runs send only during the first 2 UTC hours unless explicitly forced.
  if (!force && utcHour() > 1) return { sent: 0, skipped: true, reason: 'outside notification window' };

  const date = todayKey();
  const users = db.prepare(`
    SELECT id, telegram_id, first_name, COALESCE(ui_lang, 'he') AS ui_lang
    FROM users
    WHERE telegram_id IS NOT NULL AND telegram_id <> ''
    ORDER BY id ASC
  `).all();

  let sent = 0;
  let failed = 0;
  let blocked = 0;

  for (const user of users) {
    const inserted = db.prepare(`
      INSERT OR IGNORE INTO daily_wheel_notifications (user_id, notify_date)
      VALUES (?, ?)
    `).run(user.id, date);

    if (inserted.changes === 0) continue;

    try {
      await sendTelegramMessage(botToken, user.telegram_id, user.ui_lang);
      db.prepare(`
        UPDATE daily_wheel_notifications
        SET status = 'sent', sent_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND notify_date = ?
      `).run(user.id, date);
      sent++;
      await new Promise(resolve => setTimeout(resolve, 45));
    } catch (err) {
      const description = err?.telegram?.description || err.message || 'failed';
      const status = /blocked|bot was blocked|chat not found|user is deactivated/i.test(description) ? 'blocked' : 'failed';
      db.prepare(`
        UPDATE daily_wheel_notifications
        SET status = @status, error = @error
        WHERE user_id = @user_id AND notify_date = @date
      `).run({ status, error: String(description).slice(0, 500), user_id: user.id, date });
      if (status === 'blocked') blocked++; else failed++;
    }
  }

  return { sent, failed, blocked, date };
}

function startWheelNotificationJob() {
  if (process.env.WHEEL_NOTIFICATIONS_ENABLED === 'false') {
    console.log('ℹ️  Wheel notifications disabled');
    return;
  }

  const run = async () => {
    try {
      const result = await sendDailyWheelNotifications();
      if (!result.skipped) console.log('🎡 Daily wheel notifications:', result);
    } catch (err) {
      console.error('Wheel notification job error:', err.message || err);
    }
  };

  setTimeout(run, 60_000);
  setInterval(run, 15 * 60_000);
  console.log('🎡 Daily wheel notification job scheduled');
}

module.exports = { startWheelNotificationJob, sendDailyWheelNotifications };
