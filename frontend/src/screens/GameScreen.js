import React from 'react';
import OriginalGameScreen from './GameScreen.jsx';
import GameScreenRussian from './GameScreenRussian.jsx';

export default function GameScreenRouter(props) {
  const Component = props.lang === 'ru' ? GameScreenRussian : OriginalGameScreen;
  return React.createElement(Component, props);
}
