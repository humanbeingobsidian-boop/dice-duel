// frontend/src/screens/LeaderboardScreen.jsx
import React, { useEffect, useState } from 'react';
import { t } from '../utils/i18n';
import { getPlayerAvatar, getPlayerAvatarStyle, getPlayerDisplayName } from '../utils/profileVisuals';
import LanguageSwitcher from '../components/LanguageSwitcher';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen({ lang = 'en', onLangChange, onBack, myTelegramId }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/leaderboard`)
      .then(r => r.json())
      .then(data => { setLeaderboard(data.leaderboard || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const scoreLabel = lang === 'he' ? 'ניקוד' : lang === 'ru' ? 'Очки' : 'Score';
  const winsLabel  = lang === 'he' ? 'נצחונות' : lang === 'ru' ? 'Победы' : 'Wins';
  const wrLabel    = lang === 'he' ? 'אחוז נצחון' : lang === 'ru' ? '% побед' : 'Win rate';
  const levelLabel = lang === 'he' ? 'רמה' : lang === 'ru' ? 'Ур.' : 'Lv.';

  return (
    <div className="screen" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '14px' }} onClick={onBack}>
            {t('lb_back', lang)}
          </button>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{t('lb_title', lang)}</h2>
        </div>
        <LanguageSwitcher lang={lang} onChange={onLangChange} />
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', fontSize: '12px', color: 'var(--text2)', marginBottom: '4px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <span>🎲 {lang === 'he' ? 'הימור נמוך' : lang === 'ru' ? 'Малая ставка' : 'Low stakes'} = <strong style={{color:'var(--accent2)'}}>1 {scoreLabel}</strong></span>
        <span>💎 {lang === 'he' ? 'הימור גבוה' : lang === 'ru' ? 'Высокая ставка' : 'High stakes'} = <strong style={{color:'var(--gold2)'}}>20 {scoreLabel}</strong></span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text2)' }}>{t('lb_loading', lang)}</div>
      ) : leaderboard.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text2)' }}>{t('lb_empty', lang)}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {leaderboard.map((player, i) => {
            const isMe = player.telegram_id === myTelegramId;
            const winRate = player.total_games > 0 ? Math.round((player.total_wins / player.total_games) * 100) : 0;
            const displayName = getPlayerDisplayName(player);
            const fallback = displayName.slice(0, 1).toUpperCase();
            const avatar = getPlayerAvatar(player, fallback);
            const avatarStyle = getPlayerAvatarStyle(player, isMe ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : i < 3 ? 'linear-gradient(135deg, #92400e, var(--gold))' : 'var(--surface2)');

            return (
              <div key={player.telegram_id} style={{ background: isMe ? 'rgba(124,58,237,0.15)' : 'var(--surface)', border: `1px solid ${isMe ? 'var(--accent)' : i < 3 ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', textAlign: 'center', flexShrink: 0, fontSize: i < 3 ? '20px' : '14px', fontWeight: 700, color: i < 3 ? 'var(--gold2)' : 'var(--text3)' }}>
                  {i < 3 ? MEDALS[i] : `${i + 1}`}
                </div>

                <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: player.avatar || player.selected_avatar ? '20px' : '14px', fontWeight: 700, color: 'white', ...avatarStyle }}>
                  {avatar}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayName}
                    </div>
                    {player.level && <span style={{ flexShrink: 0, color: 'var(--gold2)', fontSize: '11px', fontWeight: 800 }}>{levelLabel} {player.level}</span>}
                    {isMe && <span style={{ color: 'var(--accent2)', fontSize: '12px', flexShrink: 0 }}>{t('lb_you', lang)}</span>}
                  </div>
                  <div style={{ color: 'var(--text3)', fontSize: '12px', marginTop: '2px' }}>
                    {player.total_wins} {winsLabel} • {winRate}% {wrLabel}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="font-display" style={{ fontSize: '18px', fontWeight: 700, color: i < 3 ? 'var(--gold2)' : 'var(--accent2)' }}>
                    {(player.score || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{scoreLabel}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
