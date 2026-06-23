// frontend/src/screens/ProfileScreen.jsx
import React, { useEffect, useState } from 'react';
import { haptic, hapticNotification, getInitData } from '../utils/telegram';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const TEXT = {
  he: { title: 'פרופיל', back: 'חזור', loading: 'טוען פרופיל...', save: 'שמור', saving: 'שומר...', nickname: 'כינוי', nicknameHint: 'עד 24 תווים', level: 'רמה', xpNext: 'XP לרמה הבאה', stats: 'סטטיסטיקות', customize: 'התאמה אישית', achievements: 'הישגים', collection: 'אוסף', games: 'משחקים', wins: 'ניצחונות', winRate: 'אחוז ניצחון', score: 'ניקוד', loginStreak: 'רצף כניסות', bestLoginStreak: 'שיא רצף', friends: 'חברים', stars: 'כוכבים שנקנו', avatar: 'חיות', background: 'רקעים', frame: 'מסגרות', error: 'שגיאה בטעינת הפרופיל', locked: 'נעול', unlocked: 'פתוח', xpReward: 'XP', all: 'הכול' },
  en: { title: 'Profile', back: 'Back', loading: 'Loading profile...', save: 'Save', saving: 'Saving...', nickname: 'Nickname', nicknameHint: 'Up to 24 characters', level: 'Level', xpNext: 'XP to next level', stats: 'Stats', customize: 'Customize', achievements: 'Achievements', collection: 'Collection', games: 'Games', wins: 'Wins', winRate: 'Win Rate', score: 'Score', loginStreak: 'Login Streak', bestLoginStreak: 'Best Streak', friends: 'Friends', stars: 'Stars Bought', avatar: 'Avatars', background: 'Backgrounds', frame: 'Frames', error: 'Failed to load profile', locked: 'Locked', unlocked: 'Unlocked', xpReward: 'XP', all: 'All' },
  ru: { title: 'Профиль', back: 'Назад', loading: 'Загрузка профиля...', save: 'Сохранить', saving: 'Сохраняем...', nickname: 'Никнейм', nicknameHint: 'До 24 символов', level: 'Уровень', xpNext: 'XP до следующего уровня', stats: 'Статистика', customize: 'Настройка', achievements: 'Достижения', collection: 'Коллекция', games: 'Игры', wins: 'Победы', winRate: 'Процент побед', score: 'Очки', loginStreak: 'Серия входов', bestLoginStreak: 'Лучшая серия', friends: 'Друзья', stars: 'Куплено Stars', avatar: 'Аватары', background: 'Фоны', frame: 'Рамки', error: 'Ошибка загрузки профиля', locked: 'Закрыто', unlocked: 'Открыто', xpReward: 'XP', all: 'Все' },
};

const BACKGROUND_STYLES = {
  default_purple: 'radial-gradient(ellipse at 50% 20%, #1a0a3a 0%, var(--bg) 65%)',
  blue: 'radial-gradient(ellipse at 50% 20%, rgba(37,99,235,0.35), var(--bg) 65%)',
  green: 'radial-gradient(ellipse at 50% 20%, rgba(16,185,129,0.28), var(--bg) 65%)',
  gold: 'radial-gradient(ellipse at 50% 20%, rgba(245,158,11,0.28), var(--bg) 65%)',
  galaxy: 'radial-gradient(ellipse at 50% 20%, rgba(99,102,241,0.38), rgba(168,85,247,0.16), var(--bg) 70%)',
  fire: 'radial-gradient(ellipse at 50% 20%, rgba(239,68,68,0.35), rgba(245,158,11,0.18), var(--bg) 70%)',
  rainbow_animated: 'linear-gradient(135deg, rgba(239,68,68,0.28), rgba(245,158,11,0.24), rgba(16,185,129,0.22), rgba(59,130,246,0.24), rgba(168,85,247,0.28))',
};

function frameStyle(frame) {
  if (frame === 'gold') return { background: 'linear-gradient(135deg, var(--gold), var(--gold2))', boxShadow: '0 0 22px rgba(251,191,36,0.55)' };
  if (frame === 'neon') return { background: 'linear-gradient(135deg, #06b6d4, #a855f7)', boxShadow: '0 0 24px rgba(168,85,247,0.7)' };
  if (frame === 'purple') return { background: 'linear-gradient(135deg, var(--accent), var(--accent2))', boxShadow: '0 0 18px rgba(168,85,247,0.45)' };
  if (frame === 'crown') return { background: 'linear-gradient(135deg, #92400e, #fbbf24)', boxShadow: '0 0 26px rgba(251,191,36,0.7)' };
  if (frame === 'rainbow') return { background: 'linear-gradient(135deg, #ef4444, #f59e0b, #10b981, #3b82f6, #a855f7)', boxShadow: '0 0 30px rgba(168,85,247,0.8)' };
  return { background: 'var(--surface2)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' };
}

export default function ProfileScreen({ lang = 'en', onBack, onProfileSaved }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('🐢');
  const [background, setBackground] = useState('default_purple');
  const [frame, setFrame] = useState('basic');
  const [tab, setTab] = useState('avatars');
  const [achFilter, setAchFilter] = useState('all');
  const s = TEXT[lang] || TEXT.en;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${BACKEND_URL}/api/profile?lang=${lang}`, { headers: { 'x-telegram-init-data': getInitData() } })
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
  }, [lang, s.error]);

  async function saveProfile() {
    if (saving) return;
    setSaving(true);
    haptic('medium');
    try {
      const res = await fetch(`${BACKEND_URL}/api/profile?lang=${lang}`, {
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
  const collection = profile?.collection || { avatars: [], backgrounds: [], frames: [] };
  const achievements = profile?.achievements || [];
  const bg = BACKGROUND_STYLES[background] || BACKGROUND_STYLES.default_purple;
  const unlockedAchievements = achievements.filter(a => a.unlocked).length;
  const visibleAchievements = achievements.filter(a => achFilter === 'all' ? true : achFilter === 'unlocked' ? a.unlocked : !a.unlocked);

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
            <div style={{ width: 86, height: 86, borderRadius: '50%', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '46px', border: '3px solid rgba(255,255,255,0.15)', ...frameStyle(frame) }}>{avatar}</div>
            <div style={{ fontSize: '24px', fontWeight: 900 }}>{nickname || user.first_name}</div>
            <div style={{ color: 'var(--gold2)', fontWeight: 800, marginTop: 4 }}>{s.level} {progress.level}</div>
            <div style={{ marginTop: 14, height: 10, background: 'var(--bg3)', borderRadius: 999, overflow: 'hidden' }}><div style={{ width: `${progress.progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--gold2))', borderRadius: 999, transition: 'width 0.4s ease' }} /></div>
            <div style={{ marginTop: 8, color: 'var(--text2)', fontSize: 13 }}>{progress.xpIntoLevel} / {progress.xpNeeded} XP · {progress.xpToNext} {s.xpNext}</div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>{s.customize}</h3>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>{s.nickname}</label>
            <input value={nickname} onChange={e => setNickname(e.target.value.slice(0, 24))} placeholder={s.nicknameHint} style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', font: 'inherit', marginBottom: 14 }} />
            <button className="btn btn-primary btn-full" style={{ padding: 14 }} disabled={saving} onClick={saveProfile}>{saving ? s.saving : s.save}</button>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>{s.stats}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <Stat label={s.games} value={stats.games ?? 0} /><Stat label={s.wins} value={stats.wins ?? 0} /><Stat label={s.winRate} value={`${stats.winRate ?? 0}%`} /><Stat label={s.score} value={(stats.score ?? 0).toLocaleString()} /><Stat label={s.loginStreak} value={stats.loginStreak ?? 0} /><Stat label={s.bestLoginStreak} value={stats.bestLoginStreak ?? 0} /><Stat label={s.friends} value={stats.friendsInvited ?? 0} /><Stat label={s.stars} value={stats.starsBought ?? 0} />
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>{s.collection}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              <TabButton label={s.avatar} active={tab === 'avatars'} onClick={() => setTab('avatars')} />
              <TabButton label={s.background} active={tab === 'backgrounds'} onClick={() => setTab('backgrounds')} />
              <TabButton label={s.frame} active={tab === 'frames'} onClick={() => setTab('frames')} />
            </div>
            {tab === 'avatars' && <CollectionGrid items={collection.avatars} selected={avatar} onSelect={setAvatar} kind="avatar" />}
            {tab === 'backgrounds' && <CollectionGrid items={collection.backgrounds} selected={background} onSelect={setBackground} kind="background" />}
            {tab === 'frames' && <CollectionGrid items={collection.frames} selected={frame} onSelect={setFrame} kind="frame" />}
            <button className="btn btn-primary btn-full" style={{ marginTop: 14, padding: 12 }} disabled={saving} onClick={saveProfile}>{saving ? s.saving : s.save}</button>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>{s.achievements} · {unlockedAchievements}/{achievements.length}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              <TabButton label={s.all} active={achFilter === 'all'} onClick={() => setAchFilter('all')} />
              <TabButton label={s.unlocked} active={achFilter === 'unlocked'} onClick={() => setAchFilter('unlocked')} />
              <TabButton label={s.locked} active={achFilter === 'locked'} onClick={() => setAchFilter('locked')} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleAchievements.map(a => <Achievement key={a.id} item={a} s={s} />)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TabButton({ label, active, onClick }) {
  return <button className={active ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '9px 6px', fontSize: 12 }} onClick={() => { haptic('light'); onClick(); }}>{label}</button>;
}

function CollectionGrid({ items, selected, onSelect, kind }) {
  return <div style={{ display: 'grid', gridTemplateColumns: kind === 'avatar' ? 'repeat(5, 1fr)' : 'repeat(3, 1fr)', gap: 8 }}>{items.map(item => <CollectionItem key={item.id} item={item} selected={selected} onSelect={onSelect} kind={kind} />)}</div>;
}

function CollectionItem({ item, selected, onSelect, kind }) {
  const value = kind === 'avatar' ? item.value : item.id;
  const active = selected === value;
  return <button disabled={!item.unlocked} onClick={() => { if (item.unlocked) { haptic('light'); onSelect(value); } }} title={item.unlockText} style={{ minHeight: kind === 'avatar' ? 46 : 52, borderRadius: kind === 'avatar' ? '50%' : 'var(--radius-sm)', border: `2px solid ${active ? 'var(--accent2)' : 'var(--border)'}`, background: active ? 'rgba(124,58,237,0.22)' : 'var(--bg3)', color: item.unlocked ? 'var(--text)' : 'var(--text3)', opacity: item.unlocked ? 1 : 0.42, fontSize: kind === 'avatar' ? 24 : 11, fontWeight: 800, position: 'relative', padding: '6px' }}>{kind === 'avatar' ? item.value : item.label}{!item.unlocked && <span style={{ position: 'absolute', right: -3, top: -5, fontSize: 12 }}>🔒</span>}<div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>{item.rarity}</div></button>;
}

function Achievement({ item, s }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: item.unlocked ? 'rgba(16,185,129,0.10)' : 'var(--bg3)', border: `1px solid ${item.unlocked ? 'rgba(16,185,129,0.28)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', opacity: item.unlocked ? 1 : 0.62 }}><div style={{ fontSize: 22 }}>{item.unlocked ? item.icon : '🔒'}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 800, fontSize: 13, color: item.unlocked ? 'var(--text)' : 'var(--text3)' }}>{item.title}</div><div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{item.description}</div></div><div style={{ fontSize: 11, color: item.unlocked ? 'var(--success2)' : 'var(--text3)', fontWeight: 800 }}>{item.xp} {s.xpReward}</div></div>;
}

function Stat({ label, value }) {
  return <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '10px', textAlign: 'center' }}><div style={{ color: 'var(--accent2)', fontWeight: 800, fontSize: 18 }}>{value}</div><div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 2 }}>{label}</div></div>;
}
