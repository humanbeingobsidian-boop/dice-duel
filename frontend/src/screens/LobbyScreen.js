import React from 'react';
import OriginalLobbyScreen from './LobbyScreen.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher';

function safeError(error) {
  if (!error) return null;
  const value = String(error);
  const lower = value.toLowerCase();
  if (lower.includes('real player') || lower.includes('bot')) {
    return 'Room closed. You can join again.';
  }
  return value;
}

export default function LobbyScreenRouter(props) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      'div',
      {
        style: {
          position: 'fixed',
          top: '12px',
          left: '24px',
          zIndex: 999,
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.35))',
        },
      },
      React.createElement(LanguageSwitcher, { lang: props.lang, onChange: props.onLangChange })
    ),
    React.createElement(OriginalLobbyScreen, { ...props, error: safeError(props.error) })
  );
}
