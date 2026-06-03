// frontend/src/screens/WaitingRoomScreen.jsx
import React, { useEffect, useState } from 'react';
import { haptic } from '../utils/telegram';
import { t } from '../utils/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

const TOTAL_TIME = 60;

// FIX #7: truncate long names
function truncateName(name, max = 10) {
  if (!name) return '';
  return name.length > max ? name.slice(0, max) + '…' : name;
}

export default function WaitingRoomScreen({
  lang = 'en', onLangChange, game, players, myUserId,
  countdown, countdownActive,
  onLeave, readyPlayers = [], onToggleReady,
}) {
  const [timeLeft, setTimeLeft] = useState(countdown ?? TOTAL_TIME);
  const [leaving, setLeaving] = useState(false);
  const [allReadyMsg, setAllReadyMsg] = useState(false);

  useEffect(() => {
    if (countdown !== undefined) setTimeLeft(countdown);
  }, [countdown]);

  const activePlayers = players?.filter(p => p.status === 'active') || [];
  const maxPlayers = game?.max_players || 6;
  const emptySlots = maxPlayers - activePlayers.length;
  const progressPct = countdownActive ? ((TOTAL_TIME - timeLeft) / TOTAL_TIME) * 100 : 0;

  const amIReady = readyPlayers.includes(myUserId);
  const readyCount = activePlayers.filter(p => readyPlayers.includes(p.user_id)).length;
  const allReady = activePlayers.length >= 2 && readyCount === activePlayers.length;

  useEffect(() => {
    if (allReady) {
      setAllReadyMsg(true);
      const t = setTimeout(() => setAllReadyMsg(false), 3000);
      return () => clearTimeout(t);
    }
  }, [allReady]);

  return (
    <div className="screen" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Header — title left, lang switcher right, leave button below */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{t('waiting_title', lang)}</h2>
            <p style={{ color: 'var(--text2)', fontSize: '13px', marginTop: '2px' }}>
              {t('waiting_room', lang)} #{game?.room_code}
            </p>
          </div>
          <LanguageSwitcher lang={lang} onChange={onLangChange} />
        </div>
        <button
          className="btn btn-danger"
          style={{ alignSelf: 'flex-start', padding: '8px 16px', fontSize: '13px' }}
          onClick={() => { haptic('medium'); setLeaving(true); onLeave(); }}
          disabled={leaving}
        >
          {leaving ? t('waiting_leaving', lang) : t('waiting_leave', lang)}
        </button>
      </div>

      {/* All ready banner */}
      {allReadyMsg && (
        <div style={{
          background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
          borderRadius: 'var(--radius)', padding: '12px', textAlign: 'center',
          animation: 'pop 0.3s ease', fontWeight: 700, color: 'var(--success2)',
        }}>
          {t('waiting_all_ready', lang)}
        </div>
      )}

      {/* Countdown */}
      <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
        {countdownActive ? (
          <>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '8px' }}>
              {t('waiting_starts_in', lang)}
            </div>
            <div className="font-display" style={{
              fontSize: '52px', fontWeight: 900, lineHeight: 1,
              color: timeLeft <= 10 ? 'var(--danger2)' : 'var(--gold2)',
              transition: 'color 0.3s',
            }}>
              {timeLeft}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '4px' }}>
              {t('waiting_seconds', lang)}
            </div>
            <div style={{
              height: '6px', background: 'var(--bg3)', borderRadius: '3px',
              marginTop: '14px', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${progressPct}%`,
                background: timeLeft <= 10
                  ? 'linear-gradient(90deg, var(--danger), var(--danger2))'
                  : 'linear-gradient(90deg, var(--accent), var(--gold2))',
                borderRadius: '3px',
                transition: 'width 1s linear, background 0.3s',
              }} />
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '38px', marginBottom: '8px', animation: 'pulse 2s infinite' }}>⏳</div>
            <div style={{ color: 'var(--text2)', fontSize: '15px' }}>{t('waiting_for_player', lang)}</div>
            <div style={{ color: 'var(--text3)', fontSize: '13px', marginTop: '6px' }}>
              {t('waiting_timer_hint', lang)}
            </div>
          </>
        )}
      </div>

      {/* Players grid */}
      <div className="card">
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px',
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>{t('waiting_players', lang)}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activePlayers.length >= 2 && (
              <span style={{ fontSize: '13px', color: 'var(--text3)' }}>
                {readyCount}/{activePlayers.length} ready
              </span>
            )}
            <span style={{
              background: 'var(--accent)', color: 'white',
              padding: '3px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
            }}>
              {activePlayers.length}/{maxPlayers}
            </span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {activePlayers.map(player => (
            <PlayerSlot
              key={player.user_id}
              player={player}
              isMe={player.user_id === myUserId}
              isReady={readyPlayers.includes(player.user_id)}
              lang={lang}
            />
          ))}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <EmptySlot key={`empty-${i}`} lang={lang} />
          ))}
        </div>
      </div>

      {/* Ready button — FIX #4 */}
      {activePlayers.length >= 2 && (
        <button
          className={`btn btn-full ${amIReady ? 'btn-ghost' : 'btn-primary'}`}
          style={{
            fontSize: '16px', padding: '14px',
            border: amIReady ? '2px solid var(--success2)' : undefined,
            color: amIReady ? 'var(--success2)' : undefined,
          }}
          onClick={() => { haptic('medium'); onToggleReady(); }}
        >
          {amIReady ? t('waiting_ready', lang) : t('waiting_unready', lang)}
        </button>
      )}

      {/* Pot */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.05))',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 'var(--radius)', padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: 'var(--text2)', fontSize: '14px' }}>{t('waiting_pot', lang)}</span>
        <span className="font-display" style={{ fontSize: '22px', color: 'var(--gold2)', fontWeight: 700 }}>
          {game?.pot ?? 0}
        </span>
      </div>

      <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '12px' }}>
        {t('waiting_house', lang)}
      </div>
    </div>
  );
}

function PlayerSlot({ player, isMe, isReady, lang }) {
  const name = truncateName(player.first_name || player.username || 'Player');
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div style={{
      background: isMe ? 'rgba(124,58,237,0.2)' : 'var(--bg3)',
      border: `2px solid ${isReady ? 'var(--success2)' : isMe ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-sm)', padding: '10px 6px', textAlign: 'center',
      animation: 'pop 0.3s ease forwards', position: 'relative',
    }}>
      {/* FIX #5: ready checkmark */}
      {isReady && (
        <div style={{
          position: 'absolute', top: '-6px', right: '-6px',
          background: 'var(--success2)', color: 'white',
          width: '18px', height: '18px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 700,
        }}>✓</div>
      )}
      <div style={{
        width: '34px', height: '34px', borderRadius: '50%',
        background: isMe ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'var(--surface2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '12px', fontWeight: 700, margin: '0 auto 5px', color: 'white',
      }}>
        {initials}
      </div>
      <div style={{
        fontSize: '11px', fontWeight: 600,
        color: isMe ? 'var(--accent2)' : 'var(--text)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {isMe ? t('waiting_you', lang) : name}
      </div>
    </div>
  );
}

function EmptySlot({ lang }) {
  return (
    <div style={{
      background: 'var(--bg3)', border: '2px dashed var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '10px 6px', textAlign: 'center', opacity: 0.4,
    }}>
      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--bg2)', margin: '0 auto 5px' }} />
      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{t('waiting_empty', lang)}</div>
    </div>
  );
}
