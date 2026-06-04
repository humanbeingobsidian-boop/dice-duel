// backend/src/bot.js
// הבוט רץ בתוך אותו process כמו הבאקנד
const { Bot, InlineKeyboard } = require('grammy');

const STAR_PACKAGES = [
  { id: 'stars_100',  label: '⭐ 100 כוכבים',  credits: 100,  stars: 100,  description: 'חבילת כניסה' },
  { id: 'stars_200',  label: '⭐ 200 כוכבים',  credits: 200,  stars: 200,  description: 'חבילת בסיס — שתי כניסות' },
  { id: 'stars_500',  label: '🌟 500 כוכבים',  credits: 500,  stars: 500,  description: 'חבילה פופולרית — 5 כניסות' },
  { id: 'stars_1000', label: '💫 1000 כוכבים', credits: 1100, stars: 1000, description: 'חבילת VIP — 10% בונוס!' },
];

function startBot() {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const MINI_APP_URL = process.env.MINI_APP_URL || 'https://your-game.vercel.app';

  if (!BOT_TOKEN) {
    console.warn('⚠️  BOT_TOKEN not set — bot will not start');
    return;
  }

  const bot = new Bot(BOT_TOKEN);

  // ─── /start ──────────────────────────────────────────────────────────────
  bot.command('start', async (ctx) => {
    const firstName = ctx.from?.first_name || 'שחקן';
    const userId = String(ctx.from.id);

    // Deep link referral: /start ref_<telegram_id>
    const payload = ctx.match;
    if (payload && payload.startsWith('ref_')) {
      const referrerId = payload.replace('ref_', '');
      if (referrerId !== userId) {
        // Store referral in user's start — frontend will pick it up via startParam
        console.log(`👥 Referral: ${userId} was invited by ${referrerId}`);
      }
    }

    // Personal referral link for this user
    const botUsername = (process.env.BOT_USERNAME || ctx.me.username).trim();
    const referralLink = `https://t.me/${botUsername}?start=ref_${userId}`;
    const miniAppUrl = `${MINI_APP_URL}?ref=${userId}`;

    const keyboard = new InlineKeyboard()
      .webApp('🎲 שחק עכשיו', miniAppUrl)
      .row()
      .text('⭐ קנה כוכבים', 'shop')
      .row()
      .text('👥 הזמן חבר (+5 קרדיטים)', `invite_${userId}`);

    await ctx.reply(
      `🎲 *שלום ${firstName}, ברוך הבא ל-Dice Duel!*\n\n` +
      `משחק קוביות מולטיפלייר בזמן אמת:\n` +
      `• 2-6 שחקנים בכל חדר\n` +
      `• כניסה: 5 או 100 קרדיטים\n` +
      `• הזוכה לוקח הכל! 🏆\n\n` +
      `🔗 *הזמן חברים וקבל +5 קרדיטים לכל חבר שמצטרף!*\n` +
      `_לחץ על הכפתור כדי להתחיל:_`,
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
  });

  // ─── Invite button ────────────────────────────────────────────────────────
  bot.callbackQuery(/^invite_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.match[1];
    const botUsername = (process.env.BOT_USERNAME || ctx.me.username).trim();
    const referralLink = `https://t.me/${botUsername}?start=ref_${userId}`;

    await ctx.reply(
      `🔗 *הקישור האישי שלך:*\n\n` +
      `${referralLink}\n\n` +
      `שתף את הקישור עם חברים.\n` +
      `כשחבר נכנס דרך הקישור שלך — *אתה מקבל +5 קרדיטים* אוטומטית! 🎁`,
      { parse_mode: 'Markdown' }
    );
  });

  // ─── /help ───────────────────────────────────────────────────────────────
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `🎲 *Dice Duel - עזרה*\n\n` +
      `*פקודות:*\n` +
      `/start — מסך פתיחה\n` +
      `/shop — חנות כוכבים\n` +
      `/play — פתח את המשחק\n\n` +
      `*איך משחקים:*\n` +
      `1️⃣ לחץ "שחק עכשיו"\n` +
      `2️⃣ שלם 100 קרדיטים לכניסה\n` +
      `3️⃣ המתן לשחקנים (2-6)\n` +
      `4️⃣ זרוק קובייה בתורך\n` +
      `5️⃣ יצא 1? הודחת!\n` +
      `6️⃣ השורד זוכה בכל הקופה 🏆\n\n` +
      `*טיימרים:*\n` +
      `⏱️ 10 שניות לזריקת קובייה\n` +
      `⏳ 60 שניות לפתיחת משחק\n` +
      `🔄 30 שניות לחזרה אחרי ניתוק`,
      { parse_mode: 'Markdown' }
    );
  });

  // ─── /play ───────────────────────────────────────────────────────────────
  bot.command('play', async (ctx) => {
    await ctx.reply('מוכן? 🎯', {
      reply_markup: new InlineKeyboard().webApp('🎲 פתח את המשחק', MINI_APP_URL),
    });
  });

  // ─── /shop ───────────────────────────────────────────────────────────────
  bot.command('shop', async (ctx) => await showShop(ctx));
  bot.callbackQuery('shop', async (ctx) => {
    await ctx.answerCallbackQuery();
    await showShop(ctx);
  });

  async function showShop(ctx) {
    const keyboard = new InlineKeyboard();
    for (const pkg of STAR_PACKAGES) {
      keyboard.text(`${pkg.label} — ${pkg.credits} קרדיטים`, `buy_${pkg.id}`).row();
    }
    keyboard.text('🎲 חזור למשחק', 'back_to_game');

    await ctx.reply(
      `⭐ *חנות כוכבים*\n\n` +
      `קנה כוכבי Telegram וקבל קרדיטים לשחק!\n\n` +
      `📦 *חבילות זמינות:*\n` +
      STAR_PACKAGES.map(p => `• ${p.label} → *${p.credits} קרדיטים* — ${p.description}`).join('\n') +
      `\n\n_כל הקרדיטים הם וירטואליים_`,
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
  }

  // ─── Buy buttons ──────────────────────────────────────────────────────────
  for (const pkg of STAR_PACKAGES) {
    bot.callbackQuery(`buy_${pkg.id}`, async (ctx) => {
      await ctx.answerCallbackQuery();
      try {
        await ctx.replyWithInvoice(
          `${pkg.label} — Dice Duel`,
          pkg.description,
          JSON.stringify({ pkg_id: pkg.id, credits: pkg.credits, user_id: ctx.from.id }),
          'XTR',
          [{ label: pkg.label, amount: pkg.stars }]
        );
      } catch (err) {
        console.error('Invoice error:', err);
        await ctx.reply('שגיאה ביצירת חשבונית. נסה שוב.');
      }
    });
  }

  bot.callbackQuery('back_to_game', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('בוא נשחק! 🎲', {
      reply_markup: new InlineKeyboard().webApp('🎲 שחק עכשיו', MINI_APP_URL),
    });
  });

  // ─── Pre-checkout ─────────────────────────────────────────────────────────
  bot.on('pre_checkout_query', async (ctx) => {
    try {
      const payload = JSON.parse(ctx.preCheckoutQuery.invoice_payload);
      const valid = STAR_PACKAGES.find(p => p.id === payload.pkg_id);
      if (!valid) return ctx.answerPreCheckoutQuery(false, 'חבילה לא תקינה');
      await ctx.answerPreCheckoutQuery(true);
    } catch {
      await ctx.answerPreCheckoutQuery(false, 'שגיאה בעיבוד');
    }
  });

  // ─── Successful payment → credit directly via DB ──────────────────────────
  bot.on('message:successful_payment', async (ctx) => {
    const payment = ctx.message.successful_payment;
    const payload = JSON.parse(payment.invoice_payload);
    const telegramId = String(ctx.from.id);
    const credits = payload.credits;
    const stars = payment.total_amount;

    console.log(`💰 Payment: user ${telegramId} paid ${stars} stars → +${credits} credits`);

    try {
      // Direct DB access — same process, no HTTP needed
      const { getUserByTelegramId, addBalance } = require('./db/queries');
      const user = getUserByTelegramId.get(telegramId);
      if (!user) throw new Error('User not found');
      addBalance.run(credits, user.id);
      const updated = getUserByTelegramId.get(telegramId);

      await ctx.reply(
        `✅ *תשלום התקבל!*\n\n` +
        `שולמו: ${stars} ⭐\n` +
        `קרדיטים שנוספו: *${credits}*\n` +
        `יתרה חדשה: *${updated.balance}* קרדיטים\n\n` +
        `_חזור למשחק וצא לשחק!_ 🎲`,
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().webApp('🎲 שחק עכשיו', MINI_APP_URL),
        }
      );
    } catch (err) {
      console.error('Credit error:', err);
      await ctx.reply(
        `⚠️ התשלום התקבל אך הייתה שגיאה.\n` +
        `פנה לתמיכה: ${payment.telegram_payment_charge_id}`
      );
    }
  });

  bot.catch((err) => console.error('Bot error:', err));

  // ─── Admin: /sent_<orderId> ───────────────────────────────────────────────
  bot.command('sent', async (ctx) => {
    const adminId = process.env.ADMIN_TELEGRAM_ID;
    if (String(ctx.from.id) !== String(adminId)) return;

    const parts = ctx.message.text.split('_');
    const orderId = parts[1];
    if (!orderId) return ctx.reply('שימוש: /sent_<orderId>');

    try {
      const { markOrderSent, db } = require('./db/queries');
      const order = db.prepare('SELECT * FROM prize_orders WHERE id = ?').get(orderId);
      if (!order) return ctx.reply(`❌ הזמנה ${orderId} לא נמצאה`);
      if (order.status === 'sent') return ctx.reply(`✅ הזמנה ${orderId} כבר סומנה כנשלחה`);

      markOrderSent.run({ id: orderId, note: 'נשלח על ידי אדמין דרך בוט' });

      // Notify the user their prize is on the way
      try {
        await bot.api.sendMessage(
          order.telegram_id,
          `🎁 *הפרס שלך נשלח!*\n\n` +
          `${order.prize_label}\n\n` +
          `אם לא קיבלת תוך 10 דקות, פנה לתמיכה.`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {
        console.error('Could not notify user:', e.message);
      }

      await ctx.reply(`✅ הזמנה ${orderId} סומנה כנשלחה\nהמשתמש קיבל הודעה.`);
    } catch (err) {
      console.error('Mark sent error:', err);
      await ctx.reply('שגיאה בעדכון הזמנה');
    }
  });

  // ─── Admin: /orders — list pending ───────────────────────────────────────
  bot.command('orders', async (ctx) => {
    const adminId = process.env.ADMIN_TELEGRAM_ID;
    if (String(ctx.from.id) !== String(adminId)) return;

    const { getPendingOrders } = require('./db/queries');
    const orders = getPendingOrders.all();

    if (orders.length === 0) {
      return ctx.reply('✅ אין הזמנות ממתינות');
    }

    const text = orders.map(o =>
      `🆔 ${o.id} | ${o.first_name} (@${o.username || o.telegram_id})\n` +
      `🎁 ${o.prize_label}\n` +
      `📅 ${new Date(o.created_at).toLocaleString('he-IL')}\n` +
      `/sent_${o.id}`
    ).join('\n\n');

    await ctx.reply(`📋 *הזמנות ממתינות (${orders.length}):*\n\n${text}`, {
      parse_mode: 'Markdown',
    });
  });


bot.start({
  onStart: (info) => console.log(`🤖 Bot @${info.username} running`),
  drop_pending_updates: true,
}).catch((err) => {
  console.error('Bot start error:', err.message);
});
}

module.exports = { startBot };
