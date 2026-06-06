// frontend/src/screens/PrizesScreen.jsx
import React, { useState, useEffect } from 'react';
import { haptic, hapticNotification, getInitData } from '../utils/telegram';
import { t } from '../utils/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function PrizesScreen({ lang = 'en', onLangChange, user, onBack, onBalanceUpdate }) {
  const [prizes, setPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/prizes`)
      .then(r => r.json())
      .then(d => { setPrizes(d.prizes || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleBuy(prize) {
    if ((user?.balance ?? 0) < prize.cost) return;
    haptic('medium'); setBuying(prize.id); setResult(null);
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
        const errMsgs = {
          'אין מספיק מטבעות': t('prizes_not_enough', lang),
        };
        setResult({ success: false, message: errMsgs[data.error] || t('prizes_error', lang) });
      }
    } catch {
      hapticNotification('error');
      setResult({ success: false, message: t('prizes_conn_error', lang) });
    } finally { setBuying(null); }
  }

  return (
    <div className="screen" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Header with back + lang */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '14px' }} onClick={onBack}>
            {t('prizes_back', lang)}
          </button>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{t('prizes_title', lang)}</h2>
            <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
              {t('prizes_balance', lang)}: <span style={{ color: 'var(--gold2)', fontWeight: 700 }}>{user?.balance ?? 0}</span>
            </div>
          </div>
        </div>
        <LanguageSwitcher lang={lang} onChange={onLangChange} />
      </div>

      {result && (
        <div style={{
          background: result.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${result.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          borderRadius: 'var(--radius)', padding: '12px 16px',
          color: result.success ? 'var(--success2)' : 'var(--danger2)',
          fontSize: '14px', fontWeight: 600, animation: 'pop 0.3s ease',
        }}>
          {result.message}
        </div>
      )}

      <div style={{
        background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
        borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '13px', color: 'var(--text2)',
      }}>
        {t('prizes_info', lang)}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text2)' }}>{t('prizes_loading', lang)}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {prizes.map(prize => {
            const canAfford = (user?.balance ?? 0) >= prize.cost;
            const isBuying = buying === prize.id;
            return (
              <div key={prize.id} style={{
                background: 'var(--surface)', border: `1px solid ${canAfford ? 'var(--border)' : 'rgba(255,255,255,0.05)'}`,
                borderRadius: 'var(--radius)', padding: '16px', opacity: canAfford ? 1 : 0.6,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ fontSize: '36px', lineHeight: 1, flexShrink: 0 }}>{prize.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '3px' }}>{prize.label}</div>
                    <div style={{ color: 'var(--text2)', fontSize: '12px', marginBottom: '10px' }}>{prize.description}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '5px 10px',
                      }}>
                        <span>🪙</span>
                        <span style={{ fontWeight: 700, color: 'var(--gold2)', fontSize: '15px' }}>
                          {prize.cost.toLocaleString()}
                        </span>
                      </div>
                      <button
                        className={`btn ${canAfford ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '8px 16px', fontSize: '13px' }}
                        disabled={!canAfford || isBuying || buying !== null}
                        onClick={() => handleBuy(prize)}
                      >
                        {isBuying ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{
                              width: '12px', height: '12px',
                              border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
                              borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite',
                            }} />
                            {t('prizes_buying', lang)}
                          </span>
                        ) : canAfford ? t('prizes_buy', lang) : t('prizes_cant_afford', lang)}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ padding: '14px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--text2)' }}>
          {t('prizes_how_title', lang)}
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text3)' }}>
          {[t('prizes_step1', lang), t('prizes_step2', lang), t('prizes_step3', lang), t('prizes_step4', lang)]
            .map(s => <div key={s}>{s}</div>)}
        </div>
      </div>
    </div>
  );
}
