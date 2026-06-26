// frontend/src/screens/LobbyScreen.jsx
import React, { useState } from 'react';
import { haptic } from '../utils/telegram';
import { t } from '../utils/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ProfileScreen from './ProfileScreen';

export default function LobbyScreen({
  lang = 'en', onLangChange, user, onJoin, onLeaderboard, onPrizes, onInvite, onWheel, onBack,
  loading, error, selectedFee = 5, onFeeChange,
}) {
  const [joinLocked, setJoinLocked] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const displayUser = profileUser || user;
  const tables = [
    { fee: 5,   label: t('lobby_table_low', lang),  feeLabel: t('lobby_table_low_fee', lang),  color: 'var(--success2)' },
    { fee: 100, label: t('lobby_table_high', lang), feeLabel: t('lobby_table_high_fee', lang), color: 'var(--gold2)' },
  ];

  function handleJoinClick() {
    if (joinLocked || loading || !user || user.balance < selectedFee) return;
    setJoinLocked(true);
    haptic('medium');
    onJoin();
    setTimeout(() => setJoinLocked(false), 1200);
  }

  if (showProfile) {
    return <ProfileScreen lang={lang} onBack={() => setShowProfile(false)} onProfileSaved={(updatedUser) => setProfileUser(u => ({ ...(u || user || {}), ...updatedUser }))} />;
  }

  return (
    <div className="screen lobby-screen" style={{
      background: 'radial-gradient(ellipse at 50% 20%, #1a0a3a 0%, var(--bg) 60%)',
      padding: '24px',
      paddingTop: 'max(24px, env(safe-area-inset-top))',
      paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
      gap: '16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      minHeight: '100dvh',
      height: 'auto',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => { haptic('light'); onBack(); }}>{t('lobby_back', lang)}</button>
        <LanguageSwitcher lang={lang} onChange={onLangChange} />
      </div>

      <button type="button" onClick={() => { if (user) { haptic('light'); setShowProfile(true); } }} style={{ width: '100%', maxWidth: '360px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'inherit', font: 'inherit', color: 'inherit', cursor: user ? 'pointer' : 'default', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: displayUser?.selected_frame === 'gold' ? 'linear-gradient(135deg, var(--gold), var(--gold2))' : displayUser?.selected_frame === 'neon' ? 'linear-gradient(135deg, #06b6d4, #a855f7)' : displayUser?.selected_frame === 'purple' ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 5px 14px rgba(0,0,0,0.25)' }}>
            {displayUser?.selected_avatar || '🐢'}
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '2px' }}>{t('lobby_player', lang)}</div>
            <div style={{ fontWeight: 700, fontSize: '16px' }}>{displayUser?.nickname || displayUser?.first_name || '—'}</div>
            {displayUser?.level && <div style={{ fontSize: '11px', color: 'var(--gold2)', marginTop: '2px' }}>{lang === 'he' ? 'רמה' : lang === 'ru' ? 'Уровень' : 'Level'} {displayUser.level}</div>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '2px' }}>{t('lobby_balance', lang)}</div>
          <div style={{ fontWeight: 700, fontSize: '22px', color: 'var(--gold2)', fontFamily: 'Orbitron, sans-serif' }}>
            {user?.balance !== undefined ? user.balance : <span style={{ fontSize: '13px', color: 'var(--text3)', animation: 'pulse 1s infinite', fontFamily: 'Space Grotesk' }}>{t('lobby_loading', lang)}</span>}
            {user?.balance !== undefined && <span style={{ fontSize: '12px', color: 'var(--text3)', fontFamily: 'Space Grotesk', marginRight: '4px' }}> {t('lobby_credits', lang)}</span>}
          </div>
        </div>
      </button>

      <button className="btn btn-primary btn-full" style={{ maxWidth: '360px', width: '100%', padding: '13px 16px', fontSize: '16px', background: 'linear-gradient(135deg, #f59e0b, #a855f7)', boxShadow: '0 0 24px rgba(245,158,11,0.22)', flexShrink: 0 }} onClick={() => { haptic('medium'); onWheel?.(); }}>
        🎡 {lang === 'he' ? 'גלגל מזל יומי' : lang === 'ru' ? 'Ежедневное колесо' : 'Daily Lucky Wheel'}
      </button>

      <div style={{ width: '100%', maxWidth: '360px', flexShrink: 0 }}>
        <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '10px', fontWeight: 600 }}>{t('lobby_choose_table', lang)}</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {tables.map(table => {
            const selected = selectedFee === table.fee;
            const canAfford = (user?.balance ?? 0) >= table.fee;
            return (
              <button key={table.fee} onClick={() => { haptic('light'); onFeeChange(table.fee); }} disabled={joinLocked || loading} style={{ flex: 1, padding: '14px 10px', background: selected ? 'rgba(124,58,237,0.2)' : 'var(--surface)', border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'center', opacity: canAfford ? 1 : 0.5, fontFamily: 'inherit', transition: 'all 0.2s' }}>
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{table.fee === 5 ? '🎲' : '💎'}</div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: selected ? 'var(--accent2)' : 'var(--text)', marginBottom: '2px' }}>{table.label}</div>
                <div style={{ fontSize: '12px', color: table.color, fontWeight: 600 }}>{table.feeLabel}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: '360px', padding: '20px', flexShrink: 0 }}>
        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--danger2)', fontSize: '14px', marginBottom: '14px' }}>❌ {error}</div>}
        {!user ? (
          <div style={{ padding: '12px', color: 'var(--text3)', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><span style={{ width: '16px', height: '16px', border: '2px solid var(--border)', borderTopColor: 'var(--accent2)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />{t('lobby_loading', lang)}</div>
        ) : (
          <button className="btn btn-primary btn-full" onClick={handleJoinClick} disabled={loading || joinLocked || user.balance < selectedFee} style={{ fontSize: '17px', padding: '16px', opacity: joinLocked ? 0.7 : 1 }}>
            {(loading || joinLocked) ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />{t('lobby_joining', lang)}</span> : t('lobby_join_btn', lang)}
          </button>
        )}
        {user && user.balance < selectedFee && <p style={{ color: 'var(--danger2)', fontSize: '13px', marginTop: '10px', textAlign: 'center' }}>{t('lobby_not_enough', lang)} {selectedFee}</p>}
      </div>

      {user && (
        <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '360px', flexWrap: 'wrap', flexShrink: 0 }}>
          {[
            { label: t('lobby_games', lang), value: user.total_games ?? 0 },
            { label: t('lobby_wins', lang), value: user.total_wins ?? 0 },
            { label: t('lobby_winrate', lang), value: user.total_games > 0 ? `${Math.round((user.total_wins / user.total_games) * 100)}%` : '0%' },
            { label: lang === 'he' ? 'ניקוד' : lang === 'ru' ? 'Очки' : 'Score', value: (user.score ?? 0).toLocaleString(), highlight: true },
          ].map(({ label, value, highlight }) => (
            <div key={label} style={{ flex: '1 1 calc(50% - 4px)', background: highlight ? 'rgba(124,58,237,0.1)' : 'var(--surface)', border: `1px solid ${highlight ? 'rgba(124,58,237,0.3)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent2)' }}>{value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '360px', flexShrink: 0 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { haptic('light'); onLeaderboard(); }}>{t('lobby_leaderboard', lang)}</button>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { haptic('light'); onPrizes(); }}>{t('lobby_prizes', lang)}</button>
      </div>
      <button className="btn btn-ghost btn-full" style={{ maxWidth: '360px', width: '100%', color: 'var(--success2)', border: '1px solid rgba(16,185,129,0.3)', flexShrink: 0 }} onClick={() => { haptic('light'); onInvite(); }}>
        👥 {lang === 'he' ? 'הזמן חבר • +5 קרדיטים' : lang === 'ru' ? 'Пригласить друга • +5 кредитов' : 'Invite Friend • +5 Credits'}
      </button>
    </div>
  );
}