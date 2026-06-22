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
  },
};

export default function ResultScreen({ lang = 'he', winner, pot, prize, houseCut, myUserId, onPlayAgain, onLeaderboard }) {
  const isWinner = winner?.userId === myUserId;
  const [visible, setVisible] = useState(false);
  const s = STRINGS[lang] || STRINGS.en;

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
    if (isWinner) {
      hapticNotification('success');
    } else {
      hapticNotification('error');
    }
  }, [isWinner]);

  return (
    <div className="screen" style={{
      background: isWinner
        ? 'radial-gradient(ellipse at 50% 20%, rgba(16,185,129,0.2) 0%, var(--bg) 60%)'
        : 'radial-gradient(ellipse at 50% 20%, rgba(239,68,68,0.15) 0%, var(--bg) 60%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      gap: '24px',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.5s ease',
    }}>
      <div style={{
        fontSize: '100px',
        animation: isWinner ? 'bounce 1s ease-in-out infinite' : 'none',
      }}>
        {isWinner ? '🏆' : '💀'}
      </div>

      <div style={{ textAlign: 'center' }}>
        <h1 className="font-display" style={{
          fontSize: '36px',
          fontWeight: 900,
          color: isWinner ? 'var(--gold2)' : 'var(--danger2)',
          letterSpacing: '2px',
        }}>
          {isWinner ? s.winTitle : s.loseTitle}
        </h1>
        {isWinner ? (
          <p style={{ color: 'var(--text2)', marginTop: '8px', fontSize: '16px' }}>
            {s.winSubtitle}
          </p>
        ) : (
          <p style={{ color: 'var(--text2)', marginTop: '8px', fontSize: '16px' }}>
            {s.winnerText(winner?.firstName)}
          </p>
        )}
      </div>

      <div className="card" style={{ width: '100%', maxWidth: '360px', padding: '24px' }}>
        <h3 style={{ fontSize: '14px', color: 'var(--text3)', marginBottom: '16px', textAlign: 'center' }}>
          {s.breakdown}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <StatRow label={s.totalPot} value={`${pot ?? 0} ${s.credits}`} />
          <StatRow label={s.houseFee} value={`${houseCut ?? 0} ${s.credits}`} color="var(--text3)" />
          <div style={{ height: '1px', background: 'var(--border)' }} />
          <StatRow
            label={isWinner ? s.youWon : s.winnerGot}
            value={`${prize ?? 0} ${s.credits}`}
            color="var(--gold2)"
            bold
          />
        </div>
      </div>

      {!isWinner && winner && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          width: '100%',
          maxWidth: '360px',
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--gold), var(--gold2))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
          }}>
            🏆
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{s.winnerLabel}</div>
            <div style={{ fontWeight: 700, fontSize: '17px' }}>{winner.firstName}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '360px' }}>
        <button
          className="btn btn-primary btn-full"
          style={{ fontSize: '17px', padding: '16px' }}
          onClick={onPlayAgain}
        >
          {s.playAgain}
        </button>
        <button
          className="btn btn-ghost btn-full"
          onClick={onLeaderboard}
        >
          {s.leaderboard}
        </button>
      </div>
    </div>
  );
}

function StatRow({ label, value, color, bold }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <span style={{ color: 'var(--text2)', fontSize: '14px' }}>{label}</span>
      <span style={{
        color: color || 'var(--text)',
        fontWeight: bold ? 700 : 500,
        fontSize: bold ? '17px' : '14px',
      }}>
        {value}
      </span>
    </div>
  );
}
