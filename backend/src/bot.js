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
    const keyboard = new InlineKeyboard()
      .webApp('🎲 שחק עכשיו', MINI_APP_URL)
      .row()
      .text('⭐ קנה כוכבים', 'shop');

    await ctx.reply(
      `🎲 *שלום ${firstName}, ברוך הבא ל-Dice Duel!*\n\n` +
      `משחק קוביות מולטיפלייר בזמן אמת:\n` +
      `• 2-6 שחקנים בכל חדר\n` +
      `• כניסה: 100 קרדיטים וירטואליים\n` +
      `• הזוכה לוקח הכל! 🏆\n\n` +
      `_לחץ על הכפתור כדי להתחיל:_`,
      { parse_mode: 'Markdown', reply_markup: keyboard }
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

  // הפעל polling — לא חוסם את ה-event loop
  bot.start({
    onStart: (info) => console.log(`🤖 Bot @${info.username} running`),
  });
}

module.exports = { startBot };
