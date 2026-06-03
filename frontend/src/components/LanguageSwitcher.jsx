// frontend/src/components/LanguageSwitcher.jsx
import React, { useState } from 'react';
import { LANGUAGES } from '../utils/i18n';
import { haptic } from '../utils/telegram';

export default function LanguageSwitcher({ lang, onChange }) {
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => { haptic('light'); setOpen(o => !o); }}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '6px 10px',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '13px', fontWeight: 600, color: 'var(--text)',
          fontFamily: 'inherit',
        }}
      >
        <span>{current.flag}</span>
        <span>{current.label}</span>
        <span style={{ fontSize: '10px', color: 'var(--text3)' }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '4px',
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', overflow: 'hidden',
          zIndex: 100, minWidth: '100px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => {
                haptic('light');
                onChange(l.code);
                setOpen(false);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '10px 14px',
                background: l.code === lang ? 'rgba(124,58,237,0.2)' : 'transparent',
                border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600,
                color: l.code === lang ? 'var(--accent2)' : 'var(--text)',
                fontFamily: 'inherit',
              }}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Close on outside click */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
