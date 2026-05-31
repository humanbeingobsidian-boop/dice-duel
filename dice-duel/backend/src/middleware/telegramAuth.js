// backend/src/middleware/telegramAuth.js
const crypto = require('crypto');

/**
 * Validates Telegram initData hash.
 * In dev mode (DEV_MODE=true), accepts a mock user.
 */
function validateTelegramData(initData) {
  if (process.env.DEV_MODE === 'true') {
    // In dev mode, accept mock data
    return parseMockUser(initData);
  }

  if (!initData) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');

    // Sort alphabetically and build check string
    const checkString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      console.warn('⚠️  BOT_TOKEN not set, skipping hash validation');
      return parseUserFromParams(params);
    }

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');

    if (expectedHash !== hash) {
      console.warn('❌ Invalid Telegram hash');
      return null;
    }

    // Check auth_date not too old (1 hour)
    const authDate = parseInt(params.get('auth_date'), 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 3600) {
      console.warn('❌ Telegram auth_date too old');
      return null;
    }

    return parseUserFromParams(params);
  } catch (e) {
    console.error('Error validating Telegram data:', e);
    return null;
  }
}

function parseUserFromParams(params) {
  const userStr = params.get('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

function parseMockUser(initData) {
  // Support passing a mock telegram_id for dev testing
  if (initData && initData.startsWith('mock_')) {
    const id = initData.replace('mock_', '');
    return {
      id: parseInt(id) || 12345,
      first_name: `Player${id}`,
      username: `player${id}`,
    };
  }
  return {
    id: 12345,
    first_name: 'DevPlayer',
    username: 'devplayer',
  };
}

/**
 * Express middleware — attaches telegramUser to req if valid.
 */
function requireTelegramAuth(req, res, next) {
  if (process.env.DEV_MODE === 'true') {
    // In dev mode, get mock user from header or use default
    const mockId = req.headers['x-mock-user-id'] || '12345';
    req.telegramUser = {
      id: parseInt(mockId),
      first_name: `Player${mockId}`,
      username: `player${mockId}`,
    };
    return next();
  }

  const initData = req.headers['x-telegram-init-data'] || req.body?.initData;
  const user = validateTelegramData(initData);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: invalid Telegram data' });
  }

  req.telegramUser = user;
  next();
}

module.exports = { validateTelegramData, requireTelegramAuth };
