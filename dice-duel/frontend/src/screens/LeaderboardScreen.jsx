// frontend/src/screens/LeaderboardScreen.jsx
import React, { useEffect, useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen({ onBack, myTelegramId }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/leaderboard`)
      .then(r => r.json())
      .then(data => {
        setLeaderboard(data.leaderboard || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="screen" style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '24px',
        paddingTop: '4px',
      }}>
        <button
          className="btn btn-ghost"
          style={{ padding: '10px 16px', fontSize: '15px' }}
          onClick={onBack}
        >
          ← חזור
        </button>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>🏅 לוח מצטיינים</h2>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text2)' }}>
          טוען...
        </div>
      ) : leaderboard.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text2)' }}>
          אין שחקנים עדיין
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {leaderboard.map((player, i) => {
            const isMe = player.telegram_id === myTelegramId;
            const winRate = player.total_games > 0
              ? Math.round((player.total_wins / player.total_games) * 100)
              : 0;

            return (
              <div
                key={player.telegram_id}
                style={{
                  background: isMe ? 'rgba(124,58,237,0.15)' : 'var(--surface)',
                  border: `1px solid ${isMe ? 'var(--accent)' : i < 3 ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  animation: `fadeIn ${0.1 + i * 0.05}s ease forwards`,
                }}>
                {/* Rank */}
                <div style={{
                  width: '32px',
                  textAlign: 'center',
                  fontSize: i < 3 ? '22px' : '16px',
                  fontWeight: 700,
                  color: i < 3 ? 'var(--gold2)' : 'var(--text3)',
                  flexShrink: 0,
                }}>
                  {i < 3 ? MEDALS[i] : `${i + 1}`}
                </div>

                {/* Avatar */}
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: isMe
                    ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                    : i < 3
                      ? 'linear-gradient(135deg, #92400e, var(--gold))'
                      : 'var(--surface2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'white',
                  flexShrink: 0,
                }}>
                  {(player.first_name || 'P').slice(0, 1).toUpperCase()}
                </div>

                {/* Name + stats */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700,
                    fontSize: '15px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {player.first_name}
                    {isMe && <span style={{ color: 'var(--accent2)', fontSize: '12px', marginRight: '6px' }}> (אתה)</span>}
                  </div>
                  <div style={{ color: 'var(--text3)', fontSize: '12px', marginTop: '2px' }}>
                    {player.total_wins} ניצחונות • {winRate}% אחוז ניצחון
                  </div>
                </div>

                {/* Balance */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="font-display" style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: 'var(--gold2)',
                  }}>
                    {player.balance}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>קרדיטים</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
