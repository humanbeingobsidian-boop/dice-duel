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

// ─── /start ──────────────────────────────────────────────────────────────────
bot.command('start', async (ctx) => {
  const firstName = ctx.from?.first_name || 'שחקן';

  const keyboard = new InlineKeyboard()
    .webApp('🎲 שחק עכשיו', MINI_APP_URL);

  await ctx.reply(
    `🎲 *שלום ${firstName}, ברוך הבא ל-Dice Duel!*\n\n` +
    `משחק קוביות מולטיפלייר מלהיב:\n` +
    `• 2-6 שחקנים בכל חדר\n` +
    `• כניסה: 100 קרדיטים וירטואליים\n` +
    `• הזוכה לוקח הכל! 🏆\n\n` +
    `_לחץ על הכפתור למטה כדי להתחיל:_`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }
  );
});

// ─── /help ───────────────────────────────────────────────────────────────────
bot.command('help', async (ctx) => {
  await ctx.reply(
    `🎲 *Dice Duel - איך משחקים?*\n\n` +
    `1️⃣ לחץ על כפתור "שחק עכשיו"\n` +
    `2️⃣ שלם 100 קרדיטים וירטואליים\n` +
    `3️⃣ המתן לשחקנים נוספים (2-6)\n` +
    `4️⃣ כל שחקן זורק קובייה בתורו\n` +
    `5️⃣ יצא 1? אתה מודח!\n` +
    `6️⃣ השורד האחרון זוכה בכל הקופה\n\n` +
    `📋 כללים:\n` +
    `• עמלת בית: 10%\n` +
    `• שחקנים חדשים מקבלים 500 קרדיטים\n` +
    `• כל הקרדיטים הם וירטואליים בלבד`,
    { parse_mode: 'Markdown' }
  );
});

// ─── /play ───────────────────────────────────────────────────────────────────
bot.command('play', async (ctx) => {
  const keyboard = new InlineKeyboard()
    .webApp('🎲 פתח את המשחק', MINI_APP_URL);

  await ctx.reply('מוכן לשחק? 🎯', { reply_markup: keyboard });
});

// ─── Inline query (optional) ─────────────────────────────────────────────────
bot.on('inline_query', async (ctx) => {
  await ctx.answerInlineQuery([
    {
      type: 'article',
      id: 'play',
      title: '🎲 Dice Duel - שחק עכשיו',
      description: 'הצטרף למשחק קוביות מולטיפלייר',
      input_message_content: {
        message_text: `🎲 בוא נשחק Dice Duel!\n${MINI_APP_URL}`,
      },
      reply_markup: new InlineKeyboard().webApp('🎲 שחק', MINI_APP_URL),
    },
  ]);
});

// ─── Error handler ────────────────────────────────────────────────────────────
bot.catch((err) => {
  console.error('Bot error:', err);
});

// ─── Start ────────────────────────────────────────────────────────────────────
bot.start({
  onStart: (info) => {
    console.log(`🤖 Bot @${info.username} started`);
    console.log(`   Mini App URL: ${MINI_APP_URL}`);
  },
});
