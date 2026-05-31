// frontend/src/screens/LobbyScreen.jsx
import React from 'react';
import { haptic } from '../utils/telegram';

export default function LobbyScreen({ user, onJoin, onLeaderboard, onBack, loading, error }) {
  return (
    <div className="screen" style={{
      background: 'radial-gradient(ellipse at 50% 20%, #1a0a3a 0%, var(--bg) 60%)',
      padding: '24px',
      gap: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Back button */}
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <button
          className="btn btn-ghost"
          style={{ padding: '8px 16px', fontSize: '14px' }}
          onClick={() => { haptic('light'); onBack(); }}
        >
          ← חזור
        </button>
      </div>

      {/* User card */}
      <div style={{
        width: '100%',
        maxWidth: '360px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '2px' }}>שחקן</div>
          <div style={{ fontWeight: 700, fontSize: '17px' }}>
            {user?.first_name || 'שחקן'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '2px' }}>יתרה</div>
          <div style={{
            fontWeight: 700,
            fontSize: '22px',
            color: 'var(--gold2)',
            fontFamily: 'Orbitron, sans-serif',
          }}>
            {user?.balance ?? (
              <span style={{ fontSize: '14px', color: 'var(--text3)', animation: 'pulse 1s infinite' }}>
                טוען...
              </span>
            )}
            {user?.balance !== undefined && (
              <span style={{ fontSize: '13px', color: 'var(--text3)', fontFamily: 'Space Grotesk', marginRight: '4px' }}>
                {' '}קרדיטים
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Join Game card */}
      <div className="card" style={{
        width: '100%',
        maxWidth: '360px',
        textAlign: 'center',
        padding: '32px 24px',
      }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎲</div>
        <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
          כניסה למשחק
        </h2>
        <p style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '24px' }}>
          תצטרף לחדר קיים או צור חדר חדש.<br />
          המשחק מתחיל עם 2+ שחקנים.
        </p>

        {/* Cost */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          alignItems: 'center',
          marginBottom: '20px',
          background: 'var(--bg3)',
          padding: '12px 20px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '20px' }}>🪙</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gold2)' }}>100 קרדיטים</span>
          <span style={{ color: 'var(--text3)', fontSize: '14px' }}>לכניסה</span>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px',
            color: 'var(--danger2)',
            fontSize: '14px',
            marginBottom: '16px',
          }}>
            ❌ {error}
          </div>
        )}

        {/* Loading state — user not yet fetched */}
        {!user ? (
          <div style={{
            padding: '14px',
            color: 'var(--text3)',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}>
            <span style={{
              width: '16px', height: '16px',
              border: '2px solid var(--border)',
              borderTopColor: 'var(--accent2)',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'spin 0.8s linear infinite',
            }} />
            מתחבר לשרת...
          </div>
        ) : (
          <button
            className="btn btn-primary btn-full"
            onClick={() => { haptic('medium'); onJoin(); }}
            disabled={loading || user.balance < 100}
            style={{ fontSize: '17px', padding: '16px' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '18px', height: '18px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite',
                }} />
                מצטרף...
              </span>
            ) : '🚀 הצטרף למשחק'}
          </button>
        )}

        {user && user.balance < 100 && (
          <p style={{ color: 'var(--danger2)', fontSize: '13px', marginTop: '10px' }}>
            אין מספיק קרדיטים. צריך לפחות 100.
          </p>
        )}
      </div>

      {/* Stats */}
      {user && (
        <div style={{
          display: 'flex',
          gap: '12px',
          width: '100%',
          maxWidth: '360px',
        }}>
          {[
            { label: 'משחקים', value: user.total_games ?? 0 },
            { label: 'ניצחונות', value: user.total_wins ?? 0 },
            {
              label: 'אחוז ניצחון',
              value: user.total_games > 0
                ? `${Math.round((user.total_wins / user.total_games) * 100)}%`
                : '0%',
            },
          ].map(({ label, value }) => (
            <div key={label} style={{
              flex: 1,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '14px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent2)' }}>
                {value}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard button */}
      <button
        className="btn btn-ghost"
        style={{ maxWidth: '360px', width: '100%' }}
        onClick={() => { haptic('light'); onLeaderboard(); }}
      >
        🏅 לוח מצטיינים
      </button>
    </div>
  );
}
