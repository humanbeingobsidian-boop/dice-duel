// backend/src/routes/profile.js
const express = require('express');
const { requireTelegramAuth } = require('../middleware/telegramAuth');
const { getUserByTelegramId } = require('../db/queries');
const {
  awardDailyLogin,
  getProfileByTelegramId,
  updateProfile,
  buildProfile,
} = require('../db/profile');

module.exports = function createProfileRouter() {
  const router = express.Router();

  router.get('/profile', requireTelegramAuth, (req, res) => {
    try {
      const profile = getProfileByTelegramId(req.telegramUser.id);
      if (!profile) return res.status(404).json({ error: 'User not found' });
      res.json({ success: true, profile });
    } catch (err) {
      console.error('Profile fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  router.post('/profile/daily-login', requireTelegramAuth, (req, res) => {
    try {
      const user = getUserByTelegramId.get(String(req.telegramUser.id));
      if (!user) return res.status(404).json({ error: 'User not found' });
      const daily = awardDailyLogin(user.id);
      const profile = getProfileByTelegramId(req.telegramUser.id);
      res.json({ success: true, daily, profile });
    } catch (err) {
      console.error('Daily login error:', err);
      res.status(500).json({ error: 'Failed to award daily login' });
    }
  });

  router.patch('/profile', requireTelegramAuth, (req, res) => {
    try {
      const user = getUserByTelegramId.get(String(req.telegramUser.id));
      if (!user) return res.status(404).json({ error: 'User not found' });
      const updated = updateProfile(user.id, req.body || {});
      res.json({ success: true, profile: buildProfile(updated) });
    } catch (err) {
      console.error('Profile update error:', err);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  return router;
};
