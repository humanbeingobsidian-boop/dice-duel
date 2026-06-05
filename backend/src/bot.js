// backend/src/bot.js
const { Bot, InlineKeyboard } = require('grammy');

// 1 Star = 2 Credits (100 credits = 50 stars)
const STAR_PACKAGES = [
  { id: 'stars_1',    label: '⭐ 1 כוכב',     credits: 2,    stars: 1,    description: 'ניסיון — 2 קרדיטים' },
  { id: 'stars_50',   label: '⭐ 50 כוכבים',  credits: 100,  stars: 50,   description: '100 קרדיטים' },
  { id: 'stars_100',  label: '⭐ 100 כוכבים', credits: 200,  stars: 100,  description: '200 קרדיטים' },
  { id: 'stars_250',  label: '🌟 250 כוכבים', credits: 500,  stars: 250,  description: '500 קרדיטים' },
  { id: 'stars_500',  label: '💫 500 כוכבים', credits: 1000, stars: 500,  description: '1000 קרדיטים' },
];

// Bot language strings
const BOT_LANG = {
  he: {
    welcome: (name) => `🎲 שלום ${name}, ברוך הבא ל-Dice Duel!\n\nמשחק קוביות מולטיפלייר בזמן אמת:\n• 2-6 שחקנים בכל חדר\n• כניסה: 5 או 100 קרדיטים\n• הזוכה לוקח הכל! 🏆\n\n👥 הזמן חברים וקבל +5 קרדיטים לכל חבר שמצטרף!`,
    play_btn: '🎲 שחק עכשיו',
    shop_btn: '⭐ קנה כוכבים',
    invite_btn: '👥 הזמן חבר (+5 קרדיטים)',
    lang_btn: '🌐 שנה שפה',
    invite_msg: (link) => `🔗 הקישור האישי שלך:\n\n${link}\n\nשתף עם חברים — כשחבר נכנס אתה מקבל +5 קרדיטים! 🎁`,
    shop_title: '⭐ חנות כוכבים\n\nקנה כוכבי Telegram וקבל קרדיטים לשחק!\n1 כוכב = 2 קרדיטים\n\nחבילות זמינות:',
    shop_item: (p) => `• ${p.label} → ${p.credits} קרדיטים`,
    shop_back: '🎲 חזור למשחק',
    payment_ok: (stars, credits, balance) => `✅ תשלום התקבל!\n\nשולמו: ${stars} ⭐\nקרדיטים שנוספו: ${credits}\nיתרה חדשה: ${balance} קרדיטים\n\nחזור למשחק! 🎲`,
    payment_err: (id) => `⚠️ התשלום התקבל אך הייתה שגיאה.\nפנה לתמיכה: ${id}`,
    help: `🎲 Dice Duel - עזרה\n\nפקודות:\n/start — מסך פתיחה\n/shop — חנות כוכבים\n/lang — שנה שפה\n\nאיך משחקים:\n1️⃣ לחץ "שחק עכשיו"\n2️⃣ שלם קרדיטים לכניסה\n3️⃣ המתן לשחקנים (2-6)\n4️⃣ זרוק קובייה בתורך\n5️⃣ יצא 1? הודחת!\n6️⃣ השורד זוכה בכל הקופה 🏆\n\nטיימרים:\n⏱️ 10 שניות לזריקת קובייה\n⏳ 60 שניות לפתיחת משחק\n🔄 30 שניות לחזרה אחרי ניתוק`,
    choose_lang: '🌐 בחר שפה:',
    lang_set: '✅ השפה שונתה לעברית',
    prize_sent: (label) => `🎁 הפרס שלך נשלח!\n\n${label}\n\nאם לא קיבלת תוך 10 דקות, פנה לתמיכה.`,
    no_orders: '✅ אין הזמנות ממתינות',
    orders_title: (n) => `📋 הזמנות ממתינות (${n}):`,
    order_sent_ok: (id) => `✅ הזמנה ${id} סומנה כנשלחה\nהמשתמש קיבל הודעה.`,
    order_not_found: (id) => `❌ הזמנה ${id} לא נמצאה`,
    order_already_sent: (id) => `✅ הזמנה ${id} כבר סומנה כנשלחה`,
    ready: '🎯 מוכן? ',
  },
  en: {
    welcome: (name) => `🎲 Hello ${name}, welcome to Dice Duel!\n\nReal-time multiplayer dice game:\n• 2-6 players per room\n• Entry: 5 or 100 credits\n• Winner takes all! 🏆\n\n👥 Invite friends and get +5 credits for each who joins!`,
    play_btn: '🎲 Play Now',
    shop_btn: '⭐ Buy Stars',
    invite_btn: '👥 Invite Friend (+5 credits)',
    lang_btn: '🌐 Change Language',
    invite_msg: (link) => `🔗 Your personal link:\n\n${link}\n\nShare with friends — when they join you get +5 credits! 🎁`,
    shop_title: '⭐ Star Shop\n\nBuy Telegram Stars and get credits!\n1 Star = 2 Credits\n\nAvailable packages:',
    shop_item: (p) => `• ${p.label} → ${p.credits} credits`,
    shop_back: '🎲 Back to Game',
    payment_ok: (stars, credits, balance) => `✅ Payment received!\n\nPaid: ${stars} ⭐\nCredits added: ${credits}\nNew balance: ${balance} credits\n\nBack to the game! 🎲`,
    payment_err: (id) => `⚠️ Payment received but there was an error.\nContact support: ${id}`,
    help: `🎲 Dice Duel - Help\n\nCommands:\n/start — Main menu\n/shop — Star shop\n/lang — Change language\n\nHow to play:\n1️⃣ Click "Play Now"\n2️⃣ Pay credits to enter\n3️⃣ Wait for players (2-6)\n4️⃣ Roll dice on your turn\n5️⃣ Roll a 1? You're out!\n6️⃣ Last one wins all! 🏆\n\nTimers:\n⏱️ 10s to roll\n⏳ 60s lobby timer\n🔄 30s to reconnect`,
    choose_lang: '🌐 Choose language:',
    lang_set: '✅ Language set to English',
    prize_sent: (label) => `🎁 Your prize has been sent!\n\n${label}\n\nIf not received within 10 minutes, contact support.`,
    no_orders: '✅ No pending orders',
    orders_title: (n) => `📋 Pending orders (${n}):`,
    order_sent_ok: (id) => `✅ Order ${id} marked as sent\nUser was notified.`,
    order_not_found: (id) => `❌ Order ${id} not found`,
    order_already_sent: (id) => `✅ Order ${id} already marked as sent`,
    ready: '🎯 Ready? ',
  },
  ru: {
    welcome: (name) => `🎲 Привет ${name}, добро пожаловать в Dice Duel!\n\nМногопользовательская игра в кости:\n• 2-6 игроков в комнате\n• Взнос: 5 или 100 кредитов\n• Победитель забирает всё! 🏆\n\n👥 Приглашай друзей и получай +5 кредитов за каждого!`,
    play_btn: '🎲 Играть',
    shop_btn: '⭐ Купить звёзды',
    invite_btn: '👥 Пригласить друга (+5 кредитов)',
    lang_btn: '🌐 Сменить язык',
    invite_msg: (link) => `🔗 Твоя личная ссылка:\n\n${link}\n\nОтправь друзьям — когда они присоединяются, ты получаешь +5 кредитов! 🎁`,
    shop_title: '⭐ Магазин звёзд\n\nКупи Telegram Stars и получи кредиты!\n1 звезда = 2 кредита\n\nДоступные пакеты:',
    shop_item: (p) => `• ${p.label} → ${p.credits} кредитов`,
    shop_back: '🎲 Вернуться в игру',
    payment_ok: (stars, credits, balance) => `✅ Оплата получена!\n\nОплачено: ${stars} ⭐\nКредитов добавлено: ${credits}\nНовый баланс: ${balance} кредитов\n\nВернись в игру! 🎲`,
    payment_err: (id) => `⚠️ Оплата получена, но произошла ошибка.\nОбратитесь в поддержку: ${id}`,
    help: `🎲 Dice Duel - Помощь\n\nКоманды:\n/start — Главное меню\n/shop — Магазин звёзд\n/lang — Сменить язык\n\nКак играть:\n1️⃣ Нажми "Играть"\n2️⃣ Внеси кредиты для входа\n3️⃣ Жди игроков (2-6)\n4️⃣ Бросай кости в свой ход\n5️⃣ Выпало 1? Ты выбыл!\n6️⃣ Последний выживший забирает всё! 🏆\n\nТаймеры:\n⏱️ 10 сек на бросок\n⏳ 60 сек таймер лобби\n🔄 30 сек на переподключение`,
    choose_lang: '🌐 Выберите язык:',
    lang_set: '✅ Язык изменён на русский',
    prize_sent: (label) => `🎁 Твой приз отправлен!\n\n${label}\n\nЕсли не получил в течение 10 минут, обратись в поддержку.`,
    no_orders: '✅ Нет ожидающих заказов',
    orders_title: (n) => `📋 Ожидающие заказы (${n}):`,
    order_sent_ok: (id) => `✅ Заказ ${id} помечен как отправленный\nПользователь уведомлён.`,
    order_not_found: (id) => `❌ Заказ ${id} не найден`,
    order_already_sent: (id) => `✅ Заказ ${id} уже помечен как отправленный`,
    ready: '🎯 Готов? ',
  },
};

// User language storage (in-memory — resets on redeploy, but fine for bot UI)
const userLangs = new Map();

function getLang(userId) {
  return userLangs.get(String(userId)) || 'he';
}

function L(userId) {
  return BOT_LANG[getLang(userId)] || BOT_LANG.he;
}

function startBot() {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const MINI_APP_URL = process.env.MINI_APP_URL || 'https://your-game.vercel.app';

  if (!BOT_TOKEN) {
    console.warn('⚠️  BOT_TOKEN not set — bot will not start');
    return;
  }

  const bot = new Bot(BOT_TOKEN);

  function getBotUsername() {
    return String(process.env.BOT_USERNAME || process.env.BOT_NAME || '').trim().replace(/^@/, '');
  }

  function buildReferralLink(userId) {
    const botUsername = getBotUsername();
    if (!botUsername) return null;
    return `https://t.me/${botUsername}?start=ref${userId}`;
  }

  // ─── /start ────────────────────────────────────────────────────────────────
  bot.command('start', async (ctx) => {
    const userId = String(ctx.from.id);
    const l = L(userId);

    // Handle referral deep link
    const payload = ctx.match;
    if (payload && payload.startsWith('ref')) {
      const referrerId = payload.replace('ref', '');
      if (referrerId && referrerId !== userId) {
        console.log(`👥 Referral: ${userId} invited by ${referrerId}`);
      }
    }

    const miniAppUrl = `${MINI_APP_URL}?ref=${userId}`;

    const keyboard = new InlineKeyboard()
      .webApp(l.play_btn, miniAppUrl)
      .row()
      .text(l.shop_btn, 'shop')
      .row()
      .text(l.invite_btn, `invite_${userId}`)
      .text('🔑 הקוד שלי', 'mycode_btn')
      .row()
      .text(l.lang_btn, 'choose_lang');

    await ctx.reply(l.welcome(ctx.from?.first_name || 'שחקן'), { reply_markup: keyboard });
  });

  // ─── /lang ─────────────────────────────────────────────────────────────────
  bot.command('lang', async (ctx) => {
    await showLangMenu(ctx);
  });

  bot.callbackQuery('choose_lang', async (ctx) => {
    await ctx.answerCallbackQuery();
    await showLangMenu(ctx);
  });

  async function showLangMenu(ctx) {
    const userId = String(ctx.from.id);
    const l = L(userId);
    const keyboard = new InlineKeyboard()
      .text('🇮🇱 עברית', 'lang_he').text('🇬🇧 English', 'lang_en').text('🇷🇺 Русский', 'lang_ru');
    await ctx.reply(l.choose_lang, { reply_markup: keyboard });
  }

  bot.callbackQuery('lang_he', async (ctx) => {
    await ctx.answerCallbackQuery();
    userLangs.set(String(ctx.from.id), 'he');
    await ctx.reply(BOT_LANG.he.lang_set);
  });
  bot.callbackQuery('lang_en', async (ctx) => {
    await ctx.answerCallbackQuery();
    userLangs.set(String(ctx.from.id), 'en');
    await ctx.reply(BOT_LANG.en.lang_set);
  });
  bot.callbackQuery('lang_ru', async (ctx) => {
    await ctx.answerCallbackQuery();
    userLangs.set(String(ctx.from.id), 'ru');
    await ctx.reply(BOT_LANG.ru.lang_set);
  });

  // ─── Invite ────────────────────────────────────────────────────────────────
  bot.callbackQuery(/^invite_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.match[1];
    const l = L(userId);
    const link = buildReferralLink(userId);
    if (!link) return ctx.reply('הגדר BOT_USERNAME ב-.env');
    await ctx.reply(l.invite_msg(link));
  });

  bot.callbackQuery('mycode_btn', async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = String(ctx.from.id);
    try {
      const { getUserByTelegramId, upsertUser, ensureInviteCode } = require('./db/queries');
      let user = getUserByTelegramId.get(userId);
      if (!user) {
        user = upsertUser({
          telegram_id: userId,
          username: ctx.from.username || null,
          first_name: ctx.from.first_name || 'Player',
        });
      }
      const code = ensureInviteCode(user);
      const msgs = {
        he: `🔑 הקוד האישי שלך: *${code}*\n\nשתף עם חברים וקבל +5 קרדיטים לכל חבר שמצטרף! 🎁`,
        en: `🔑 Your code: *${code}*\n\nShare with friends and get +5 credits for each who joins! 🎁`,
        ru: `🔑 Твой код: *${code}*\n\nПоделись с друзьями и получи +5 кредитов за каждого! 🎁`,
      };
      await ctx.reply(msgs[getLang(userId)] || msgs.he, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply('שגיאה');
    }
  });
  bot.command('mycode', async (ctx) => {
    const userId = String(ctx.from.id);
    const l = L(userId);
    try {
      const { getUserByTelegramId, upsertUser, ensureInviteCode } = require('./db/queries');
      let user = getUserByTelegramId.get(userId);
      if (!user) {
        user = upsertUser({
          telegram_id: userId,
          username: ctx.from.username || null,
          first_name: ctx.from.first_name || 'Player',
        });
      }
      const code = ensureInviteCode(user);
      const msgs = {
        he: `👥 הקוד האישי שלך:\n\n🔑 *${code}*\n\nשתף עם חברים — כשהם מזינים את הקוד במשחק, שניכם מקבלים +5 קרדיטים! 🎁`,
        en: `👥 Your personal invite code:\n\n🔑 *${code}*\n\nShare with friends — when they enter it in the game, you both get +5 credits! 🎁`,
        ru: `👥 Твой личный код приглашения:\n\n🔑 *${code}*\n\nПоделись с друзьями — когда они введут его в игре, вы оба получите +5 кредитов! 🎁`,
      };
      await ctx.reply(msgs[getLang(userId)] || msgs.he, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().webApp(l.play_btn, MINI_APP_URL),
      });
    } catch (err) {
      console.error('mycode error:', err);
      await ctx.reply('שגיאה בשליפת הקוד');
    }
  });
    await ctx.reply(L(ctx.from.id).help);
  });

  // ─── /play ────────────────────────────────────────────────────────────────
  bot.command('play', async (ctx) => {
    const l = L(ctx.from.id);
    await ctx.reply(l.ready, {
      reply_markup: new InlineKeyboard().webApp(l.play_btn, MINI_APP_URL),
    });
  });

  // ─── Shop ─────────────────────────────────────────────────────────────────
  bot.command('shop', async (ctx) => await showShop(ctx));
  bot.callbackQuery('shop', async (ctx) => { await ctx.answerCallbackQuery(); await showShop(ctx); });

  async function showShop(ctx) {
    const l = L(ctx.from.id);
    const keyboard = new InlineKeyboard();
    for (const pkg of STAR_PACKAGES) {
      keyboard.text(`${pkg.label} — ${pkg.credits} קרדיטים`, `buy_${pkg.id}`).row();
    }
    keyboard.text(l.shop_back, 'back_to_game');
    await ctx.reply(
      l.shop_title + '\n' + STAR_PACKAGES.map(p => l.shop_item(p)).join('\n'),
      { reply_markup: keyboard }
    );
  }

  // ─── Buy packages ─────────────────────────────────────────────────────────
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
    const l = L(ctx.from.id);
    await ctx.reply(l.ready, {
      reply_markup: new InlineKeyboard().webApp(l.play_btn, MINI_APP_URL),
    });
  });

  // ─── Pre-checkout ──────────────────────────────────────────────────────────
  bot.on('pre_checkout_query', async (ctx) => {
    try {
      const payload = JSON.parse(ctx.preCheckoutQuery.invoice_payload);
      const valid = STAR_PACKAGES.find(p => p.id === payload.pkg_id);
      if (!valid) return ctx.answerPreCheckoutQuery(false, 'חבילה לא תקינה');
      await ctx.answerPreCheckoutQuery(true);
    } catch (err) {
      await ctx.answerPreCheckoutQuery(false, 'שגיאה בעיבוד');
    }
  });

  // ─── Successful payment → credit DB directly ──────────────────────────────
  bot.on('message:successful_payment', async (ctx) => {
    const payment = ctx.message.successful_payment;
    const payload = JSON.parse(payment.invoice_payload);
    const telegramId = String(ctx.from.id);
    const credits = payload.credits;
    const stars = payment.total_amount;
    const l = L(telegramId);

    console.log(`💰 Payment: ${telegramId} paid ${stars}⭐ → +${credits} credits`);

    try {
      const { getUserByTelegramId, addBalance, upsertUser } = require('./db/queries');
      // Auto-create user if not exists (first time buyer via bot)
      let user = getUserByTelegramId.get(telegramId);
      if (!user) {
        user = upsertUser({
          telegram_id: telegramId,
          username: ctx.from.username || null,
          first_name: ctx.from.first_name || 'Player',
        });
      }
      addBalance.run(credits, user.id);
      const updated = getUserByTelegramId.get(telegramId);
      await ctx.reply(l.payment_ok(stars, credits, updated.balance), {
        reply_markup: new InlineKeyboard().webApp(l.play_btn, MINI_APP_URL),
      });
    } catch (err) {
      console.error('Credit error:', err);
      await ctx.reply(l.payment_err(payment.telegram_payment_charge_id));
    }
  });

  // ─── Admin: /sent_<id> ─────────────────────────────────────────────────────
  bot.command('sent', async (ctx) => {
    if (String(ctx.from.id) !== String(process.env.ADMIN_TELEGRAM_ID)) return;
    const parts = ctx.message.text.split('_');
    const orderId = parts[1];
    if (!orderId) return ctx.reply('שימוש: /sent_<orderId>');
    try {
      const { markOrderSent, db } = require('./db/queries');
      const order = db.prepare('SELECT * FROM prize_orders WHERE id = ?').get(orderId);
      const l = L(ctx.from.id);
      if (!order) return ctx.reply(l.order_not_found(orderId));
      if (order.status === 'sent') return ctx.reply(l.order_already_sent(orderId));
      markOrderSent.run({ id: orderId, note: 'נשלח על ידי אדמין' });
      try {
        await bot.api.sendMessage(order.telegram_id, BOT_LANG[getLang(order.telegram_id)].prize_sent(order.prize_label));
      } catch (e) { console.error('Could not notify user:', e.message); }
      await ctx.reply(l.order_sent_ok(orderId));
    } catch (err) {
      console.error('Mark sent error:', err);
      await ctx.reply('שגיאה בעדכון הזמנה');
    }
  });

  // ─── Admin: /orders ────────────────────────────────────────────────────────
  bot.command('orders', async (ctx) => {
    if (String(ctx.from.id) !== String(process.env.ADMIN_TELEGRAM_ID)) return;
    try {
      const { getPendingOrders } = require('./db/queries');
      const orders = getPendingOrders.all();
      const l = L(ctx.from.id);
      if (orders.length === 0) return ctx.reply(l.no_orders);
      const text = orders.map(o =>
        `🆔 ${o.id} | ${o.first_name} (@${o.username || o.telegram_id})\n` +
        `🎁 ${o.prize_label}\n` +
        `📅 ${new Date(o.created_at).toLocaleString('he-IL')}\n` +
        `/sent_${o.id}`
      ).join('\n\n');
      await ctx.reply(`${l.orders_title(orders.length)}\n\n${text}`);
    } catch (err) {
      await ctx.reply('שגיאה בשליפת הזמנות');
    }
  });

  // ─── Error + Start ─────────────────────────────────────────────────────────
  bot.catch((err) => {
    console.error('Bot error:', err.message || err);
  });

  process.on('unhandledRejection', (err) => {
    if (err?.error_code === 409 || err?.message?.includes('409')) {
      console.warn('⚠️  Bot 409 conflict — waiting 15s...');
      setTimeout(() => {
        bot.start({ onStart: (i) => console.log(`🤖 Bot @${i.username} running (retry)`), drop_pending_updates: true })
          .catch(e => console.error('Bot retry failed:', e.message));
      }, 15000);
    } else {
      console.error('Unhandled rejection:', err);
    }
  });

  process.on('uncaughtException', (err) => {
    if (err?.error_code === 409 || err?.message?.includes('409')) {
      console.warn('⚠️  Bot 409 conflict — waiting 15s...');
      setTimeout(() => {
        bot.start({ onStart: (i) => console.log(`🤖 Bot @${i.username} running (retry)`), drop_pending_updates: true })
          .catch(e => console.error('Bot retry failed:', e.message));
      }, 15000);
    } else {
      console.error('Uncaught exception:', err);
    }
  });

  bot.start({
    onStart: (info) => console.log(`🤖 Bot @${info.username} running`),
    drop_pending_updates: true,
  }).catch(err => console.error('Bot start error:', err.message));
}

module.exports = { startBot };
