// frontend/src/screens/ReconnectScreen.jsx
import React, { useEffect, useState } from 'react';
import { haptic } from '../utils/telegram';

const TEXT = {
  he: {
    title: 'מצאנו משחק פעיל',
    subtitle: 'אפשר לחזור למשחק ולהמשיך מהנקודה שבה היית, או לוותר ולעבור למסך התוצאה.',
    seconds: 'שניות',
    danger: secs => `⚡ מהר! נשארו ${secs} שניות בלבד`,
    return: '🎲 חזור למשחק',
    giveUp: '🏳️ ויתור',
    returning: 'חוזר למשחק...',
  },
  en: {
    title: 'Active game found',
    subtitle: 'Return to your current game and continue, or give up and go to the result screen.',
    seconds: 'seconds',
    danger: secs => `⚡ Hurry! Only ${secs} seconds left`,
    return: '🎲 Return to Game',
    giveUp: '🏳️ Give Up',
    returning: 'Returning...',
  },
  ru: {
    title: 'Найдена активная игра',
    subtitle: 'Вернись в текущую игру и продолжай, или сдайся и перейди к результату.',
    seconds: 'секунд',
    danger: secs => `⚡ Быстрее! Осталось ${secs} секунд`,
    return: '🎲 Вернуться в игру',
    giveUp: '🏳️ Сдаться',
    returning: 'Возвращаемся...',
  },
};

export default function ReconnectScreen({ lang = 'he', secondsLeft, onReturn, onGiveUp }) {
  const [secs, setSecs] = useState(secondsLeft ?? 30);
  const [busy, setBusy] = useState(false);
  const s = TEXT[lang] || TEXT.en;

  useEffect(() => {
    if (secondsLeft !== undefined) setSecs(secondsLeft);
  }, [secondsLeft]);

  const danger = secs <= 10;
  const pct = Math.max(0, Math.min(100, (secs / 30) * 100));

  function handleReturn() {
    if (busy) return;
    setBusy(true);
    haptic('heavy');
    onReturn();
    setTimeout(() => setBusy(false), 1200);
  }

  function handleGiveUp() {
    if (busy) return;
    setBusy(true);
    haptic('light');
    onGiveUp();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px', gap: '24px',
    }}>
      <div style={{
        width: '88px', height: '88px', borderRadius: '50%',
        background: danger ? 'rgba(239,68,68,0.16)' : 'rgba(124,58,237,0.18)',
        border: danger ? '1px solid rgba(239,68,68,0.45)' : '1px solid rgba(168,85,247,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '46px', animation: danger ? 'pulse 0.8s ease-in-out infinite' : 'bounce 1.2s ease-in-out infinite',
      }}>
        🎲
      </div>

      <div style={{ textAlign: 'center', maxWidth: '340px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>
          {s.title}
        </h2>
        <p style={{ color: 'var(--text2)', fontSize: '15px', lineHeight: 1.45 }}>
          {s.subtitle}
        </p>
      </div>

      <div style={{ position: 'relative', width: '140px', height: '140px' }}>
        <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="70" cy="70" r="60" fill="none" stroke="var(--border)" strokeWidth="8" />
          <circle
            cx="70" cy="70" r="60" fill="none"
            stroke={danger ? 'var(--danger2)' : 'var(--accent2)'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 60}`}
            strokeDashoffset={`${2 * Math.PI * 60 * (1 - pct / 100)}`}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="font-display" style={{ fontSize: '44px', fontWeight: 900, lineHeight: 1, color: danger ? 'var(--danger2)' : 'var(--text)', transition: 'color 0.3s' }}>
            {secs}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{s.seconds}</div>
        </div>
      </div>

      {danger && (
        <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 'var(--radius)', padding: '12px 20px', textAlign: 'center', animation: 'pulse 0.8s ease-in-out infinite' }}>
          <span style={{ color: 'var(--danger2)', fontWeight: 700, fontSize: '14px' }}>{s.danger(secs)}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}>
        <button className="btn btn-primary btn-full" style={{ fontSize: '18px', padding: '18px', opacity: busy ? 0.72 : 1, animation: 'glow 1.5s ease-in-out infinite' }} onClick={handleReturn} disabled={busy}>
          {busy ? s.returning : s.return}
        </button>
        <button className="btn btn-ghost btn-full" style={{ fontSize: '14px', color: 'var(--text3)', opacity: busy ? 0.55 : 1 }} onClick={handleGiveUp} disabled={busy}>
          {s.giveUp}
        </button>
      </div>
    </div>
  );
}
