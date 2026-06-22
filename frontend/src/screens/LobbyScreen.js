import React from 'react';
import OriginalLobbyScreen from './LobbyScreen.jsx';

function safeError(error) {
  if (!error) return null;
  const value = String(error);
  const lower = value.toLowerCase();

  // Do not show internal room-closure reasons in the lobby.
  // This avoids exposing implementation details such as real players or bots.
  if (
    lower.includes('real player') ||
    lower.includes('bot') ||
    value.includes('שחקנים אמיתיים') ||
    value.includes('אמיתיים') ||
    value.includes('реальных игроков')
  ) {
    return null;
  }

  return value;
}

export default function LobbyScreenRouter(props) {
  return React.createElement(OriginalLobbyScreen, { ...props, error: safeError(props.error) });
}
