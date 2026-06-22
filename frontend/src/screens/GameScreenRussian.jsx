import React, { useEffect } from 'react';
import GameScreenEnglish from './GameScreenEnglish';

const u = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

const MAP = [
  ['Room', u('\\u041a\\u043e\\u043c\\u043d\\u0430\\u0442\\u0430')],
  ['Active Game', u('\\u0418\\u0433\\u0440\\u0430 \\u0430\\u043a\\u0442\\u0438\\u0432\\u043d\\u0430')],
  ['Pot', u('\\u0411\\u0430\\u043d\\u043a')],
  ['Warning:', u('\\u0412\\u043d\\u0438\\u043c\\u0430\\u043d\\u0438\\u0435:')],
  ['disconnected', u('\\u043e\\u0442\\u043a\\u043b\\u044e\\u0447\\u0438\\u043b\\u0441\\u044f')],
  ['You are disconnected. Return quickly.', u('\\u0422\\u044b \\u043e\\u0442\\u043a\\u043b\\u044e\\u0447\\u0435\\u043d. \\u0412\\u0435\\u0440\\u043d\\u0438\\u0441\\u044c \\u0432 \\u0438\\u0433\\u0440\\u0443 \\u043a\\u0430\\u043a \\u043c\\u043e\\u0436\\u043d\\u043e \\u0431\\u044b\\u0441\\u0442\\u0440\\u0435\\u0435.')],
  ['was eliminated', u('\\u0432\\u044b\\u0431\\u044b\\u043b \\u0438\\u0437 \\u0438\\u0433\\u0440\\u044b')],
  ['Your turn!', u('\\u0422\\u0432\\u043e\\u0439 \\u0445\\u043e\\u0434!')],
  ['Tap the button to roll', u('\\u041d\\u0430\\u0436\\u043c\\u0438 \\u043a\\u043d\\u043e\\u043f\\u043a\\u0443, \\u0447\\u0442\\u043e\\u0431\\u044b \\u0431\\u0440\\u043e\\u0441\\u0438\\u0442\\u044c \\u043a\\u0443\\u0431\\u0438\\u043a')],
  ['Turn', u('\\u0425\\u043e\\u0434')],
  ['rolled', u('\\u0431\\u0440\\u043e\\u0441\\u0438\\u043b')],
  ['Roll Dice', u('\\u0411\\u0440\\u043e\\u0441\\u0438\\u0442\\u044c \\u043a\\u0443\\u0431\\u0438\\u043a')],
  ['Lost', u('\\u041f\\u0440\\u043e\\u0438\\u0433\\u0440\\u044b\\u0448')],
  ['You were eliminated', u('\\u0422\\u044b \\u0432\\u044b\\u0431\\u044b\\u043b \\u0438\\u0437 \\u0438\\u0433\\u0440\\u044b')],
  ['You can leave now or wait for the game to end.', u('\\u041c\\u043e\\u0436\\u043d\\u043e \\u0432\\u044b\\u0439\\u0442\\u0438 \\u0441\\u0435\\u0439\\u0447\\u0430\\u0441 \\u0438\\u043b\\u0438 \\u0434\\u043e\\u0436\\u0434\\u0430\\u0442\\u044c\\u0441\\u044f \\u043a\\u043e\\u043d\\u0446\\u0430 \\u0438\\u0433\\u0440\\u044b.')],
  ['Leave Game', u('\\u0412\\u044b\\u0439\\u0442\\u0438 \\u0438\\u0437 \\u0438\\u0433\\u0440\\u044b')],
  ['Players', u('\\u0418\\u0433\\u0440\\u043e\\u043a\\u0438')],
  ['left', u('\\u043e\\u0441\\u0442\\u0430\\u043b\\u043e\\u0441\\u044c')],
  ['Playing', u('\\u0418\\u0433\\u0440\\u0430\\u0435\\u0442')],
  ['you', u('\\u0442\\u044b')],
  ['eliminated', u('\\u0432\\u044b\\u0431\\u044b\\u043b')],
  ['disconnecting', u('\\u043e\\u0442\\u043a\\u043b\\u044e\\u0447\\u0430\\u0435\\u0442\\u0441\\u044f')],
];

function translateNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    let value = node.nodeValue;
    for (const [from, to] of MAP) value = value.split(from).join(to);
    node.nodeValue = value;
  } else {
    node.childNodes.forEach(translateNode);
  }
}

export default function GameScreenRussian(props) {
  useEffect(() => {
    const root = document.querySelector('.screen');
    if (root) translateNode(root);
  });
  return <GameScreenEnglish {...props} lang="en" />;
}
