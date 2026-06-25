// frontend/src/screens/WheelScreen.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { haptic, hapticNotification, getInitData } from '../utils/telegram';
import LanguageSwitcher from '../components/LanguageSwitcher';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const USERBOT_USERNAME = 'DiceDuelPrizes';
const USERBOT_DISPLAY_NAME = 'Dice Duel Prizes';

const TEXT = {
  he: {
    title: 'גלגל מזל יומי', back: 'חזור', spin: 'סובב!', spinning: 'מסתובב...', next: 'הסיבוב הבא בעוד', bonus: 'קיבלת סיבוב נוסף!', bonusBtn: 'סובב בונוס', won: 'זכית!', xp: 'XP', credits: 'קרדיטים', gift: 'מתנת Telegram', giftNote: 'הזכייה נשלחה לטיפול דרך היוזרבוט', loading: 'טוען גלגל...', streak: 'רצף סיבובים', best: 'שיא רצף', total: 'סה״כ סיבובים', days: 'ימים', userbotTitle: 'כדי לקבל מתנות מהגלגל', userbotPrefix: 'שלח "hi" לחשבון ', userbotSuffix: ' כדי שנוכל לשלוח לך מתנות אם תזכה.', userbotButton: 'פתח צ׳אט עם',
  },
  en: {
    title: 'Daily Lucky Wheel', back: 'Back', spin: 'Spin!', spinning: 'Spinning...', next: 'Next spin in', bonus: 'You got a bonus spin!', bonusBtn: 'Bonus Spin', won: 'You won!', xp: 'XP', credits: 'credits', gift: 'Telegram Gift', giftNote: 'Your gift win was sent for delivery via userbot', loading: 'Loading wheel...', streak: 'Spin Streak', best: 'Best Streak', total: 'Total Spins', days: 'days', userbotTitle: 'To receive wheel gifts', userbotPrefix: 'Send "hi" to ', userbotSuffix: ' so we can deliver gifts if you win.', userbotButton: 'Open chat with',
  },
  ru: {
    title: 'Ежедневное колесо', back: 'Назад', spin: 'Крутить!', spinning: 'Крутим...', next: 'Следующий спин через', bonus: 'Ты получил бонусный спин!', bonusBtn: 'Бонусный спин', won: 'Ты выиграл!', xp: 'XP', credits: 'кредитов', gift: 'Telegram Gift', giftNote: 'Подарок отправлен на обработку через userbot', loading: 'Загрузка колеса...', streak: 'Серия спинов', best: 'Лучшая серия', total: 'Всего спинов', days: 'дней', userbotTitle: 'Чтобы получить подарки с колеса', userbotPrefix: 'Отправь "hi" аккаунту ', userbotSuffix: ', чтобы мы могли отправить подарок, если ты выиграешь.', userbotButton: 'Открыть чат с',
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

function Confetti({ show }) {
  if (!show) return null;
  const items = ['✨', '⭐', '💫', '🎉', '🪙', '🎲', '🔥', '💎'];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 6 }}>
      {Array.from({ length: 26 }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: `${(i * 37) % 100}%`, top: '-20px', fontSize: 18 + (i % 5), animation: `wheelConfetti ${1.4 + (i % 5) * 0.18}s ease-out forwards`, animationDelay: `${(i % 7) * 0.045}s` }}>{items[i % items.length]}</div>
      ))}
    </div>
  );
}

function PrizeIcon({ seg, big = false }) {
  const size = big ? 34 : seg.type === 'gift' ? 22 : 19;
  return (
    <span style={{ fontSize: size, lineHeight: 1, display: 'inline-block', filter: seg.type === 'gift' ? 'drop-shadow(0 0 8px rgba(251,191,36,0.55))' : undefined }}>
      {seg.emoji}
    </span>
  );
}

export default function WheelScreen({ lang = 'en', onLangChange, onBack, onUserUpdate }) {
  const s = TEXT[lang] || TEXT.en;
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

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

  useEffect(() => {
    if (!showConfetti) return;
    const id = setTimeout(() => setShowConfetti(false), 2200);
    return () => clearTimeout(id);
  }, [showConfetti]);

  const wheelBackground = useMemo(() => {
    if (!segments.length) return 'var(--surface2)';
    const parts = segments.map((_, i) => {
      const start = i * segmentAngle;
      const end = (i + 1) * segmentAngle;
      return `${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} ${start}deg ${end}deg`;
    });
    return `conic-gradient(${parts.join(',')})`;
  }, [segments, segmentAngle]);

  function openUserbotChat() {
    haptic('medium');
    const url = `https://t.me/${USERBOT_USERNAME}`;
    if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(url);
    else if (window.Telegram?.WebApp?.openLink) window.Telegram.WebApp.openLink(url);
    else window.open(url, '_blank');
  }

  async function spin() {
    if (spinning || !state?.canSpin) return;
    setSpinning(true);
    setResult(null);
    setShowConfetti(false);
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
      const extraTurns = 7 + Math.floor(Math.random() * 3);
      const nearMissOffset = prize.type === 'gift' ? 4 : 16;
      const nextRotation = rotation + extraTurns * 360 + (360 - targetCenter) + nearMissOffset;

      setRotation(nextRotation);
      setTimeout(() => {
        setResult(data.result);
        setState(data.result.state);
        setCountdown(data.result.state?.secondsUntilNext || 0);
        onUserUpdate?.({ balance: data.result.balance, xp: data.result.xp, level: data.result.level });
        setShowConfetti(true);
        hapticNotification('success');
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
  const resultIsGift = result?.prize?.type === 'gift';

  return (
    <div className="screen" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'radial-gradient(ellipse at 50% 15%, rgba(245,158,11,0.18), var(--bg) 65%)', position: 'relative' }}>
      <style>{`
        @keyframes wheelConfetti { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(520px) rotate(720deg); opacity: 0; } }
        .daily-wheel-wrap { width: 310px; height: 310px; max-width: calc(100vw - 64px); max-height: calc(100vw - 64px); aspect-ratio: 1 / 1; }
        .daily-wheel-disc { width: 100%; height: 100%; aspect-ratio: 1 / 1; border-radius: 50%; box-sizing: border-box; }
        @supports not (aspect-ratio: 1 / 1) { .daily-wheel-wrap::before { content: ''; display: block; padding-top: 100%; } .daily-wheel-wrap { height: auto; } .daily-wheel-disc { position: absolute; inset: 0; } }
      `}</style>
      <Confetti show={showConfetti} />

      <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 70px', alignItems: 'center', gap: '8px' }}>
        <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={onBack}>{s.back}</button>
        <h2 style={{ fontSize: '20px', fontWeight: 900, textAlign: 'center' }}>🎡 {s.title}</h2>
        <LanguageSwitcher lang={lang} onChange={onLangChange} />
      </div>

      <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(168,85,247,0.08))', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 'var(--radius)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '22px', flexShrink: 0 }}>📬</span>
          <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '3px' }}>{s.userbotTitle}</strong>
            <span>{s.userbotPrefix}</span>
            <button type="button" onClick={openUserbotChat} style={{ display: 'inline', border: 0, padding: 0, margin: 0, background: 'transparent', color: 'var(--accent2)', font: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>{USERBOT_DISPLAY_NAME} (@{USERBOT_USERNAME})</button>
            <span>{s.userbotSuffix}</span>
          </div>
        </div>
        <button className="btn btn-primary btn-full" style={{ fontSize: '13px', padding: '10px' }} onClick={openUserbotChat}>💬 {s.userbotButton} {USERBOT_DISPLAY_NAME}</button>
      </div>

      {loading ? <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text2)' }}>{s.loading}</div> : (
        <>
          <div className="card" style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
            <Stat label={s.streak} value={`${state?.wheelSpinStreak || 0} ${s.days}`} />
            <Stat label={s.best} value={`${state?.bestWheelSpinStreak || 0}`} />
            <Stat label={s.total} value={`${state?.totalWheelSpins || 0}`} />
          </div>

          <div className="daily-wheel-wrap" style={{ position: 'relative', margin: '8px auto 4px', flex: '0 0 auto' }}>
            <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', zIndex: 3, fontSize: 34, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}>🔻</div>
            <div className="daily-wheel-disc" style={{ background: wheelBackground, border: resultIsGift ? '8px solid rgba(251,191,36,0.38)' : '8px solid rgba(255,255,255,0.10)', boxShadow: resultIsGift ? '0 0 55px rgba(251,191,36,0.45), inset 0 0 30px rgba(0,0,0,0.35)' : '0 0 38px rgba(245,158,11,0.28), inset 0 0 30px rgba(0,0,0,0.35)', transform: `rotate(${rotation}deg)`, transition: spinning ? 'transform 6.2s cubic-bezier(0.08, 0.78, 0.08, 1)' : 'box-shadow 0.3s ease, border 0.3s ease', position: 'relative', overflow: 'hidden' }}>
              {segments.map((seg, i) => {
                const angle = i * segmentAngle + segmentAngle / 2;
                const rare = seg.type === 'gift';
                return (
                  <div key={seg.id} style={{ position: 'absolute', left: '50%', top: '50%', transform: `rotate(${angle}deg) translate(0, -112px) rotate(${-angle}deg)`, transformOrigin: '0 0', textAlign: 'center', width: 66, marginLeft: -33, marginTop: -17, color: 'white', textShadow: '0 2px 6px rgba(0,0,0,0.72)', fontWeight: 900, fontSize: rare ? 23 : 12, lineHeight: 1.15 }}>
                    <PrizeIcon seg={seg} />
                    {!rare && <div>{seg.amount ? seg.amount : ''}{seg.type === 'xp' ? ' XP' : seg.type === 'credits' ? ' C' : ''}</div>}
                  </div>
                );
              })}
              <div style={{ position: 'absolute', inset: '38%', borderRadius: '50%', background: 'var(--surface)', border: '4px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, boxShadow: '0 6px 20px rgba(0,0,0,0.45)' }}>🎲</div>
            </div>
          </div>

          {result && (
            <div className="card" style={{ textAlign: 'center', padding: '18px', border: result.prize.type === 'gift' ? '1px solid rgba(251,191,36,0.7)' : '1px solid var(--border)', animation: 'pop 0.35s ease', boxShadow: result.prize.type === 'gift' ? '0 0 28px rgba(251,191,36,0.25)' : undefined }}>
              <div style={{ fontSize: result.prize.type === 'gift' ? 42 : 28, marginBottom: 4 }}>{result.prize.emoji}</div>
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
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '8px 6px' }}><div style={{ color: 'var(--gold2)', fontWeight: 900, fontSize: 14 }}>{value}</div><div style={{ color: 'var(--text3)', fontSize: 10, marginTop: 2 }}>{label}</div></div>;
}
