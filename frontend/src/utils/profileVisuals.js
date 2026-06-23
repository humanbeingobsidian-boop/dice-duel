// frontend/src/utils/profileVisuals.js

export function getProfileBackground(value) {
  switch (value) {
    case 'blue':
      return 'linear-gradient(135deg, #2563eb, #38bdf8)';
    case 'green':
      return 'linear-gradient(135deg, #059669, #34d399)';
    case 'gold':
      return 'linear-gradient(135deg, #d97706, #fbbf24)';
    case 'default_purple':
    default:
      return 'linear-gradient(135deg, #7c3aed, #a855f7)';
  }
}

export function getProfileFrameShadow(frame) {
  switch (frame) {
    case 'gold':
      return '0 0 16px rgba(251,191,36,0.55)';
    case 'neon':
      return '0 0 18px rgba(168,85,247,0.7), 0 0 8px rgba(6,182,212,0.55)';
    case 'purple':
      return '0 0 14px rgba(168,85,247,0.45)';
    default:
      return '0 4px 12px rgba(0,0,0,0.18)';
  }
}

export function getProfileFrameBorder(frame) {
  switch (frame) {
    case 'gold':
      return '2px solid var(--gold2)';
    case 'neon':
      return '2px solid #a855f7';
    case 'purple':
      return '2px solid var(--accent2)';
    default:
      return '1px solid rgba(255,255,255,0.14)';
  }
}

export function getPlayerDisplayName(player, fallback = 'Player') {
  return player?.display_name || player?.nickname || player?.first_name || player?.username || fallback;
}

export function getPlayerAvatar(player, fallback = '') {
  return player?.avatar || player?.selected_avatar || fallback;
}

export function getPlayerAvatarStyle(player, fallbackBackground) {
  return {
    background: player?.avatarColor || getProfileBackground(player?.background || player?.selected_background) || fallbackBackground,
    boxShadow: getProfileFrameShadow(player?.frame || player?.selected_frame),
    border: getProfileFrameBorder(player?.frame || player?.selected_frame),
  };
}

export function normalizePlayer(player) {
  if (!player) return player;
  return {
    ...player,
    display_name: getPlayerDisplayName(player),
    avatar: getPlayerAvatar(player),
    background: player.background || player.selected_background,
    frame: player.frame || player.selected_frame,
    title: player.title || player.selected_title,
  };
}
