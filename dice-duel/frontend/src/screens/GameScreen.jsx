// frontend/src/screens/GameScreen.jsx
import React, { useState, useEffect } from 'react';
import Dice from '../components/Dice';
import { haptic, hapticNotification } from '../utils/telegram';

export default function GameScreen({
  game,
  players,
  activePlayers,
  currentPlayer,
  myUserId,
  lastRoll,
  onRoll,
  rolling,
  rollError,
}) {
  const [showEliminated, setShowEliminated] = useState(null);

  const isMyTurn = currentPlayer?.user_id === myUserId;
  const myPlayerData = players?.find(p => p.user_id === myUserId);
  const isEliminated = myPlayerData?.status === 'eliminated';

  useEffect(() => {
    if (lastRoll?.isEliminated) {
      setShowEliminated(lastRoll.firstName);
      hapticNotification('error');
      setTimeout(() => setShowEliminated(null), 2500);
    } else if (lastRoll?.diceResult) {
      haptic(isMyTurn ? 'heavy' : 'light');
    }
  }, [lastRoll]);

  const sortedActive = [...(activePlayers || [])];
  const sortedAll = [...(players || [])];

  return (
    <div className="screen" style={{
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '4px',
      }}>
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text3)' }}>חדר #{game?.room_code}</div>
          <div style={{ fontWeight: 700, fontSize: '17px' }}>🎲 משחק פעיל</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,191,36,0.08))',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 'var(--radius)',
          padding: '8px 14px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--gold)', marginBottom: '2px' }}>קופה</div>
          <div className="font-display" style={{ fontSize: '18px', color: 'var(--gold2)', fontWeight: 700 }}>
            {game?.pot ?? 0}
          </div>
        </div>
      </div>

      {/* Eliminated banner */}
      {showEliminated && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: 'var(--radius)',
          padding: '12px',
          textAlign: 'center',
          animation: 'pop 0.3s ease forwards',
        }}>
          <span style={{ color: 'var(--danger2)', fontWeight: 700 }}>
            💀 {showEliminated} הודח מהמשחק!
          </span>
        </div>
      )}

      {/* Current turn indicator */}
      <div style={{
        background: isMyTurn
          ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(168,85,247,0.1))'
          : 'var(--surface)',
        border: `2px solid ${isMyTurn ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '16px',
        textAlign: 'center',
        animation: isMyTurn ? 'glow 2s ease-in-out infinite' : 'none',
      }}>
        {isMyTurn ? (
          <>
            <div style={{ fontSize: '14px', color: 'var(--accent2)', fontWeight: 600 }}>
              🎯 התור שלך!
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '2px' }}>
              לחץ על הקובייה לזרוק
            </div>
          </>
        ) : currentPlayer ? (
          <>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '2px' }}>תור</div>
            <div style={{ fontWeight: 700, fontSize: '17px' }}>
              {currentPlayer.first_name}
            </div>
          </>
        ) : null}
      </div>

      {/* Dice area */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        padding: '20px 0',
      }}>
        <div
          style={{
            cursor: isMyTurn && !rolling && !isEliminated ? 'pointer' : 'default',
            transform: isMyTurn && !rolling ? 'scale(1)' : 'scale(0.95)',
            transition: 'transform 0.2s',
          }}
          onClick={() => {
            if (isMyTurn && !rolling && !isEliminated) onRoll();
          }}
        >
          <Dice
            value={lastRoll?.diceResult}
            rolling={rolling}
          />
        </div>

        {lastRoll && !rolling && (
          <div style={{
            textAlign: 'center',
            animation: 'fadeIn 0.3s ease forwards',
          }}>
            <div style={{ fontSize: '15px', color: 'var(--text2)' }}>
              {lastRoll.firstName} זרק{' '}
              <strong style={{ color: lastRoll.diceResult === 1 ? 'var(--danger2)' : 'var(--gold2)' }}>
                {lastRoll.diceResult}
              </strong>
              {lastRoll.isEliminated && (
                <span style={{ color: 'var(--danger2)' }}> — הודח! 💀</span>
              )}
            </div>
          </div>
        )}

        {rollError && (
          <div style={{ color: 'var(--danger2)', fontSize: '14px', textAlign: 'center' }}>
            ❌ {rollError}
          </div>
        )}

        {isMyTurn && !rolling && !isEliminated && (
          <button
            className="btn btn-primary"
            style={{ minWidth: '180px', fontSize: '17px' }}
            onClick={() => onRoll()}
          >
            🎲 זרוק קובייה!
          </button>
        )}

        {isEliminated && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius)',
            padding: '16px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '6px' }}>💀</div>
            <div style={{ color: 'var(--danger2)', fontWeight: 700 }}>הודחת מהמשחק</div>
            <div style={{ color: 'var(--text2)', fontSize: '13px', marginTop: '4px' }}>
              המתן לסוף המשחק...
            </div>
          </div>
        )}
      </div>

      {/* Players list */}
      <div className="card" style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--text2)' }}>
          שחקנים ({sortedActive.length} נשארו)
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sortedAll.map(player => (
            <PlayerRow
              key={player.user_id}
              player={player}
              isMe={player.user_id === myUserId}
              isCurrent={currentPlayer?.user_id === player.user_id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayerRow({ player, isMe, isCurrent }) {
  const isActive = player.status === 'active';
  const isEliminated = player.status === 'eliminated';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 12px',
      background: isCurrent ? 'rgba(124,58,237,0.15)' : isEliminated ? 'rgba(239,68,68,0.05)' : 'var(--bg3)',
      border: `1px solid ${isCurrent ? 'var(--accent)' : isEliminated ? 'rgba(239,68,68,0.2)' : 'transparent'}`,
      borderRadius: 'var(--radius-sm)',
      opacity: isEliminated ? 0.5 : 1,
      transition: 'all 0.3s',
    }}>
      {/* Avatar */}
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: isMe
          ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
          : isEliminated
            ? 'var(--bg2)'
            : 'var(--surface2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 700,
        color: 'white',
        flexShrink: 0,
      }}>
        {isEliminated ? '💀' : (player.first_name || 'P').slice(0, 1).toUpperCase()}
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600,
          fontSize: '14px',
          color: isEliminated ? 'var(--text3)' : 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {isMe ? `${player.first_name} (אתה)` : player.first_name}
        </div>
      </div>

      {/* Status */}
      <div style={{ flexShrink: 0 }}>
        {isCurrent && (
          <span style={{
            background: 'var(--accent)',
            color: 'white',
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: '10px',
          }}>
            משחק
          </span>
        )}
        {isEliminated && (
          <span style={{ color: 'var(--danger2)', fontSize: '13px' }}>הודח</span>
        )}
        {isActive && !isCurrent && (
          <span style={{ color: 'var(--success2)', fontSize: '13px' }}>•</span>
        )}
      </div>
    </div>
  );
}
