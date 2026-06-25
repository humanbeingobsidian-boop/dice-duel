// frontend/src/screens/WheelScreen.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { haptic, hapticNotification, getInitData } from '../utils/telegram';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const TEXT = {
  he: {
    title: 'גלגל מזל יומי', back: 'חזור', spin: 'סובב!', spinning: 'מסתובב...', next: 'הסיבוב הבא בעוד', bonus: 'קיבלת סיבוב נוסף!', bonusBtn: 'סובב בונוס', won: 'זכית!', xp: 'XP', credits: 'קרדיטים', gift: 'מתנת Telegram', giftNote: 'הזכייה נשלחה לטיפול דרך היוזרבוט', loading: 'טוען גלגל...', unavailable: 'כבר סובבת היום',
  },
  en: {
    title: 'Daily Lucky Wheel', back: 'Back', spin: 'Spin!', spinning: 'Spinning...', next: 'Next spin in', bonus: 'You got a bonus spin!', bonusBtn: 'Bonus Spin', won: 'You won!', xp: 'XP', credits: 'credits', gift: 'Telegram Gift', giftNote: 'Your gift win was sent for delivery via userbot', loading: 'Loading wheel...', unavailable: 'You already spun today',
  },
  ru: {
    title: 'Ежедневное колесо', back: 'Назад', spin: 'Крутить!', spinning: 'Крутим...', next: 'Следующий спин через', bonus: 'Ты получил бонусный спин!', bonusBtn: 'Бонусный спин', won: 'Ты выиграл!', xp: 'XP', credits: 'кредитов', gift: 'Telegram Gift', giftNote: 'Подарок отправлен на обработку через userbot', loading: 'Загрузка колеса...', unavailable: 'Ты уже крутил сегодня',
  },
};

const SEGMENT_COLORS = [
  'rgba(124,58,237,0.95)', 'rgba(245,158,11,0.95)', 'rgba(16,185,129,0.95)',
  'rgba(59,130,246,0.95)', 'rgba(236,72,153,0.95)', 'rgba(239,68,68,0.95)',
  'rgba(20,184,166,0.95)', 'rgba(251,191,36,0.95)', 'rgba(168,85,247,0.95)', 'rgba(14,165,233,0.95)',
];

function formatTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function WheelScreen({ lang = 'en', onBack, onUserUpdate }) {
  const s = TEXT[lang] || TEXT.en;
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);
  const [countdown, setCountdown] = useState(0);

  const segments = state?.segments || [];
  const segmentAngle = segments.length ? 360 / segments.length : 36;

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND_URL}/api/wheel/state`, { headers: { 'x-telegram-init-data': getInitData() } })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.success) {
          setState(data.state);
          setCountdown(data.state.secondsUntilNext || 0);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!countdown) return;
    const id = setInterval(() => setCountdown(x => Math.max(0, x - 1)), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const wheelBackground = useMemo(() => {
    if (!segments.length) return 'var(--surface2)';
    const parts = segments.map((_, i) => {
      const start = i * segmentAngle;
      const end = (i + 1) * segmentAngle;
      return `${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} ${start}deg ${end}deg`;
    });
    return `conic-gradient(${parts.join(',')})`;
  }, [segments, segmentAngle]);

  async function spin() {
    if (spinning || !state?.canSpin) return;
    setSpinning(true);
    setResult(null);
    haptic('heavy');

    try {
      const res = await fetch(`${BACKEND_URL}/api/wheel/spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getInitData() },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'spin');
      const prize = data.result.prize;
      const prizeIndex = Math.max(0, segments.findIndex(x => x.id === prize.id));
      const targetCenter = prizeIndex * segmentAngle + segmentAngle / 2;
      const pointerAngle = 0;
      const extraTurns = 6 + Math.floor(Math.random() * 3);
      const giftNearMissOffset = 18;
      const nextRotation = rotation + extraTurns * 360 + (360 - targetCenter + pointerAngle) + giftNearMissOffset;

      setRotation(nextRotation);
      setTimeout(() => {
        setResult(data.result);
        setState(data.result.state);
        setCountdown(data.result.state?.secondsUntilNext || 0);
        onUserUpdate?.({ balance: data.result.balance, xp: data.result.xp, level: data.result.level });
        hapticNotification(prize.type === 'gift' ? 'success' : 'success');
        setSpinning(false);
      }, 6200);
    } catch {
      hapticNotification('error');
      setSpinning(false);
    }
  }

  function resultText() {
    if (!result) return '';
    const p = result.prize;
    if (p.type === 'xp') return `${p.emoji} +${p.amount} ${s.xp}`;
    if (p.type === 'credits') return `${p.emoji} +${p.amount} ${s.credits}`;
    if (p.type === 'bonus_spin') return `🎲 ${s.bonus}`;
    if (p.type === 'gift') return `${p.emoji} ${s.gift}: ${p.label}`;
    return p.label;
  }

  const canSpin = state?.canSpin && !spinning;
  const isBonus = state?.canBonusSpin;

  return (
    <div className="screen" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'radial-gradient(ellipse at 50% 15%, rgba(245,158,11,0.18), var(--bg) 65%)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={onBack}>{s.back}</button>
        <h2 style={{ fontSize: '20px', fontWeight: 900 }}>🎡 {s.title}</h2>
        <div style={{ width: 64 }} />
      </div>

      {loading ? <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text2)' }}>{s.loading}</div> : (
        <>
          <div style={{ position: 'relative', margin: '12px auto 4px', width: 290, height: 290 }}>
            <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', zIndex: 3, fontSize: 34, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}>🔻</div>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: wheelBackground, border: '8px solid rgba(255,255,255,0.10)', boxShadow: '0 0 38px rgba(245,158,11,0.28), inset 0 0 30px rgba(0,0,0,0.35)', transform: `rotate(${rotation}deg)`, transition: spinning ? 'transform 6.2s cubic-bezier(0.08, 0.78, 0.08, 1)' : 'none', position: 'relative', overflow: 'hidden' }}>
              {segments.map((seg, i) => {
                const angle = i * segmentAngle + segmentAngle / 2;
                const rare = seg.type === 'gift';
                return (
                  <div key={seg.id} style={{ position: 'absolute', left: '50%', top: '50%', transform: `rotate(${angle}deg) translate(0, -104px) rotate(${-angle}deg)`, transformOrigin: '0 0', textAlign: 'center', width: 64, marginLeft: -32, marginTop: -14, color: 'white', textShadow: '0 2px 6px rgba(0,0,0,0.65)', fontWeight: 900, fontSize: rare ? 20 : 12 }}>
                    <div>{seg.emoji}</div>
                    {!rare && <div>{seg.amount ? seg.amount : ''}{seg.type === 'xp' ? ' XP' : seg.type === 'credits' ? ' C' : ''}</div>}
                  </div>
                );
              })}
              <div style={{ position: 'absolute', inset: '38%', borderRadius: '50%', background: 'var(--surface)', border: '4px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, boxShadow: '0 6px 20px rgba(0,0,0,0.45)' }}>🎲</div>
            </div>
          </div>

          {result && (
            <div className="card" style={{ textAlign: 'center', padding: '18px', border: result.prize.type === 'gift' ? '1px solid rgba(251,191,36,0.55)' : '1px solid var(--border)', animation: 'pop 0.35s ease' }}>
              <div style={{ fontSize: 16, color: 'var(--text2)', marginBottom: 6 }}>{s.won}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: result.prize.type === 'gift' ? 'var(--gold2)' : 'var(--accent2)' }}>{resultText()}</div>
              {result.prize.type === 'gift' && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>{s.giftNote}</div>}
            </div>
          )}

          <button className="btn btn-primary btn-full" style={{ fontSize: 18, padding: 16, opacity: canSpin ? 1 : 0.65 }} disabled={!canSpin} onClick={spin}>
            {spinning ? s.spinning : isBonus ? s.bonusBtn : s.spin}
          </button>

          {!state?.canSpin && countdown > 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 14 }}>{s.next}: <span style={{ color: 'var(--gold2)', fontWeight: 900, fontFamily: 'Orbitron, sans-serif' }}>{formatTime(countdown)}</span></div>
          )}

          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {segments.map(seg => <div key={seg.id} style={{ textAlign: 'center', background: seg.type === 'gift' ? 'rgba(245,158,11,0.12)' : 'var(--bg3)', border: `1px solid ${seg.type === 'gift' ? 'rgba(245,158,11,0.32)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', padding: '8px 4px', fontSize: 11 }}><div style={{ fontSize: 18 }}>{seg.emoji}</div><div style={{ color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{seg.label}</div></div>)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
