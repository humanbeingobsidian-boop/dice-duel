// frontend/src/screens/PrizesScreen.jsx
import React, { useState, useEffect } from 'react';
import { haptic, hapticNotification, getInitData } from '../utils/telegram';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function PrizesScreen({ user, onBack, onBalanceUpdate }) {
  const [prizes, setPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [result, setResult] = useState(null); // { success, message }

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/prizes`)
      .then(r => r.json())
      .then(d => { setPrizes(d.prizes || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleBuy(prize) {
    if ((user?.balance ?? 0) < prize.cost) return;
    haptic('medium');
    setBuying(prize.id);
    setResult(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/prizes/buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': getInitData(),
        },
        body: JSON.stringify({ prize_id: prize.id }),
      });
      const data = await res.json();

      if (data.success) {
        hapticNotification('success');
        onBalanceUpdate(data.balance);
        setResult({
          success: true,
          message: `✅ הפרס הוזמן! תקבל אותו תוך 24 שעות.`,
        });
      } else {
        hapticNotification('error');
        setResult({ success: false, message: data.error || 'שגיאה ברכישה' });
      }
    } catch {
      hapticNotification('error');
      setResult({ success: false, message: 'שגיאת חיבור, נסה שוב' });
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className="screen" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '4px' }}>
        <button className="btn btn-ghost" style={{ padding: '10px 16px', fontSize: '14px' }} onClick={onBack}>
          ← חזור
        </button>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700 }}>🏆 חנות פרסים</h2>
          <div style={{ fontSize: '13px', color: 'var(--text3)' }}>
            יתרה: <span style={{ color: 'var(--gold2)', fontWeight: 700 }}>{user?.balance ?? 0}</span> מטבעות
          </div>
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <div style={{
          background: result.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${result.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          borderRadius: 'var(--radius)', padding: '14px 16px',
          color: result.success ? 'var(--success2)' : 'var(--danger2)',
          fontSize: '14px', fontWeight: 600,
          animation: 'pop 0.3s ease',
        }}>
          {result.message}
        </div>
      )}

      {/* Info */}
      <div style={{
        background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
        borderRadius: 'var(--radius)', padding: '12px 16px',
        fontSize: '13px', color: 'var(--text2)',
      }}>
        💡 הפרסים נשלחים ידנית דרך Telegram תוך עד 24 שעות מרגע הרכישה.
      </div>

      {/* Prizes */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text2)' }}>טוען...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {prizes.map(prize => {
            const canAfford = (user?.balance ?? 0) >= prize.cost;
            const isBuying = buying === prize.id;

            return (
              <div key={prize.id} style={{
                background: 'var(--surface)',
                border: `1px solid ${canAfford ? 'var(--border)' : 'rgba(255,255,255,0.05)'}`,
                borderRadius: 'var(--radius)', padding: '20px',
                opacity: canAfford ? 1 : 0.6,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  {/* Emoji */}
                  <div style={{ fontSize: '40px', lineHeight: 1, flexShrink: 0 }}>{prize.emoji}</div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>
                      {prize.label}
                    </div>
                    <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '12px' }}>
                      {prize.description}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {/* Cost */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'var(--bg3)', borderRadius: 'var(--radius-sm)',
                        padding: '6px 12px',
                      }}>
                        <span style={{ fontSize: '16px' }}>🪙</span>
                        <span style={{ fontWeight: 700, color: 'var(--gold2)', fontSize: '16px' }}>
                          {prize.cost.toLocaleString()}
                        </span>
                      </div>

                      {/* Buy button */}
                      <button
                        className={`btn ${canAfford ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '10px 20px', fontSize: '14px' }}
                        disabled={!canAfford || isBuying || buying !== null}
                        onClick={() => handleBuy(prize)}
                      >
                        {isBuying ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              width: '14px', height: '14px',
                              border: '2px solid rgba(255,255,255,0.3)',
                              borderTopColor: 'white', borderRadius: '50%',
                              display: 'inline-block',
                              animation: 'spin 0.8s linear infinite',
                            }} />
                            קונה...
                          </span>
                        ) : canAfford ? '🛍️ קנה' : '❌ אין מספיק'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* How it works */}
      <div className="card" style={{ padding: '16px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: 'var(--text2)' }}>
          📋 איך זה עובד?
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text3)' }}>
          {[
            '1️⃣ בחר פרס ולחץ "קנה"',
            '2️⃣ המטבעות יורדים מיידית מהחשבון',
            '3️⃣ האדמין מקבל הודעה ושולח את הפרס',
            '4️⃣ תקבל הודעה בטלגרם שהפרס נשלח',
          ].map(t => <div key={t}>{t}</div>)}
        </div>
      </div>
    </div>
  );
}
