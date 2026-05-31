// frontend/src/screens/WaitingRoomScreen.jsx
import React, { useEffect, useState } from 'react';

const TOTAL_TIME = 60;

export default function WaitingRoomScreen({ game, players, myUserId, countdown, countdownActive }) {
  const [timeLeft, setTimeLeft] = useState(countdown ?? TOTAL_TIME);

  useEffect(() => {
    if (countdown !== undefined) setTimeLeft(countdown);
  }, [countdown]);

  const activePlayers = players?.filter(p => p.status === 'active') || [];
  const maxPlayers = game?.max_players || 6;
  const filledSlots = activePlayers.length;
  const emptySlots = maxPlayers - filledSlots;

  const progressPct = countdownActive ? ((TOTAL_TIME - timeLeft) / TOTAL_TIME) * 100 : 0;

  return (
    <div className="screen" style={{
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', paddingTop: '8px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700 }}>⏳ חדר המתנה</h2>
        <p style={{ color: 'var(--text2)', fontSize: '14px', marginTop: '4px' }}>
          חדר #{game?.room_code}
        </p>
      </div>

      {/* Countdown timer */}
      <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
        {countdownActive ? (
          <>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '8px' }}>
              המשחק מתחיל בעוד
            </div>
            <div className="font-display" style={{
              fontSize: '52px',
              fontWeight: 900,
              color: timeLeft <= 10 ? 'var(--danger2)' : 'var(--gold2)',
              lineHeight: 1,
              transition: 'color 0.3s',
            }}>
              {timeLeft}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '4px' }}>שניות</div>

            {/* Progress bar */}
            <div style={{
              height: '6px',
              background: 'var(--bg3)',
              borderRadius: '3px',
              marginTop: '16px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${progressPct}%`,
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
            <div style={{ fontSize: '42px', marginBottom: '8px', animation: 'pulse 2s infinite' }}>
              ⏳
            </div>
            <div style={{ color: 'var(--text2)', fontSize: '15px' }}>
              ממתינים לשחקן נוסף...
            </div>
            <div style={{ color: 'var(--text3)', fontSize: '13px', marginTop: '6px' }}>
              הטיימר יתחיל עם 2+ שחקנים
            </div>
          </>
        )}
      </div>

      {/* Players grid */}
      <div className="card">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>שחקנים</h3>
          <span style={{
            background: 'var(--accent)',
            color: 'white',
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 600,
          }}>
            {filledSlots}/{maxPlayers}
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
        }}>
          {activePlayers.map((player) => (
            <PlayerSlot
              key={player.user_id}
              player={player}
              isMe={player.user_id === myUserId}
            />
          ))}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <EmptySlot key={`empty-${i}`} />
          ))}
        </div>
      </div>

      {/* Pot */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.05))',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 'var(--radius)',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ color: 'var(--text2)', fontSize: '14px' }}>💰 קופה כרגע</span>
        <span className="font-display" style={{ fontSize: '22px', color: 'var(--gold2)', fontWeight: 700 }}>
          {game?.pot ?? 0}
        </span>
      </div>

      <div style={{
        textAlign: 'center',
        color: 'var(--text3)',
        fontSize: '13px',
      }}>
        🏠 עמלת הבית: 10% • הזוכה מקבל 90% מהקופה
      </div>
    </div>
  );
}

function PlayerSlot({ player, isMe }) {
  const name = player.first_name || player.username || 'שחקן';
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div style={{
      background: isMe ? 'rgba(124, 58, 237, 0.2)' : 'var(--bg3)',
      border: `2px solid ${isMe ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-sm)',
      padding: '12px 8px',
      textAlign: 'center',
      animation: 'pop 0.3s ease forwards',
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        background: isMe
          ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
          : 'var(--surface2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '13px',
        fontWeight: 700,
        margin: '0 auto 6px',
        color: 'white',
      }}>
        {initials}
      </div>
      <div style={{
        fontSize: '12px',
        fontWeight: 600,
        color: isMe ? 'var(--accent2)' : 'var(--text)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {isMe ? 'אתה' : name}
      </div>
    </div>
  );
}

function EmptySlot() {
  return (
    <div style={{
      background: 'var(--bg3)',
      border: '2px dashed var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '12px 8px',
      textAlign: 'center',
      opacity: 0.4,
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        background: 'var(--bg2)',
        margin: '0 auto 6px',
      }} />
      <div style={{ fontSize: '12px', color: 'var(--text3)' }}>פנוי</div>
    </div>
  );
}
