import React, { useState, useEffect } from 'react';
import Dice from '../components/Dice';
import { haptic, hapticNotification } from '../utils/telegram';

export default function GameScreenEnglish({ game, players, activePlayers, currentPlayer, myUserId, lastRoll, onRoll, rolling, rollError, turnSecondsLeft, disconnectedPlayer, onLeaveAfterElimination }) {
  const [showEliminated, setShowEliminated] = useState(null);
  const isMyTurn = currentPlayer?.user_id === myUserId;
  const myPlayerData = players?.find(p => p.user_id === myUserId);
  const isEliminated = myPlayerData?.status === 'eliminated';
  const danger = turnSecondsLeft <= 3;
  const warning = turnSecondsLeft <= 5;

  useEffect(() => {
    if (lastRoll?.isEliminated) {
      setShowEliminated(lastRoll.firstName);
      hapticNotification('error');
      const timer = setTimeout(() => setShowEliminated(null), 2500);
      return () => clearTimeout(timer);
    }
    if (lastRoll?.diceResult) haptic(isMyTurn ? 'heavy' : 'light');
  }, [lastRoll, isMyTurn]);

  return (
    <div className="screen" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text3)' }}>Room #{game?.room_code}</div>
          <div style={{ fontWeight: 700, fontSize: '17px' }}>Active Game</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,191,36,0.08))', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius)', padding: '8px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--gold)', marginBottom: '2px' }}>Pot</div>
          <div className="font-display" style={{ fontSize: '18px', color: 'var(--gold2)', fontWeight: 700 }}>{game?.pot ?? 0}</div>
        </div>
      </div>

      {disconnectedPlayer && (
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 'var(--radius)', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--gold2)', fontSize: '14px' }}>Warning: {disconnectedPlayer.firstName} disconnected</span>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '18px', fontWeight: 700, color: disconnectedPlayer.secondsLeft <= 5 ? 'var(--danger2)' : 'var(--gold2)' }}>{disconnectedPlayer.secondsLeft}s</span>
          </div>
          {disconnectedPlayer.userId === myUserId && <div style={{ marginTop: '10px', textAlign: 'center', color: 'var(--text2)', fontSize: '13px' }}>You are disconnected. Return quickly.</div>}
        </div>
      )}

      {showEliminated && <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 'var(--radius)', padding: '12px', textAlign: 'center' }}><span style={{ color: 'var(--danger2)', fontWeight: 700 }}>{showEliminated} was eliminated</span></div>}

      <div style={{ background: isMyTurn ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(168,85,247,0.1))' : 'var(--surface)', border: `2px solid ${isMyTurn ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '14px 16px', animation: isMyTurn ? 'glow 2s ease-in-out infinite' : 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>{isMyTurn ? <><div style={{ fontSize: '14px', color: 'var(--accent2)', fontWeight: 700 }}>Your turn!</div><div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>Tap the button to roll</div></> : currentPlayer ? <><div style={{ fontSize: '12px', color: 'var(--text3)' }}>Turn</div><div style={{ fontWeight: 700, fontSize: '16px' }}>{currentPlayer.first_name}</div></> : null}</div>
          {!isEliminated && currentPlayer && <Timer seconds={turnSecondsLeft} danger={danger} warning={warning} />}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '12px 0' }}>
        <div style={{ cursor: isMyTurn && !rolling && !isEliminated ? 'pointer' : 'default' }} onClick={() => { if (isMyTurn && !rolling && !isEliminated) onRoll(); }}><Dice value={lastRoll?.diceResult} rolling={rolling} /></div>
        {lastRoll && !rolling && <div style={{ textAlign: 'center' }}><span style={{ fontSize: '15px', color: 'var(--text2)' }}>{lastRoll.firstName} rolled <strong style={{ color: lastRoll.diceResult === 1 ? 'var(--danger2)' : 'var(--gold2)' }}>{lastRoll.diceResult}</strong>{lastRoll.isEliminated && <span style={{ color: 'var(--danger2)' }}> - eliminated</span>}</span></div>}
        {rollError && <div style={{ color: 'var(--danger2)', fontSize: '14px', textAlign: 'center' }}>{rollError}</div>}
        {isMyTurn && !rolling && !isEliminated && <button className="btn btn-primary" style={{ minWidth: '180px', fontSize: '17px', boxShadow: danger ? '0 0 20px rgba(239,68,68,0.5)' : undefined, border: danger ? '2px solid var(--danger2)' : undefined }} onClick={onRoll}>Roll Dice{danger && <span style={{ marginLeft: '8px', color: 'var(--danger2)', fontSize: '14px' }}>({turnSecondsLeft})</span>}</button>}
        {isEliminated && <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius)', padding: '16px 24px', textAlign: 'center', width: '100%', maxWidth: '320px' }}><div style={{ fontSize: '32px', marginBottom: '6px' }}>Lost</div><div style={{ color: 'var(--danger2)', fontWeight: 700 }}>You were eliminated</div><div style={{ color: 'var(--text2)', fontSize: '13px', marginTop: '4px', marginBottom: '12px' }}>You can leave now or wait for the game to end.</div><button className="btn btn-danger btn-full" style={{ fontSize: '15px', padding: '12px' }} onClick={() => { haptic('medium'); onLeaveAfterElimination?.(); }}>Leave Game</button></div>}
      </div>

      <div className="card" style={{ padding: '14px' }}><h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--text2)' }}>Players ({activePlayers?.length ?? 0} left)</h3><div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>{players?.map(player => <Row key={player.user_id} player={player} isMe={player.user_id === myUserId} isCurrent={currentPlayer?.user_id === player.user_id} isDisconnected={disconnectedPlayer?.userId === player.user_id} />)}</div></div>
    </div>
  );
}

function Timer({ seconds, danger, warning }) {
  return <div style={{ position: 'relative', width: '52px', height: '52px' }}><svg width="52" height="52" style={{ transform: 'rotate(-90deg)' }}><circle cx="26" cy="26" r="22" fill="none" stroke="var(--border)" strokeWidth="4" /><circle cx="26" cy="26" r="22" fill="none" stroke={danger ? 'var(--danger2)' : warning ? 'var(--gold2)' : 'var(--accent2)'} strokeWidth="4" strokeDasharray={`${2 * Math.PI * 22}`} strokeDashoffset={`${2 * Math.PI * 22 * (1 - seconds / 10)}`} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }} /></svg><div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron, sans-serif', fontSize: '14px', fontWeight: 700, color: danger ? 'var(--danger2)' : warning ? 'var(--gold2)' : 'var(--text)' }}>{seconds}</div></div>;
}

function Row({ player, isMe, isCurrent, isDisconnected }) {
  const isActive = player.status === 'active';
  const isElim = player.status === 'eliminated';
  return <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: isCurrent ? 'rgba(124,58,237,0.15)' : isElim ? 'rgba(239,68,68,0.05)' : 'var(--bg3)', border: `1px solid ${isCurrent ? 'var(--accent)' : isDisconnected ? 'rgba(245,158,11,0.4)' : isElim ? 'rgba(239,68,68,0.2)' : 'transparent'}`, borderRadius: 'var(--radius-sm)', opacity: isElim ? 0.5 : 1, transition: 'all 0.3s' }}><div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, background: player.avatarColor || (isMe ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : isElim ? 'var(--bg2)' : 'var(--surface2)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: player.avatar ? '16px' : '12px', fontWeight: 700, color: 'white' }}>{isElim ? 'X' : (player.avatar || (player.first_name || 'P').slice(0, 1).toUpperCase())}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: '13px', color: isElim ? 'var(--text3)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isMe ? `${player.first_name} (you)` : player.first_name}</div></div><div style={{ flexShrink: 0, fontSize: '12px' }}>{isCurrent && <span style={{ background: 'var(--accent)', color: 'white', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>Playing</span>}{isDisconnected && <span style={{ color: 'var(--gold2)' }}>disconnecting</span>}{isElim && <span style={{ color: 'var(--danger2)' }}>eliminated</span>}{isActive && !isCurrent && !isDisconnected && <span style={{ color: 'var(--success2)' }}>●</span>}</div></div>;
}
