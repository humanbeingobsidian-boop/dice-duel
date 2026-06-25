// backend/src/routes/wheel.js
const express = require('express');
const { requireTelegramAuth } = require('../middleware/telegramAuth');
const { getUserByTelegramId } = require('../db/queries');
const { publicState, spinWheel, notifyGiftWin, getPrizeById } = require('../game/dailyWheel');

module.exports = function createWheelRouter() {
  const router = express.Router();

  router.get('/wheel/state', requireTelegramAuth, (req, res) => {
    try {
      const user = getUserByTelegramId.get(String(req.telegramUser.id));
      if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
      res.json({ success: true, state: publicState(user.id) });
    } catch (err) {
      console.error('Wheel state error:', err);
      res.status(500).json({ error: 'WHEEL_STATE_FAILED' });
    }
  });

  router.post('/wheel/spin', requireTelegramAuth, async (req, res) => {
    try {
      const result = spinWheel(req.telegramUser.id);
      if (result.prize.type === 'gift' && result.giftWin) {
        const user = getUserByTelegramId.get(String(req.telegramUser.id));
        const prize = getPrizeById(result.prize.id);
        notifyGiftWin(result.giftWin, user, prize).catch(err => console.error('Wheel gift notify async error:', err));
      }
      res.json({ success: true, result });
    } catch (err) {
      const code = err.message || 'WHEEL_SPIN_FAILED';
      if (code === 'ALREADY_SPUN') return res.status(429).json({ error: code });
      if (code === 'USER_NOT_FOUND') return res.status(404).json({ error: code });
      console.error('Wheel spin error:', err);
      res.status(500).json({ error: 'WHEEL_SPIN_FAILED' });
    }
  });

  return router;
};
