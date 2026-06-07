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
 * Get invite code from Mini App startapp param.
 * t.me/Bot/app?startapp=CODE1234 → "CODE1234"
 */
export function getStartAppParam() {
  const tg = getTelegramWebApp();
  // Telegram passes startapp via initDataUnsafe.start_param
  const param = tg?.initDataUnsafe?.start_param;
  if (param && !param.startsWith('ref')) {
    return param; // it's an invite code
  }
  // Fallback: URL ?startapp=
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('startapp') || null;
}
 * Deep link: t.me/bot?start=ref123 → start_param = "ref123"
 */
export function getReferralCode() {
  const tg = getTelegramWebApp();
  // First try Telegram's start_param (from deep link)
  const startParam = tg?.initDataUnsafe?.start_param;
  if (startParam && startParam.startsWith('ref')) {
    return startParam.replace('ref', '');
  }
  // Fallback: URL query param ?ref=
  const urlParams = new URLSearchParams(window.location.search);
  const refParam = urlParams.get('ref');
  if (refParam) return refParam;
  return null;
}

/**
 * Is this running inside Telegram?
 */
export function isInsideTelegram() {
  return !!(window.Telegram?.WebApp?.initData);
}
