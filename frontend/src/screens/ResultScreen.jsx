// frontend/src/screens/ResultScreen.jsx
import React, { useEffect, useState } from 'react';
import { hapticNotification } from '../utils/telegram';

const STRINGS = {
  he: {
    winTitle: 'ניצחת!',
    loseTitle: 'הפסדת',
    winSubtitle: 'אתה השורד האחרון! 🎉',
    winnerText: name => `${name || 'השחקן'} ניצח במשחק`,
    breakdown: 'פירוט הקופה',
    totalPot: '💰 קופה כוללת',
    houseFee: '🏠 עמלת בית (10%)',
    credits: 'קרדיטים',
    youWon: '🎁 זכית',
    winnerGot: '🏆 הזוכה קיבל',
    winnerLabel: 'הזוכה',
    playAgain: '🎲 שחק שוב',
    leaderboard: '🏅 לוח מצטיינים',
    plus: amount => `+${amount} קרדיטים נוספו ליתרה שלך`,
  },
  en: {
    winTitle: 'You won!',
    loseTitle: 'You lost',
    winSubtitle: 'You are the last survivor! 🎉',
    winnerText: name => `${name || 'The player'} won the game`,
    breakdown: 'Prize Breakdown',
    totalPot: '💰 Total Pot',
    houseFee: '🏠 House Fee (10%)',
    credits: 'credits',
    youWon: '🎁 You won',
    winnerGot: '🏆 Winner received',
    winnerLabel: 'Winner',
    playAgain: '🎲 Play Again',
    leaderboard: '🏅 Leaderboard',
    plus: amount => `+${amount} credits added to your balance`,
  },
  ru: {
    winTitle: 'Ты победил!',
    loseTitle: 'Ты проиграл',
    winSubtitle: 'Ты последний выживший! 🎉',
    winnerText: name => `${name || 'Игрок'} победил в игре`,
    breakdown: 'Разбивка банка',
    totalPot: '💰 Общий банк',
    houseFee: '🏠 Комиссия дома (10%)',
    credits: 'кредитов',
    youWon: '🎁 Ты выиграл',
    winnerGot: '🏆 Победитель получил',
    winnerLabel: 'Победитель',
    playAgain: '🎲 Играть снова',
    leaderboard: '🏅 Таблица лидеров',
    plus: amount => `+${amount} кредитов добавлено на баланс`,
  },
};

export default function ResultScreen({ lang = 'he', winner, pot, prize, houseCut, myUserId, onPlayAgain, onLeaderboard }) {
  const isWinner = winner?.userId === myUserId;
  const [visible, setVisible] = useState(false);
  const [animatedPrize, setAnimatedPrize] = useState(0);
  const [clicked, setClicked] = useState(false);
  const s = STRINGS[lang] || STRINGS.en;
  const targetPrize = Number(prize || 0);

  useEffect(() => {
    const appear = setTimeout(() => setVisible(true), 100);
    hapticNotification(isWinner ? 'success' : 'error');
    return () => clearTimeout(appear);
  }, [isWinner]);

  useEffect(() => {
    let frame;
    const duration = 1100;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedPrize(Math.floor(targetPrize * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [targetPrize]);

  function clickOnce(fn) {
    if (clicked) return;
    setClicked(true);
    fn();
    setTimeout(() => setClicked(false), 900);
  }

  return (
    <div className="screen" style={{
      background: isWinner
        ? 'radial-gradient(ellipse at 50% 20%, rgba(16,185,129,0.24) 0%, var(--bg) 62%)'
        : 'radial-gradient(ellipse at 50% 20%, rgba(239,68,68,0.18) 0%, var(--bg) 62%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px', gap: '22px', opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease',
    }}>
      <div style={{ fontSize: '100px', animation: isWinner ? 'bounce 1s ease-in-out infinite' : 'pulse 1.2s ease-in-out 2' }}>
        {isWinner ? '🏆' : '💀'}
      </div>

      <div style={{ textAlign: 'center' }}>
        <h1 className="font-display" style={{
          fontSize: '36px', fontWeight: 900, color: isWinner ? 'var(--gold2)' : 'var(--danger2)',
          letterSpacing: '2px', textShadow: isWinner ? '0 0 18px rgba(251,191,36,0.35)' : '0 0 18px rgba(239,68,68,0.28)',
        }}>
          {isWinner ? s.winTitle : s.loseTitle}
        </h1>
        <p style={{ color: 'var(--text2)', marginTop: '8px', fontSize: '16px' }}>
          {isWinner ? s.winSubtitle : s.winnerText(winner?.firstName)}
        </p>
      </div>

      {isWinner && targetPrize > 0 && (
        <div style={{
          width: '100%', maxWidth: '360px', textAlign: 'center', padding: '12px 16px',
          borderRadius: 'var(--radius)', border: '1px solid rgba(16,185,129,0.35)',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(5,150,105,0.08))',
          color: 'var(--success2)', fontWeight: 800, animation: 'pop 0.35s ease',
        }}>
          {s.plus(animatedPrize)}
        </div>
      )}

      <div className="card" style={{ width: '100%', maxWidth: '360px', padding: '24px', transform: visible ? 'translateY(0)' : 'translateY(12px)', transition: 'transform 0.5s ease' }}>
        <h3 style={{ fontSize: '14px', color: 'var(--text3)', marginBottom: '16px', textAlign: 'center' }}>{s.breakdown}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <StatRow label={s.totalPot} value={`${pot ?? 0} ${s.credits}`} />
          <StatRow label={s.houseFee} value={`${houseCut ?? 0} ${s.credits}`} color="var(--text3)" />
          <div style={{ height: '1px', background: 'var(--border)' }} />
          <StatRow label={isWinner ? s.youWon : s.winnerGot} value={`${animatedPrize} ${s.credits}`} color="var(--gold2)" bold />
        </div>
      </div>

      {!isWinner && winner && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', width: '100%', maxWidth: '360px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🏆</div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{s.winnerLabel}</div>
            <div style={{ fontWeight: 700, fontSize: '17px' }}>{winner.firstName}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '360px' }}>
        <button className="btn btn-primary btn-full" style={{ fontSize: '17px', padding: '16px', opacity: clicked ? 0.7 : 1 }} disabled={clicked} onClick={() => clickOnce(onPlayAgain)}>
          {s.playAgain}
        </button>
        <button className="btn btn-ghost btn-full" style={{ opacity: clicked ? 0.7 : 1 }} disabled={clicked} onClick={() => clickOnce(onLeaderboard)}>
          {s.leaderboard}
        </button>
      </div>
    </div>
  );
}

function StatRow({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: 'var(--text2)', fontSize: '14px' }}>{label}</span>
      <span style={{ color: color || 'var(--text)', fontWeight: bold ? 800 : 500, fontSize: bold ? '18px' : '14px', transition: 'all 0.2s ease' }}>{value}</span>
    </div>
  );
}
