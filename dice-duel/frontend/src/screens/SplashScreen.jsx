// frontend/src/screens/SplashScreen.jsx
import React, { useEffect, useState } from 'react';
import { haptic } from '../utils/telegram';

export default function SplashScreen({ onEnter }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  return (
    <div className="screen" style={{
      background: 'radial-gradient(ellipse at 50% 30%, #1a0a3a 0%, var(--bg) 70%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      gap: '32px',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.5s ease',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: '80px',
          marginBottom: '8px',
          animation: 'bounce 2s ease-in-out infinite',
          display: 'block',
        }}>🎲</div>
        <h1 className="font-display" style={{
          fontSize: '36px',
          fontWeight: 900,
          letterSpacing: '2px',
          background: 'linear-gradient(135deg, #a855f7, #f59e0b)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          lineHeight: 1.1,
        }}>
          DICE DUEL
        </h1>
        <p style={{ color: 'var(--text2)', marginTop: '8px', fontSize: '15px' }}>
          משחק קוביות מולטיפלייר
        </p>
      </div>

      {/* Rules card */}
      <div className="card" style={{
        width: '100%',
        maxWidth: '360px',
        background: 'rgba(30, 30, 46, 0.8)',
        backdropFilter: 'blur(10px)',
      }}>
        <h3 style={{ color: 'var(--accent2)', marginBottom: '12px', fontSize: '15px', fontWeight: 700 }}>
          📋 איך משחקים?
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            ['🪙', 'כניסה: 100 קרדיטים'],
            ['👥', '2-6 שחקנים בכל חדר'],
            ['⏱️', '60 שניות לחדר מלא'],
            ['🎲', 'כל תור שחקן זורק קובייה'],
            ['💀', 'יצא 1? אתה מודח!'],
            ['🏆', 'השורד האחרון לוקח הכל'],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '14px' }}>
              <span style={{ fontSize: '18px' }}>{icon}</span>
              <span style={{ color: 'var(--text2)' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Starting credits notice */}
      <div style={{
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: 'var(--radius)',
        padding: '14px 20px',
        textAlign: 'center',
        width: '100%',
        maxWidth: '360px',
      }}>
        <p style={{ color: 'var(--success2)', fontSize: '14px', fontWeight: 600 }}>
          🎁 שחקנים חדשים מקבלים 500 קרדיטים חינם!
        </p>
      </div>

      {/* Enter button */}
      <button
        className="btn btn-primary btn-full"
        style={{ maxWidth: '360px', fontSize: '18px', padding: '18px' }}
        onClick={() => {
          haptic('medium');
          onEnter();
        }}
      >
        🎮 התחל לשחק
      </button>
    </div>
  );
}
