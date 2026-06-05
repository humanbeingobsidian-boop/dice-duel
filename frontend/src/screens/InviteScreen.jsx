// frontend/src/screens/InviteScreen.jsx
import React, { useState, useEffect } from 'react';
import { getInitData, haptic, hapticNotification } from '../utils/telegram';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function InviteScreen({ user, lang = 'he', onBack, onBalanceUpdate }) {
  const [myCode, setMyCode] = useState(null);
  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [result, setResult] = useState(null); // { success, message }
  const [copied, setCopied] = useState(false);

  const STRINGS = {
    he: {
      title: '👥 הזמן חברים',
      back: '← חזור',
      myCodeTitle: 'הקוד האישי שלך',
      myCodeDesc: 'שתף את הקוד הזה עם חברים. כשהם מזינים אותו — שניכם מקבלים +5 קרדיטים!',
      copy: 'העתק קוד',
      copied: '✓ הועתק!',
      shareText: (code) => `מצטרף ל-Dice Duel? השתמש בקוד ההזמנה שלי: ${code} וקבל +5 קרדיטים בונוס! 🎲`,
      share: '📤 שתף',
      redeemTitle: 'יש לך קוד הזמנה?',
      redeemDesc: 'הזן קוד של חבר וקבל +5 קרדיטים',
      placeholder: 'הזן קוד (למשל: SMOKEY42)',
      redeemBtn: '✅ מימוש קוד',
      redeeming: 'מממש...',
      howTitle: '📋 איך עובד?',
      how1: '1️⃣ שתף את הקוד האישי שלך עם חברים',
      how2: '2️⃣ החבר פותח את המשחק ומזין את הקוד',
      how3: '3️⃣ שניכם מקבלים +5 קרדיטים מיד!',
      how4: '✨ אפשר לממש קוד פעם אחת בלבד',
      balance: 'יתרה',
      credits: 'קרדיטים',
    },
    en: {
      title: '👥 Invite Friends',
      back: '← Back',
      myCodeTitle: 'Your Personal Code',
      myCodeDesc: 'Share this code with friends. When they enter it — you both get +5 credits!',
      copy: 'Copy Code',
      copied: '✓ Copied!',
      shareText: (code) => `Join Dice Duel! Use my invite code: ${code} and get +5 bonus credits! 🎲`,
      share: '📤 Share',
      redeemTitle: 'Have an invite code?',
      redeemDesc: 'Enter a friend\'s code and get +5 credits',
      placeholder: 'Enter code (e.g. SMOKEY42)',
      redeemBtn: '✅ Redeem Code',
      redeeming: 'Redeeming...',
      howTitle: '📋 How it works?',
      how1: '1️⃣ Share your personal code with friends',
      how2: '2️⃣ Friend opens the game and enters the code',
      how3: '3️⃣ You both get +5 credits instantly!',
      how4: '✨ Code can be redeemed once only',
      balance: 'Balance',
      credits: 'credits',
    },
    ru: {
      title: '👥 Пригласить друзей',
      back: '← Назад',
      myCodeTitle: 'Твой личный код',
      myCodeDesc: 'Поделись этим кодом с друзьями. Когда они введут его — вы оба получите +5 кредитов!',
      copy: 'Копировать код',
      copied: '✓ Скопировано!',
      shareText: (code) => `Присоединяйся к Dice Duel! Используй мой код приглашения: ${code} и получи +5 бонусных кредитов! 🎲`,
      share: '📤 Поделиться',
      redeemTitle: 'Есть код приглашения?',
      redeemDesc: 'Введи код друга и получи +5 кредитов',
      placeholder: 'Введи код (напр. SMOKEY42)',
      redeemBtn: '✅ Активировать код',
      redeeming: 'Активирую...',
      howTitle: '📋 Как это работает?',
      how1: '1️⃣ Поделись своим кодом с друзьями',
      how2: '2️⃣ Друг открывает игру и вводит код',
      how3: '3️⃣ Вы оба получаете +5 кредитов сразу!',
      how4: '✨ Код можно активировать только один раз',
      balance: 'Баланс',
      credits: 'кредитов',
    },
  };

  const s = STRINGS[lang] || STRINGS.en;

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/invite-code`, {
      headers: { 'x-telegram-init-data': getInitData() },
    })
      .then(r => r.json())
      .then(d => { setMyCode(d.code); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleRedeem() {
    const code = inputCode.trim().toUpperCase();
    if (!code) return;
    haptic('medium');
    setRedeeming(true);
    setResult(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/invite-code/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': getInitData(),
        },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (data.success) {
        hapticNotification('success');
        onBalanceUpdate(data.balance);
        setResult({
          success: true,
          message: lang === 'he'
            ? `🎉 קוד מומש! אתה ו-${data.inviterName} מקבלים +${data.bonus} קרדיטים כל אחד`
            : lang === 'ru'
              ? `🎉 Код активирован! Ты и ${data.inviterName} получили +${data.bonus} кредитов`
              : `🎉 Code redeemed! You and ${data.inviterName} each got +${data.bonus} credits`,
        });
        setInputCode('');
      } else {
        hapticNotification('error');
        const msgs = {
          ALREADY_USED: lang === 'he' ? 'כבר השתמשת בקוד הזמנה' : lang === 'ru' ? 'Вы уже использовали код' : 'You already used an invite code',
          OWN_CODE: lang === 'he' ? 'לא ניתן להשתמש בקוד שלך' : lang === 'ru' ? 'Нельзя использовать свой код' : 'Cannot use your own code',
          INVALID_CODE: lang === 'he' ? 'קוד לא קיים, בדוק שוב' : lang === 'ru' ? 'Код не существует' : 'Code not found, check again',
        };
        setResult({ success: false, message: msgs[data.error] || data.message || 'שגיאה' });
      }
    } catch {
      hapticNotification('error');
      setResult({ success: false, message: lang === 'he' ? 'שגיאת חיבור' : 'Connection error' });
    } finally {
      setRedeeming(false);
    }
  }

  function handleCopy() {
    if (!myCode) return;
    navigator.clipboard?.writeText(myCode).catch(() => {});
    haptic('light');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare() {
    if (!myCode) return;
    haptic('light');
    const text = s.shareText(myCode);
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="screen" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px' }}>
        <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '14px' }} onClick={onBack}>
          {s.back}
        </button>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{s.title}</h2>
          <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
            {s.balance}: <span style={{ color: 'var(--gold2)', fontWeight: 700 }}>{user?.balance ?? 0}</span> {s.credits}
          </div>
        </div>
      </div>

      {/* My code */}
      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent2)', marginBottom: '8px' }}>
          {s.myCodeTitle}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px' }}>
          {s.myCodeDesc}
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text3)' }}>...</div>
        ) : (
          <>
            {/* Code display */}
            <div style={{
              background: 'var(--bg3)', border: '2px solid var(--accent)',
              borderRadius: 'var(--radius)', padding: '16px',
              textAlign: 'center', marginBottom: '14px',
            }}>
              <div className="font-display" style={{
                fontSize: '32px', fontWeight: 900, letterSpacing: '4px',
                color: 'var(--accent2)',
              }}>
                {myCode}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1, fontSize: '14px' }}
                onClick={handleCopy}
              >
                {copied ? s.copied : s.copy}
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, fontSize: '14px' }}
                onClick={handleShare}
              >
                {s.share}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Redeem code */}
      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>
          {s.redeemTitle}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '14px' }}>
          {s.redeemDesc}
        </p>

        {result && (
          <div style={{
            background: result.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${result.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: 'var(--radius-sm)', padding: '10px 14px',
            color: result.success ? 'var(--success2)' : 'var(--danger2)',
            fontSize: '13px', fontWeight: 600, marginBottom: '12px',
            animation: 'pop 0.3s ease',
          }}>
            {result.message}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="text"
            value={inputCode}
            onChange={e => setInputCode(e.target.value.toUpperCase())}
            placeholder={s.placeholder}
            maxLength={12}
            onKeyDown={e => e.key === 'Enter' && handleRedeem()}
            style={{
              width: '100%', padding: '12px 14px',
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)',
              fontSize: '15px', fontFamily: 'Orbitron, sans-serif',
              letterSpacing: '2px', outline: 'none', textAlign: 'center',
            }}
          />
          <button
            className="btn btn-primary btn-full"
            style={{ fontSize: '15px', padding: '14px' }}
            onClick={handleRedeem}
            disabled={redeeming || !inputCode.trim() || result?.success}
          >
            {redeeming ? s.redeeming : s.redeemBtn}
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="card" style={{ padding: '16px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text2)', marginBottom: '10px' }}>
          {s.howTitle}
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '13px', color: 'var(--text3)' }}>
          {[s.how1, s.how2, s.how3, s.how4].map(line => (
            <div key={line}>{line}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
