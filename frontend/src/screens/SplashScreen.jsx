// frontend/src/screens/SplashScreen.jsx
import React, { useEffect, useState } from 'react';
import { haptic } from '../utils/telegram';
import { t } from '../utils/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function SplashScreen({ lang = 'en', onLangChange, onEnter }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  const rules = [
    ['🎲', t('splash_rule_roll', lang)],
    ['👥', t('splash_rule_players', lang)],
    ['⏱️', t('splash_rule_timer', lang)],
    ['💀', t('splash_rule_elim', lang)],
    ['🏆', t('splash_rule_win', lang)],
  ];
  return (
    <div className="screen" style={{
      background: 'radial-gradient(ellipse at 50% 30%, #1a0a3a 0%, var(--bg) 70%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px', gap: '20px',
      opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease',
    }}>

      {/* Top bar with lang switcher */}
      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', justifyContent: 'flex-end' }}>
        <LanguageSwitcher lang={lang} onChange={onLangChange} />
      </div>

      {/* Logo */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '72px', marginBottom: '6px', animation: 'bounce 2s ease-in-out infinite' }}>🎲</div>
        <h1 className="font-display" style={{
          fontSize: '36px', fontWeight: 900, letterSpacing: '2px', lineHeight: 1.1,
          background: 'linear-gradient(135deg, #a855f7, #f59e0b)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          {t('splash_title', lang)}
        </h1>
        <p style={{ color: 'var(--text2)', marginTop: '6px', fontSize: '14px' }}>
          {t('splash_subtitle', lang)}
        </p>
      </div>

      {/* Rules card */}
      <div className="card" style={{ width: '100%', maxWidth: '360px', background: 'rgba(30,30,46,0.8)' }}>
        <h3 style={{ color: 'var(--accent2)', marginBottom: '10px', fontSize: '14px', fontWeight: 700 }}>
          {t('splash_rules_title', lang)}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rules.map(([icon, text]) => (
            <div key={text} style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px' }}>
              <span style={{ fontSize: '16px' }}>{icon}</span>
              <span style={{ color: 'var(--text2)' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Starting credits notice — FIX #3+4 */}
      <div style={{
        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
        borderRadius: 'var(--radius)', padding: '12px 20px', textAlign: 'center',
        width: '100%', maxWidth: '360px',
      }}>
        <p style={{ color: 'var(--success2)', fontSize: '13px', fontWeight: 600 }}>
          {t('splash_bonus', lang)}
        </p>
      </div>

      <button
        className="btn btn-primary btn-full"
        style={{ maxWidth: '360px', fontSize: '18px', padding: '16px' }}
        onClick={() => { haptic('medium'); onEnter(); }}
      >
        {t('splash_play', lang)}
      </button>
    </div>
  );
}
