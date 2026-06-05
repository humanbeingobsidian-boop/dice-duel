// backend/src/bot.js
const { Bot, InlineKeyboard } = require('grammy');

const STAR_PACKAGES = [
  { id: 'stars_1',    label: '⭐ 1 כוכב',     credits: 2,    stars: 1,    description: '2 קרדיטים' },
  { id: 'stars_50',   label: '⭐ 50 כוכבים',  credits: 100,  stars: 50,   description: '100 קרדיטים' },
  { id: 'stars_100',  label: '⭐ 100 כוכבים', credits: 200,  stars: 100,  description: '200 קרדיטים' },
  { id: 'stars_250',  label: '🌟 250 כוכבים', credits: 500,  stars: 250,  description: '500 קרדיטים' },
  { id: 'stars_500',  label: '💫 500 כוכבים', credits: 1000, stars: 500,  description: '1000 קרדיטים' },
];

// ─── i18n ─────────────────────────────────────────────────────────────────────
const I18N = {
  he: {
    // Main menu
    main_text: (name) =>
      `🎲 *שלום ${name}!*\n\nברוך הבא ל-*Dice Duel* — משחק קוביות מולטיפלייר בזמן אמת.\n\n` +
      `• 2-6 שחקנים בכל חדר\n• כניסה: 5 או 100 קרדיטים\n• הזוכה לוקח הכל! 🏆`,
    btn_play:    '🎲 שחק עכשיו',
    btn_shop:    '⭐ חנות כוכבים',
    btn_invite:  '👥 הזמן חבר',
    btn_help:    '❓ עזרה',
    btn_lang:    '🌐 שפה',
    btn_back:    '← חזור',

    // Shop
    shop_text: () =>
      `⭐ *חנות כוכבים*\n\n1 כוכב = 2 קרדיטים\nבחר חבילה:`,
    shop_item: (p) => `${p.label} — ${p.credits} קרדיטים`,

    // Invite
    invite_text: (code) =>
      `👥 *הזמן חברים*\n\n🔑 הקוד האישי שלך:\n\n\`${code}\`\n\n` +
      `שתף את הקוד עם חברים.\nכשהם מזינים אותו במשחק — שניכם מקבלים *+5 קרדיטים*! 🎁`,
    btn_copy_code: '📋 העתק קוד',
    no_code: 'לא נמצא קוד, פתח את המשחק קודם',

    // Help
    help_text: () =>
      `❓ *עזרה*\n\n` +
      `*איך משחקים:*\n` +
      `1️⃣ לחץ "שחק עכשיו"\n` +
      `2️⃣ שלם קרדיטים לכניסה\n` +
      `3️⃣ המתן לשחקנים (2-6)\n` +
      `4️⃣ זרוק קובייה בתורך\n` +
      `5️⃣ יצא 1? הודחת!\n` +
      `6️⃣ השורד זוכה בקופה 🏆\n\n` +
      `*טיימרים:*\n` +
      `⏱️ 10 שניות לזריקת קובייה\n` +
      `⏳ 60 שניות לפתיחת משחק\n` +
      `🔄 30 שניות לחזרה אחרי ניתוק`,

    // Lang
    lang_text: () => '🌐 *בחר שפה:*',
    lang_he: '🇮🇱 עברית ✓',
    lang_en: '🇬🇧 English',
    lang_ru: '🇷🇺 Русский',
    lang_set: '✅ השפה עודכנה לעברית',
  },

  en: {
    main_text: (name) =>
      `🎲 *Hello ${name}!*\n\nWelcome to *Dice Duel* — real-time multiplayer dice game.\n\n` +
      `• 2-6 players per room\n• Entry: 5 or 100 credits\n• Winner takes all! 🏆`,
    btn_play:   '🎲 Play Now',
    btn_shop:   '⭐ Star Shop',
    btn_invite: '👥 Invite Friend',
    btn_help:   '❓ Help',
    btn_lang:   '🌐 Language',
    btn_back:   '← Back',

    shop_text: () =>
      `⭐ *Star Shop*\n\n1 Star = 2 Credits\nChoose a package:`,
    shop_item: (p) => `${p.label} — ${p.credits} credits`,

    invite_text: (code) =>
      `👥 *Invite Friends*\n\n🔑 Your personal code:\n\n\`${code}\`\n\n` +
      `Share with friends. When they enter it in the game — you both get *+5 credits*! 🎁`,
    btn_copy_code: '📋 Copy Code',
    no_code: 'No code found, open the game first',

    help_text: () =>
      `❓ *Help*\n\n` +
      `*How to play:*\n` +
      `1️⃣ Click "Play Now"\n` +
      `2️⃣ Pay credits to enter\n` +
      `3️⃣ Wait for players (2-6)\n` +
      `4️⃣ Roll dice on your turn\n` +
      `5️⃣ Roll a 1? You're out!\n` +
      `6️⃣ Last one wins all! 🏆\n\n` +
      `*Timers:*\n` +
      `⏱️ 10s to roll\n` +
      `⏳ 60s lobby timer\n` +
      `🔄 30s to reconnect`,

    lang_text: () => '🌐 *Choose language:*',
    lang_he: '🇮🇱 עברית',
    lang_en: '🇬🇧 English ✓',
    lang_ru: '🇷🇺 Русский',
    lang_set: '✅ Language set to English',
  },

  ru: {
    main_text: (name) =>
      `🎲 *Привет ${name}!*\n\nДобро пожаловать в *Dice Duel* — многопользовательская игра в кости.\n\n` +
      `• 2-6 игроков в комнате\n• Взнос: 5 или 100 кредитов\n• Победитель забирает всё! 🏆`,
    btn_play:   '🎲 Играть',
    btn_shop:   '⭐ Магазин',
    btn_invite: '👥 Пригласить',
    btn_help:   '❓ Помощь',
    btn_lang:   '🌐 Язык',
    btn_back:   '← Назад',

    shop_text: () =>
      `⭐ *Магазин звёзд*\n\n1 звезда = 2 кредита\nВыбери пакет:`,
    shop_item: (p) => `${p.label} — ${p.credits} кредитов`,

    invite_text: (code) =>
      `👥 *Пригласить друзей*\n\n🔑 Твой личный код:\n\n\`${code}\`\n\n` +
      `Отправь друзьям. Когда они введут его в игре — вы оба получите *+5 кредитов*! 🎁`,
    btn_copy_code: '📋 Скопировать код',
    no_code: 'Код не найден, сначала открой игру',

    help_text: () =>
      `❓ *Помощь*\n\n` +
      `*Как играть:*\n` +
      `1️⃣ Нажми "Играть"\n` +
      `2️⃣ Внеси кредиты для входа\n` +
      `3️⃣ Жди игроков (2-6)\n` +
      `4️⃣ Бросай кости в свой ход\n` +
      `5️⃣ Выпало 1? Выбыл!\n` +
      `6️⃣ Последний забирает всё! 🏆\n\n` +
      `*Таймеры:*\n` +
      `⏱️ 10 сек на бросок\n` +
      `⏳ 60 сек таймер лобби\n` +
      `🔄 30 сек на переподключение`,

    lang_text: () => '🌐 *Выбери язык:*',
    lang_he: '🇮🇱 עברית',
    lang_en: '🇬🇧 English',
    lang_ru: '🇷🇺 Русский ✓',
    lang_set: '✅ Язык изменён на русский',
  },
};

const userLangs = new Map();
function getLang(userId) { return userLangs.get(String(userId)) || 'he'; }
function L(userId) { return I18N[getLang(userId)] || I18N.he; }

// ─── Keyboard builders ────────────────────────────────────────────────────────
function mainKeyboard(l, miniAppUrl) {
  return new InlineKeyboard()
    .webApp(l.btn_play, miniAppUrl).row()
    .text(l.btn_shop, 'menu:shop').text(l.btn_invite, 'menu:invite').row()
    .text(l.btn_help, 'menu:help').text(l.btn_lang, 'menu:lang');
}

function shopKeyboard(l) {
  const kb = new InlineKeyboard();
  for (const pkg of STAR_PACKAGES) {
    kb.text(l.shop_item(pkg), `buy_${pkg.id}`).row();
  }
  kb.text(l.btn_back, 'menu:main');
  return kb;
}

function inviteKeyboard(l, code) {
  return new InlineKeyboard()
    .text(l.btn_copy_code, `copy_code:${code}`).row()
    .text(l.btn_back, 'menu:main');
}

function helpKeyboard(l) {
  return new InlineKeyboard()
    .text(l.btn_back, 'menu:main');
}

function langKeyboard(l) {
  return new InlineKeyboard()
    .text(l.lang_he, 'lang:he').text(l.lang_en, 'lang:en').text(l.lang_ru, 'lang:ru').row()
    .text(l.btn_back, 'menu:main');
}

// ─── Edit or send (avoids sending a new message on every navigation) ──────────
async function showMenu(ctx, screen, isNew = false) {
  const userId = ctx.from?.id;
  const l = L(userId);
  const MINI_APP_URL = process.env.MINI_APP_URL || 'https://your-game.vercel.app';
  const name = ctx.from?.first_name || 'שחקן';

  let text, keyboard;

  if (screen === 'main') {
    text = l.main_text(name);
    keyboard = mainKeyboard(l, `${MINI_APP_URL}?ref=${userId}`);

  } else if (screen === 'shop') {
    text = l.shop_text();
    keyboard = shopKeyboard(l);

  } else if (screen === 'invite') {
    let code = null;
    try {
      const { getUserByTelegramId, ensureInviteCode } = require('./db/queries');
      const user = getUserByTelegramId.get(String(userId));
      if (user) code = ensureInviteCode(user);
    } catch {}
    text = code ? l.invite_text(code) : l.no_code;
    keyboard = code ? inviteKeyboard(l, code) : new InlineKeyboard().text(l.btn_back, 'menu:main');

  } else if (screen === 'help') {
    text = l.help_text();
    keyboard = helpKeyboard(l);

  } else if (screen === 'lang') {
    text = l.lang_text();
    keyboard = langKeyboard(l);

  } else {
    text = l.main_text(name);
    keyboard = mainKeyboard(l, `${MINI_APP_URL}?ref=${userId}`);
  }

  const opts = { parse_mode: 'Markdown', reply_markup: keyboard };

  if (isNew) {
    return ctx.reply(text, opts);
  }
  // Edit existing message — no new bubble
  try {
    await ctx.editMessageText(text, opts);
  } catch {
    // If edit fails (e.g. message too old), send new
    await ctx.reply(text, opts);
  }
}

// ─── startBot ─────────────────────────────────────────────────────────────────
function startBot() {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) { console.warn('⚠️  BOT_TOKEN not set'); return; }

  const bot = new Bot(BOT_TOKEN);

  // /start — always sends a new message
  bot.command('start', async (ctx) => {
    await showMenu(ctx, 'main', true);
  });

  // Menu navigation callbacks — edit same message
  bot.callbackQuery('menu:main',   async (ctx) => { await ctx.answerCallbackQuery(); await showMenu(ctx, 'main'); });
  bot.callbackQuery('menu:shop',   async (ctx) => { await ctx.answerCallbackQuery(); await showMenu(ctx, 'shop'); });
  bot.callbackQuery('menu:invite', async (ctx) => { await ctx.answerCallbackQuery(); await showMenu(ctx, 'invite'); });
  bot.callbackQuery('menu:help',   async (ctx) => { await ctx.answerCallbackQuery(); await showMenu(ctx, 'help'); });
  bot.callbackQuery('menu:lang',   async (ctx) => { await ctx.answerCallbackQuery(); await showMenu(ctx, 'lang'); });

  // Language selection
  bot.callbackQuery('lang:he', async (ctx) => {
    userLangs.set(String(ctx.from.id), 'he');
    await ctx.answerCallbackQuery(I18N.he.lang_set);
    await showMenu(ctx, 'main');
  });
  bot.callbackQuery('lang:en', async (ctx) => {
    userLangs.set(String(ctx.from.id), 'en');
    await ctx.answerCallbackQuery(I18N.en.lang_set);
    await showMenu(ctx, 'main');
  });
  bot.callbackQuery('lang:ru', async (ctx) => {
    userLangs.set(String(ctx.from.id), 'ru');
    await ctx.answerCallbackQuery(I18N.ru.lang_set);
    await showMenu(ctx, 'main');
  });

  // Copy invite code — show as alert popup
  bot.callbackQuery(/^copy_code:(.+)$/, async (ctx) => {
    const code = ctx.match[1];
    await ctx.answerCallbackQuery({ text: `🔑 ${code}`, show_alert: true });
  });

  // Buy Stars — sends invoice (new message, can't avoid)
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
      }
    });
  }

  // Pre-checkout
  bot.on('pre_checkout_query', async (ctx) => {
    try {
      const payload = JSON.parse(ctx.preCheckoutQuery.invoice_payload);
      const valid = STAR_PACKAGES.find(p => p.id === payload.pkg_id);
      if (!valid) return ctx.answerPreCheckoutQuery(false, 'חבילה לא תקינה');
      await ctx.answerPreCheckoutQuery(true);
    } catch {
      await ctx.answerPreCheckoutQuery(false, 'שגיאה');
    }
  });

  // Successful payment
  bot.on('message:successful_payment', async (ctx) => {
    const payment = ctx.message.successful_payment;
    const payload = JSON.parse(payment.invoice_payload);
    const telegramId = String(ctx.from.id);
    const { credits, stars } = payload;
    const l = L(telegramId);
    const MINI_APP_URL = process.env.MINI_APP_URL || '';

    try {
      const { getUserByTelegramId, addBalance, upsertUser } = require('./db/queries');
      let user = getUserByTelegramId.get(telegramId);
      if (!user) {
        user = upsertUser({ telegram_id: telegramId, username: ctx.from.username || null, first_name: ctx.from.first_name || 'Player' });
      }
      addBalance.run(credits, user.id);
      const updated = getUserByTelegramId.get(telegramId);
      const msg = l === I18N.ru
        ? `✅ Оплата получена!\n\nОплачено: ${payment.total_amount} ⭐\nКредитов: +${credits}\nБаланс: ${updated.balance}`
        : l === I18N.en
          ? `✅ Payment received!\n\nPaid: ${payment.total_amount} ⭐\nCredits: +${credits}\nBalance: ${updated.balance}`
          : `✅ תשלום התקבל!\n\nשולמו: ${payment.total_amount} ⭐\nקרדיטים: +${credits}\nיתרה: ${updated.balance}`;
      await ctx.reply(msg, {
        reply_markup: new InlineKeyboard().webApp(L(telegramId).btn_play, MINI_APP_URL),
      });
    } catch (err) {
      console.error('Credit error:', err);
      await ctx.reply(`⚠️ ${payment.telegram_payment_charge_id}`);
    }
  });

  // ─── Admin commands ──────────────────────────────────────────────────────────
  bot.command('orders', async (ctx) => {
    if (String(ctx.from.id) !== String(process.env.ADMIN_TELEGRAM_ID)) return;
    try {
      const { getPendingOrders } = require('./db/queries');
      const orders = getPendingOrders.all();
      if (!orders.length) return ctx.reply('✅ אין הזמנות ממתינות');
      const text = orders.map(o =>
        `🆔 ${o.id} | ${o.first_name} (@${o.username || o.telegram_id})\n🎁 ${o.prize_label}\n📅 ${new Date(o.created_at).toLocaleString('he-IL')}\n/sent_${o.id}`
      ).join('\n\n');
      await ctx.reply(`📋 הזמנות ממתינות (${orders.length}):\n\n${text}`);
    } catch (err) { await ctx.reply('שגיאה'); }
  });

  bot.command('sent', async (ctx) => {
    if (String(ctx.from.id) !== String(process.env.ADMIN_TELEGRAM_ID)) return;
    const orderId = ctx.message.text.split('_')[1];
    if (!orderId) return ctx.reply('שימוש: /sent_<orderId>');
    try {
      const { markOrderSent, db } = require('./db/queries');
      const order = db.prepare('SELECT * FROM prize_orders WHERE id = ?').get(orderId);
      if (!order) return ctx.reply(`❌ הזמנה ${orderId} לא נמצאה`);
      if (order.status === 'sent') return ctx.reply(`✅ כבר נשלחה`);
      markOrderSent.run({ id: orderId, note: 'נשלח' });
      try { await bot.api.sendMessage(order.telegram_id, `🎁 הפרס שלך נשלח!\n\n${order.prize_label}`); }
      catch {}
      await ctx.reply(`✅ הזמנה ${orderId} סומנה כנשלחה`);
    } catch { await ctx.reply('שגיאה'); }
  });

  // ─── Error + 409 handling ─────────────────────────────────────────────────────
  bot.catch((err) => { console.error('Bot error:', err.message || err); });

  process.on('unhandledRejection', (err) => {
    if (err?.error_code === 409 || err?.message?.includes('409')) {
      console.warn('⚠️  Bot 409 — waiting 15s...');
      setTimeout(() => bot.start({ onStart: (i) => console.log(`🤖 Bot @${i.username} running (retry)`), drop_pending_updates: true }).catch(() => {}), 15000);
    } else { console.error('Unhandled rejection:', err); }
  });

  process.on('uncaughtException', (err) => {
    if (err?.error_code === 409 || err?.message?.includes('409')) {
      console.warn('⚠️  Bot 409 — waiting 15s...');
      setTimeout(() => bot.start({ onStart: (i) => console.log(`🤖 Bot @${i.username} running (retry)`), drop_pending_updates: true }).catch(() => {}), 15000);
    } else { console.error('Uncaught exception:', err); }
  });

  bot.start({
    onStart: (info) => console.log(`🤖 Bot @${info.username} running`),
    drop_pending_updates: true,
  }).catch(err => console.error('Bot start error:', err.message));
}

module.exports = { startBot };
