// frontend/src/screens/ReconnectScreen.jsx
import React, { useEffect, useState } from 'react';
import { haptic } from '../utils/telegram';

export default function ReconnectScreen({ secondsLeft, onReturn, onGiveUp }) {
  const [secs, setSecs] = useState(secondsLeft ?? 30);

  // Sync with server ticks passed down from parent
  useEffect(() => {
    if (secondsLeft !== undefined) setSecs(secondsLeft);
  }, [secondsLeft]);

  const danger = secs <= 10;
  const pct = (secs / 30) * 100;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px', gap: '28px',
    }}>

      {/* Warning icon */}
      <div style={{ fontSize: '72px', animation: 'bounce 1s ease-in-out infinite' }}>⚠️</div>

      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
          יצאת מהמשחק!
        </h2>
        <p style={{ color: 'var(--text2)', fontSize: '15px' }}>
          חזור לפני שהזמן יגמר כדי להמשיך לשחק
        </p>
      </div>

      {/* Big countdown circle */}
      <div style={{ position: 'relative', width: '140px', height: '140px' }}>
        <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="70" cy="70" r="60"
            fill="none"
            stroke="var(--border)"
            strokeWidth="8"
          />
          <circle cx="70" cy="70" r="60"
            fill="none"
            stroke={danger ? 'var(--danger2)' : 'var(--accent2)'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 60}`}
            strokeDashoffset={`${2 * Math.PI * 60 * (1 - pct / 100)}`}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="font-display" style={{
            fontSize: '44px', fontWeight: 900, lineHeight: 1,
            color: danger ? 'var(--danger2)' : 'var(--text)',
            transition: 'color 0.3s',
          }}>
            {secs}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>שניות</div>
        </div>
      </div>

      {/* Warning bar */}
      {danger && (
        <div style={{
          background: 'rgba(239,68,68,0.15)',
          border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 'var(--radius)',
          padding: '12px 20px',
          textAlign: 'center',
          animation: 'pulse 0.8s ease-in-out infinite',
        }}>
          <span style={{ color: 'var(--danger2)', fontWeight: 700, fontSize: '14px' }}>
            ⚡ מהר! נשארו {secs} שניות בלבד
          </span>
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}>
        <button
          className="btn btn-primary btn-full"
          style={{ fontSize: '18px', padding: '18px',
            animation: 'glow 1.5s ease-in-out infinite',
          }}
          onClick={() => { haptic('heavy'); onReturn(); }}
        >
          🎲 חזור למשחק!
        </button>
        <button
          className="btn btn-ghost btn-full"
          style={{ fontSize: '14px', color: 'var(--text3)' }}
          onClick={() => { haptic('light'); onGiveUp(); }}
        >
          🏳️ ויתור (הפסד)
        </button>
      </div>
    </div>
  );
}
