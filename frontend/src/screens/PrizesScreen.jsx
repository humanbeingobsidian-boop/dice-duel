// frontend/src/screens/PrizesScreen.jsx
import React, { useState, useEffect } from 'react';
import { haptic, hapticNotification, getInitData } from '../utils/telegram';
import { t } from '../utils/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
// Keep this hardcoded so stale Vercel env values such as VITE_USERBOT_USERNAME=PoppyUSA cannot override it.
const USERBOT_USERNAME = 'DiceDuelPrizes';
const USERBOT_DISPLAY_NAME = 'Dice Duel Prizes';

const COLLECTIBLE_ITEMS = ['🪣', '🗽', '🍜', '🐶', '🍭', '🎒', '🍰', '🏅', '🪄', '👑', '📕', '🎂', '💝', '🧦', '🍀', '🌙', '🍒', '🧁'];

const LOCAL = {
  he: {
    confirm: 'אישור רכישה', cancel: '✕ ביטול', buy: '✓ קנה!', credits: 'קרדיטים', stars: 'כוכבים', value: 'שווי', convertible: 'את המתנות ניתן להמיר לכוכבי Telegram דרך Telegram.', collectibleHint: 'מתחלף רנדומלית מתוך מתנות אספנות זמינות', premiumTitle: 'חנות מתנות Telegram', premiumSub: 'קנה מתנות אמיתיות עם קרדיטים והפוך את הניצחונות לפרסים מוחשיים.', convertLine: '💡 את המתנות ניתן להמיר לכוכבים בתוך Telegram.',
  },
  en: {
    confirm: 'Confirm Purchase', cancel: '✕ Cancel', buy: '✓ Buy!', credits: 'credits', stars: 'stars', value: 'Value', convertible: 'Gifts can be converted into Telegram Stars through Telegram.', collectibleHint: 'Randomly selected from available collectible gifts', premiumTitle: 'Telegram Gift Shop', premiumSub: 'Buy real Telegram gifts with credits and turn wins into tangible rewards.', convertLine: '💡 Gifts can be converted into Stars inside Telegram.',
  },
  ru: {
    confirm: 'Подтвердить покупку', cancel: '✕ Отмена', buy: '✓ Купить!', credits: 'кредитов', stars: 'звёзд', value: 'Стоимость', convertible: 'Подарки можно конвертировать в Telegram Stars через Telegram.', collectibleHint: 'Случайный выбор из доступных коллекционных подарков', premiumTitle: 'Магазин Telegram Gifts', premiumSub: 'Покупай реальные Telegram подарки за кредиты и превращай победы в призы.', convertLine: '💡 Подарки можно конвертировать в Stars внутри Telegram.',
  },
};

function L(lang) { return LOCAL[lang] || LOCAL.en; }

function PrizeVisual({ prize, large = false }) {
  const size = large ? 74 : 56;
  if (prize.visual === 'teddy') {
    return <div className="prize-visual teddy" style={{ width: size, height: size, fontSize: large ? 58 : 42 }}>🧸</div>;
  }
  if (prize.visual === 'diamond') {
    return <div className="prize-visual diamond" style={{ width: size, height: size, fontSize: large ? 58 : 44 }}>💎</div>;
  }
  if (prize.visual === 'collectible') {
    return (
      <div className="prize-visual collectible" style={{ width: size, height: size, fontSize: large ? 46 : 34 }}>
        {COLLECTIBLE_ITEMS.map((item, i) => <span key={i} style={{ animationDelay: `${i * 1.05}s` }}>{item}</span>)}
      </div>
    );
  }
  return <div className="prize-visual" style={{ width: size, height: size, fontSize: large ? 58 : 42 }}>{prize.emoji}</div>;
}

export default function PrizesScreen({ lang = 'en', onLangChange, user, onBack, onBalanceUpdate }) {
  const [prizes, setPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [result, setResult] = useState(null);
  const [confirmPrize, setConfirmPrize] = useState(null);
  const l = L(lang);

  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/prizes?lang=${lang}`)
      .then(r => r.json())
      .then(d => { setPrizes(d.prizes || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [lang]);

  function handleBuy(prize) {
    if ((user?.balance ?? 0) < prize.cost) return;
    haptic('light');
    setConfirmPrize(prize);
  }

  async function handleConfirmBuy() {
    const prize = confirmPrize;
    setConfirmPrize(null);
    if (!prize) return;

    haptic('medium');
    setBuying(prize.id);
    setResult(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/prizes/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getInitData() },
        body: JSON.stringify({ prize_id: prize.id }),
      });
      const data = await res.json();
      if (data.success) {
        hapticNotification('success');
        onBalanceUpdate(data.balance);
        setResult({ success: true, message: t('prizes_order_ok', lang) });
      } else {
        hapticNotification('error');
        setResult({ success: false, message: t('prizes_error', lang) });
      }
    } catch {
      hapticNotification('error');
      setResult({ success: false, message: t('prizes_conn_error', lang) });
    } finally { setBuying(null); }
  }

  function openUserbotChat() {
    haptic('medium');
    const url = `https://t.me/${USERBOT_USERNAME}`;
    if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(url);
    else if (window.Telegram?.WebApp?.openLink) window.Telegram.WebApp.openLink(url);
    else window.open(url, '_blank');
  }

  return (
    <div className="screen" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.16), rgba(124,58,237,0.10) 38%, var(--bg) 72%)' }}>
      <style>{`
        .prize-visual { position: relative; display: flex; align-items: center; justify-content: center; border-radius: 22px; background: radial-gradient(circle at 50% 30%, rgba(255,255,255,0.18), rgba(124,58,237,0.12)); filter: drop-shadow(0 10px 16px rgba(0,0,0,0.35)); animation: prizeFloat 2.8s ease-in-out infinite; }
        .prize-visual.teddy { background: radial-gradient(circle at 50% 35%, rgba(251,191,36,0.20), rgba(124,58,237,0.10)); }
        .prize-visual.diamond { background: radial-gradient(circle at 50% 35%, rgba(14,165,233,0.28), rgba(124,58,237,0.12)); text-shadow: 0 0 22px rgba(14,165,233,0.95); }
        .prize-visual.collectible { overflow: hidden; background: radial-gradient(circle at 50% 35%, rgba(251,191,36,0.26), rgba(168,85,247,0.18)); }
        .prize-visual.collectible span { position: absolute; opacity: 0; transform: scale(.72) rotate(-8deg); animation: collectibleSwap 18.9s linear infinite; }
        .prize-card { position: relative; overflow: hidden; }
        .prize-card::before { content: ''; position: absolute; inset: -60% -20%; background: linear-gradient(110deg, transparent 35%, rgba(255,255,255,.10) 50%, transparent 65%); transform: translateX(-120%); animation: prizeShine 4.8s ease-in-out infinite; pointer-events: none; }
        .rarity-ribbon { position: absolute; top: 13px; right: -34px; transform: rotate(38deg); background: linear-gradient(135deg, #22c55e, #16a34a); color: white; font-size: 10px; font-weight: 900; padding: 3px 38px; box-shadow: 0 4px 12px rgba(0,0,0,.28); }
        @keyframes prizeFloat { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-5px) scale(1.035); } }
        @keyframes collectibleSwap { 0%, 4.8% { opacity: 0; transform: scale(.72) rotate(-8deg); } 5.2%, 9.6% { opacity: 1; transform: scale(1) rotate(0deg); } 10%, 100% { opacity: 0; transform: scale(1.18) rotate(8deg); } }
        @keyframes prizeShine { 0%, 42% { transform: translateX(-120%); } 60%, 100% { transform: translateX(120%); } }
      `}</style>

      {confirmPrize && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '24px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '28px 24px', maxWidth: '340px', width: '100%', textAlign: 'center', animation: 'pop 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><PrizeVisual prize={confirmPrize} large /></div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>{l.confirm}</h3>
            <p style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '6px' }}>{confirmPrize.label}</p>
            <p style={{ color: 'var(--gold2)', fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>⭐ {l.value}: {confirmPrize.starsValue?.toLocaleString()} {l.stars}</p>
            <p style={{ color: 'var(--gold2)', fontWeight: 700, fontSize: '20px', marginBottom: '18px' }}>🪙 {confirmPrize.cost.toLocaleString()} {l.credits}</p>
            <p style={{ color: 'var(--text3)', fontSize: 12, lineHeight: 1.4, marginBottom: 22 }}>{l.convertible}</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" style={{ flex: 1, fontSize: '15px' }} onClick={() => { haptic('light'); setConfirmPrize(null); }}>{l.cancel}</button>
              <button className="btn btn-primary" style={{ flex: 1, fontSize: '15px' }} onClick={handleConfirmBuy}>{l.buy}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '14px' }} onClick={onBack}>{t('prizes_back', lang)}</button>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800 }}>🏆 {l.premiumTitle}</h2>
            <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{t('prizes_balance', lang)}: <span style={{ color: 'var(--gold2)', fontWeight: 700 }}>{user?.balance ?? 0}</span></div>
          </div>
        </div>
        <LanguageSwitcher lang={lang} onChange={onLangChange} />
      </div>

      <div className="card" style={{ padding: '16px', border: '1px solid rgba(251,191,36,0.30)', background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(124,58,237,0.12))' }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 5 }}>✨ {l.premiumSub}</div>
        <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.45 }}>{l.convertLine}</div>
      </div>

      {result && (
        <div style={{ background: result.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${result.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 'var(--radius)', padding: '12px 16px', color: result.success ? 'var(--success2)' : 'var(--danger2)', fontSize: '14px', fontWeight: 600, animation: 'pop 0.3s ease' }}>{result.message}</div>
      )}

      <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(168,85,247,0.08))', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 'var(--radius)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '22px', flexShrink: 0 }}>📬</span>
          <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '3px' }}>{lang === 'he' ? 'כדי לקבל פרסים' : lang === 'ru' ? 'Чтобы получать призы' : 'To receive prizes'}</strong>
            <span>{lang === 'he' ? 'שלח "hi" לחשבון ' : lang === 'ru' ? 'Отправь "hi" аккаунту ' : 'Send "hi" to '}</span>
            <button type="button" onClick={openUserbotChat} style={{ display: 'inline', border: 0, padding: 0, margin: 0, background: 'transparent', color: 'var(--accent2)', font: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>{USERBOT_DISPLAY_NAME} (@{USERBOT_USERNAME})</button>
            <span>{lang === 'he' ? ' כדי שנוכל לשלוח לך פרסים.' : lang === 'ru' ? ', чтобы мы могли отправлять тебе призы.' : ' so we can deliver your prizes.'}</span>
          </div>
        </div>
        <button className="btn btn-primary btn-full" style={{ fontSize: '13px', padding: '10px' }} onClick={openUserbotChat}>💬 {lang === 'he' ? `פתח צ'אט עם ${USERBOT_DISPLAY_NAME}` : lang === 'ru' ? `Открыть чат с ${USERBOT_DISPLAY_NAME}` : `Open chat with ${USERBOT_DISPLAY_NAME}`}</button>
      </div>

      <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '13px', color: 'var(--text2)' }}>{t('prizes_info', lang)}</div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text2)' }}>{t('prizes_loading', lang)}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {prizes.map(prize => {
            const canAfford = (user?.balance ?? 0) >= prize.cost;
            const isBuying = buying === prize.id;
            const isCollectible = prize.visual === 'collectible';
            return (
              <div key={prize.id} className="prize-card" style={{ background: isCollectible ? 'linear-gradient(135deg, rgba(251,191,36,0.13), rgba(168,85,247,0.13), var(--surface))' : 'var(--surface)', border: `1px solid ${canAfford ? (isCollectible ? 'rgba(251,191,36,0.42)' : 'var(--border)') : 'rgba(255,255,255,0.05)'}`, borderRadius: 'var(--radius)', padding: '16px', opacity: canAfford ? 1 : 0.62, boxShadow: isCollectible ? '0 0 28px rgba(251,191,36,0.09)' : undefined }}>
                {isCollectible && <div className="rarity-ribbon">COLLECTIBLE</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <PrizeVisual prize={prize} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: '16px', marginBottom: '4px' }}>{prize.label}</div>
                    <div style={{ color: 'var(--text2)', fontSize: '12px', marginBottom: '8px', lineHeight: 1.35 }}>{prize.description}</div>
                    {isCollectible && <div style={{ color: 'var(--gold2)', fontSize: '11px', fontWeight: 800, marginBottom: 8 }}>🎲 {l.collectibleHint}</div>}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '999px', padding: '5px 10px', color: 'var(--gold2)', fontWeight: 900, fontSize: 12 }}>⭐ {prize.starsValue?.toLocaleString()} {l.stars}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--bg3)', borderRadius: '999px', padding: '5px 10px' }}><span>🪙</span><span style={{ fontWeight: 900, color: 'var(--gold2)', fontSize: '15px' }}>{prize.cost.toLocaleString()}</span></div>
                    </div>
                    <button className={`btn ${canAfford ? 'btn-primary' : 'btn-ghost'}`} style={{ marginTop: 12, padding: '9px 18px', fontSize: '13px', minWidth: 98 }} disabled={!canAfford || isBuying || buying !== null} onClick={() => handleBuy(prize)}>
                      {isBuying ? <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />{t('prizes_buying', lang)}</span> : canAfford ? t('prizes_buy', lang) : t('prizes_cant_afford', lang)}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ padding: '14px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text2)', marginBottom: '8px' }}>{t('prizes_how_title', lang)}</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text3)' }}>
          {[t('prizes_step1', lang), t('prizes_step2', lang), t('prizes_step3', lang), l.convertLine].map((step, i) => <div key={i}>{i + 1}️⃣ {step}</div>)}
        </div>
      </div>
    </div>
  );
}
