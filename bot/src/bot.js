// bot/src/bot.js
require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');

const BOT_TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://your-game.vercel.app';

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is not set in .env');
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

// ─── Star packages ────────────────────────────────────────────────────────────
const STAR_PACKAGES = [
  { id: 'stars_100',  label: '⭐ 100 כוכבים',  credits: 100,  stars: 100,  description: 'חבילת כניסה — מספיק לקנות קרדיטים' },
  { id: 'stars_200',  label: '⭐ 200 כוכבים',  credits: 200,  stars: 200,  description: 'חבילת בסיס — שתי כניסות למשחק' },
  { id: 'stars_500',  label: '🌟 500 כוכבים',  credits: 500,  stars: 500,  description: 'חבילה פופולרית — 5 כניסות + בונוס' },
  { id: 'stars_1000', label: '💫 1000 כוכבים', credits: 1100, stars: 1000, description: 'חבילת VIP — 10% בונוס קרדיטים!' },
];

// ─── /start ───────────────────────────────────────────────────────────────────
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

// ─── /shop ────────────────────────────────────────────────────────────────────
bot.command('shop', async (ctx) => {
  await showShop(ctx);
});

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
    `קנה כוכבי Telegram וקבל קרדיטים וירטואליים לשחק!\n\n` +
    `📦 *חבילות זמינות:*\n` +
    STAR_PACKAGES.map(p =>
      `• ${p.label} → *${p.credits} קרדיטים* — ${p.description}`
    ).join('\n') +
    `\n\n_כל הקרדיטים הם וירטואליים ולא ניתנים להמרה לכסף_`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
}

// ─── Buy package ──────────────────────────────────────────────────────────────
for (const pkg of STAR_PACKAGES) {
  bot.callbackQuery(`buy_${pkg.id}`, async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendInvoice(ctx, pkg);
  });
}

async function sendInvoice(ctx, pkg) {
  try {
    await ctx.replyWithInvoice(
      `${pkg.label} — Dice Duel`,           // title
      pkg.description,                        // description
      JSON.stringify({ pkg_id: pkg.id, credits: pkg.credits, user_id: ctx.from.id }),
      'XTR',                                  // currency = Telegram Stars
      [{ label: pkg.label, amount: pkg.stars }]  // prices (in Stars)
    );
  } catch (err) {
    console.error('Invoice error:', err);
    await ctx.reply('שגיאה ביצירת חשבונית. נסה שוב.');
  }
}

// ─── Pre-checkout (must answer within 10s) ────────────────────────────────────
bot.on('pre_checkout_query', async (ctx) => {
  // Validate payload before confirming
  try {
    const payload = JSON.parse(ctx.preCheckoutQuery.invoice_payload);
    const validPkg = STAR_PACKAGES.find(p => p.id === payload.pkg_id);
    if (!validPkg) {
      return ctx.answerPreCheckoutQuery(false, 'חבילה לא תקינה');
    }
    await ctx.answerPreCheckoutQuery(true);
  } catch {
    await ctx.answerPreCheckoutQuery(false, 'שגיאה בעיבוד התשלום');
  }
});

// ─── Successful payment → add credits via backend API ────────────────────────
bot.on('message:successful_payment', async (ctx) => {
  const payment = ctx.message.successful_payment;
  const payload = JSON.parse(payment.invoice_payload);
  const telegramId = String(ctx.from.id);
  const credits = payload.credits;
  const stars = payment.total_amount;

  console.log(`💰 Payment: user ${telegramId} bought ${credits} credits for ${stars} stars`);

  // Call backend to credit the user
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
  try {
    const res = await fetch(`${BACKEND_URL}/api/credits/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-secret': process.env.BOT_SECRET || 'dev_secret',
      },
      body: JSON.stringify({ telegram_id: telegramId, credits, stars }),
    });
    const data = await res.json();

    if (data.success) {
      await ctx.reply(
        `✅ *תשלום התקבל!*\n\n` +
        `שולמו: ${stars} ⭐ כוכבים\n` +
        `קרדיטים שנוספו: *${credits}*\n` +
        `יתרה חדשה: *${data.balance}* קרדיטים\n\n` +
        `_חזור למשחק וצא לשחק!_ 🎲`,
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().webApp('🎲 שחק עכשיו', MINI_APP_URL),
        }
      );
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (err) {
    console.error('Credit add error:', err);
    await ctx.reply(
      `⚠️ התשלום התקבל אך הייתה שגיאה בהוספת הקרדיטים.\n` +
      `פנה לתמיכה עם: payment_id=${payment.telegram_payment_charge_id}`
    );
  }
});

// ─── /help ────────────────────────────────────────────────────────────────────
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

bot.command('play', async (ctx) => {
  await ctx.reply('מוכן? 🎯', {
    reply_markup: new InlineKeyboard().webApp('🎲 פתח את המשחק', MINI_APP_URL),
  });
});

bot.callbackQuery('back_to_game', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply('בוא נשחק! 🎲', {
    reply_markup: new InlineKeyboard().webApp('🎲 שחק עכשיו', MINI_APP_URL),
  });
});

bot.catch((err) => console.error('Bot error:', err));

bot.start({
  onStart: (info) => {
    console.log(`🤖 Bot @${info.username} started`);
    console.log(`   Mini App: ${MINI_APP_URL}`);
  },
});
