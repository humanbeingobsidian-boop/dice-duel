// frontend/src/screens/ProfileScreen.jsx
import React, { useEffect, useState } from 'react';
import { haptic, hapticNotification, getInitData } from '../utils/telegram';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const TEXT = {
  he: {
    title: 'פרופיל', back: 'חזור', loading: 'טוען פרופיל...', save: 'שמור', saving: 'שומר...', nickname: 'כינוי', nicknameHint: 'עד 24 תווים', level: 'רמה', xpNext: 'XP לרמה הבאה', stats: 'סטטיסטיקות', customize: 'התאמה אישית', achievements: 'יעדים / הישגים', collection: 'אוסף', soon: 'בקרוב', games: 'משחקים', wins: 'ניצחונות', winRate: 'אחוז ניצחון', score: 'ניקוד', loginStreak: 'רצף כניסות', bestLoginStreak: 'שיא רצף', friends: 'חברים', stars: 'כוכבים שנקנו', avatar: 'תמונה', background: 'רקע', frame: 'מסגרת', saved: 'הפרופיל נשמר', error: 'שגיאה בטעינת הפרופיל',
  },
  en: {
    title: 'Profile', back: 'Back', loading: 'Loading profile...', save: 'Save', saving: 'Saving...', nickname: 'Nickname', nicknameHint: 'Up to 24 characters', level: 'Level', xpNext: 'XP to next level', stats: 'Stats', customize: 'Customize', achievements: 'Goals / Achievements', collection: 'Collection', soon: 'Soon', games: 'Games', wins: 'Wins', winRate: 'Win Rate', score: 'Score', loginStreak: 'Login Streak', bestLoginStreak: 'Best Streak', friends: 'Friends', stars: 'Stars Bought', avatar: 'Avatar', background: 'Background', frame: 'Frame', saved: 'Profile saved', error: 'Failed to load profile',
  },
  ru: {
    title: 'Профиль', back: 'Назад', loading: 'Загрузка профиля...', save: 'Сохранить', saving: 'Сохраняем...', nickname: 'Никнейм', nicknameHint: 'До 24 символов', level: 'Уровень', xpNext: 'XP до следующего уровня', stats: 'Статистика', customize: 'Настройка', achievements: 'Цели / достижения', collection: 'Коллекция', soon: 'Скоро', games: 'Игры', wins: 'Победы', winRate: 'Процент побед', score: 'Очки', loginStreak: 'Серия входов', bestLoginStreak: 'Лучшая серия', friends: 'Друзья', stars: 'Куплено Stars', avatar: 'Аватар', background: 'Фон', frame: 'Рамка', saved: 'Профиль сохранён', error: 'Ошибка загрузки профиля',
  },
};

const AVATARS = ['🐢', '🐰', '🐱', '🐶', '🐼', '🐸', '🦊', '🐺', '🦉', '🐯', '🦁', '🦄', '🐲'];
const BACKGROUNDS = [
  { id: 'default_purple', label: 'Purple', bg: 'radial-gradient(ellipse at 50% 20%, #1a0a3a 0%, var(--bg) 65%)' },
  { id: 'blue', label: 'Blue', bg: 'radial-gradient(ellipse at 50% 20%, rgba(37,99,235,0.35), var(--bg) 65%)' },
  { id: 'green', label: 'Green', bg: 'radial-gradient(ellipse at 50% 20%, rgba(16,185,129,0.28), var(--bg) 65%)' },
  { id: 'gold', label: 'Gold', bg: 'radial-gradient(ellipse at 50% 20%, rgba(245,158,11,0.28), var(--bg) 65%)' },
];
const FRAMES = ['basic', 'purple', 'gold', 'neon'];

export default function ProfileScreen({ lang = 'en', onBack, onProfileSaved }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('🐢');
  const [background, setBackground] = useState('default_purple');
  const [frame, setFrame] = useState('basic');
  const s = TEXT[lang] || TEXT.en;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${BACKEND_URL}/api/profile`, { headers: { 'x-telegram-init-data': getInitData() } })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (!data.success) throw new Error(data.error || 'profile');
        const p = data.profile;
        setProfile(p);
        setNickname(p.user?.nickname || p.user?.first_name || '');
        setAvatar(p.user?.selected_avatar || '🐢');
        setBackground(p.user?.selected_background || 'default_purple');
        setFrame(p.user?.selected_frame || 'basic');
        setError(null);
      })
      .catch(() => !cancelled && setError(s.error))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [s.error]);

  async function saveProfile() {
    if (saving) return;
    setSaving(true);
    haptic('medium');
    try {
      const res = await fetch(`${BACKEND_URL}/api/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getInitData() },
        body: JSON.stringify({ nickname, selected_avatar: avatar, selected_background: background, selected_frame: frame }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'save');
      setProfile(data.profile);
      onProfileSaved?.(data.profile.user);
      hapticNotification('success');
    } catch {
      hapticNotification('error');
      setError(s.error);
    } finally {
      setSaving(false);
    }
  }

  const progress = profile?.progress || { level: 1, xpIntoLevel: 0, xpNeeded: 100, progress: 0, xpToNext: 100 };
  const user = profile?.user || {};
  const stats = profile?.stats || {};
  const bg = BACKGROUNDS.find(b => b.id === background)?.bg || BACKGROUNDS[0].bg;

  return (
    <div className="screen" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: bg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => { haptic('light'); onBack(); }}>{s.back}</button>
        <h2 style={{ fontSize: '20px', fontWeight: 800 }}>{s.title}</h2>
        <div style={{ width: 64 }} />
      </div>

      {loading ? <div className="card" style={{ padding: '28px', textAlign: 'center', color: 'var(--text2)' }}>{s.loading}</div> : error ? <div className="card" style={{ padding: '18px', color: 'var(--danger2)' }}>{error}</div> : (
        <>
          <div className="card" style={{ padding: '22px', textAlign: 'center' }}>
            <div style={{ width: 86, height: 86, borderRadius: '50%', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '46px', background: frame === 'gold' ? 'linear-gradient(135deg, var(--gold), var(--gold2))' : frame === 'neon' ? 'linear-gradient(135deg, #06b6d4, #a855f7)' : frame === 'purple' ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'var(--surface2)', border: '3px solid rgba(255,255,255,0.15)', boxShadow: frame === 'neon' ? '0 0 24px rgba(168,85,247,0.55)' : '0 8px 24px rgba(0,0,0,0.3)' }}>{avatar}</div>
            <div style={{ fontSize: '24px', fontWeight: 900 }}>{nickname || user.first_name}</div>
            <div style={{ color: 'var(--gold2)', fontWeight: 800, marginTop: 4 }}>{s.level} {progress.level}</div>
            <div style={{ marginTop: 14, height: 10, background: 'var(--bg3)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${progress.progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--gold2))', borderRadius: 999, transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ marginTop: 8, color: 'var(--text2)', fontSize: 13 }}>{progress.xpIntoLevel} / {progress.xpNeeded} XP · {progress.xpToNext} {s.xpNext}</div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>{s.customize}</h3>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>{s.nickname}</label>
            <input value={nickname} onChange={e => setNickname(e.target.value.slice(0, 24))} placeholder={s.nicknameHint} style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', font: 'inherit', marginBottom: 14 }} />

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{s.avatar}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {AVATARS.map(a => <button key={a} onClick={() => { haptic('light'); setAvatar(a); }} style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${avatar === a ? 'var(--accent2)' : 'var(--border)'}`, background: avatar === a ? 'rgba(124,58,237,0.2)' : 'var(--bg3)', fontSize: 22 }}>{a}</button>)}
            </div>

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{s.background}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
              {BACKGROUNDS.map(b => <button key={b.id} onClick={() => { haptic('light'); setBackground(b.id); }} style={{ height: 42, borderRadius: 'var(--radius-sm)', border: `2px solid ${background === b.id ? 'var(--accent2)' : 'var(--border)'}`, background: b.bg, color: 'white', fontSize: 11, fontWeight: 700 }}>{b.label}</button>)}
            </div>

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{s.frame}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {FRAMES.map(f => <button key={f} onClick={() => { haptic('light'); setFrame(f); }} className={frame === f ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '9px 6px', fontSize: 12 }}>{f}</button>)}
            </div>

            <button className="btn btn-primary btn-full" style={{ marginTop: 16, padding: 14 }} disabled={saving} onClick={saveProfile}>{saving ? s.saving : s.save}</button>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>{s.stats}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <Stat label={s.games} value={stats.games ?? 0} />
              <Stat label={s.wins} value={stats.wins ?? 0} />
              <Stat label={s.winRate} value={`${stats.winRate ?? 0}%`} />
              <Stat label={s.score} value={(stats.score ?? 0).toLocaleString()} />
              <Stat label={s.loginStreak} value={stats.loginStreak ?? 0} />
              <Stat label={s.bestLoginStreak} value={stats.bestLoginStreak ?? 0} />
              <Stat label={s.friends} value={stats.friendsInvited ?? 0} />
              <Stat label={s.stars} value={stats.starsBought ?? 0} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Placeholder title={s.achievements} soon={s.soon} />
            <Placeholder title={s.collection} soon={s.soon} />
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '10px', textAlign: 'center' }}><div style={{ color: 'var(--accent2)', fontWeight: 800, fontSize: 18 }}>{value}</div><div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 2 }}>{label}</div></div>;
}

function Placeholder({ title, soon }) {
  return <div className="card" style={{ padding: 14, textAlign: 'center', opacity: 0.85 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{title}</div><div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>{soon}</div></div>;
}
