// frontend/src/utils/telegram.js

/**
 * Get the Telegram WebApp object (or a mock in dev mode).
 */
export function getTelegramWebApp() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

/**
 * Get initData for auth. Returns mock string in dev mode.
 */
export function getInitData() {
  const tg = getTelegramWebApp();
  if (tg?.initData) {
    return tg.initData;
  }
  // Dev mode: generate a mock user ID
  const mockId = localStorage.getItem('dev_mock_id') || String(Math.floor(Math.random() * 90000) + 10000);
  localStorage.setItem('dev_mock_id', mockId);
  return `mock_${mockId}`;
}

/**
 * Expand the Mini App to full height.
 */
export function expandApp() {
  const tg = getTelegramWebApp();
  tg?.expand();
}

/**
 * Set the back button behavior.
 */
export function setBackButton(show, onClick) {
  const tg = getTelegramWebApp();
  if (!tg) return;
  if (show) {
    tg.BackButton.show();
    tg.BackButton.onClick(onClick);
  } else {
    tg.BackButton.hide();
  }
}

/**
 * Haptic feedback.
 */
export function haptic(type = 'medium') {
  const tg = getTelegramWebApp();
  tg?.HapticFeedback?.impactOccurred(type);
}

export function hapticNotification(type = 'success') {
  const tg = getTelegramWebApp();
  tg?.HapticFeedback?.notificationOccurred(type);
}

/**
 * Get theme colors from Telegram.
 */
export function getThemeParams() {
  const tg = getTelegramWebApp();
  return tg?.themeParams || {};
}

/**
 * Is this running inside Telegram?
 */
export function isInsideTelegram() {
  return !!(window.Telegram?.WebApp?.initData);
}
