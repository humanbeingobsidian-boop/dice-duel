import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from './hooks/useSocket';
import { getInitData, expandApp, getReferralCode, getStartAppParam } from './utils/telegram';

import SplashScreen from './screens/SplashScreen';
import LobbyScreen from './screens/LobbyScreen';
import WaitingRoomScreen from './screens/WaitingRoomScreen';
import GameScreen from './screens/GameScreen';
import GameScreenEnglish from './screens/GameScreenEnglish';
import ResultScreen from './screens/ResultScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import ReconnectScreen from './screens/ReconnectScreen';
import PrizesScreen from './screens/PrizesScreen';
import InviteScreen from './screens/InviteScreen';

const SCREEN = {
  SPLASH: 'splash',
  LOBBY: 'lobby',
  WAITING: 'waiting',
  GAME: 'game',
  RESULT: 'result',
  LEADERBOARD: 'leaderboard',
  PRIZES: 'prizes',
  INVITE: 'invite',
};

function getJoinErrorText(payload, lang) {
  const code = typeof payload === 'string' ? payload : (payload?.code || payload?.error);
  const fee = payload?.requiredFee;
  const messages = {
    he: {
      INSUFFICIENT_BALANCE: `אין מספיק קרדיטים${fee ? ` (צריך ${fee})` : ''}`,
      ALREADY_IN_GAME: 'כבר היית בחדר. ניקינו את החדר, נסה שוב.',
      USER_NOT_FOUND: 'משתמש לא נמצא',
      NoRealPlayers: 'החדר נסגר כי לא נשארו שחקנים אמיתיים',
      default: 'שגיאה בהצטרפות',
    },
    en: {
      INSUFFICIENT_BALANCE: `Not enough credits${fee ? ` (need ${fee})` : ''}`,
      ALREADY_IN_GAME: 'You were already in a room. The room was cleaned up, try again.',
      USER_NOT_FOUND: 'User not found',
      NoRealPlayers: 'The room closed because no real players remained',
      default: 'Failed to join game',
    },
    ru: {
      INSUFFICIENT_BALANCE: `Недостаточно кредитов${fee ? ` (нужно ${fee})` : ''}`,
      ALREADY_IN_GAME: 'Ты уже был в комнате. Комната очищена, попробуй ещё раз.',
      USER_NOT_FOUND: 'Пользователь не найден',
      NoRealPlayers: 'Комната закрыта: не осталось реальных игроков',
      default: 'Ошибка входа в игру',
    },
  };
  const dict = messages[lang] || messages.en;
  return dict[code] || payload?.message || payload?.error || dict.default;
}

export default function App() {
  const { emit, on, connected, socket } = useSocket();

  const [screen, setScreen] = useState(SCREEN.SPLASH);
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');
  const [user, setUser] = useState(null);
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [activePlayers, setActivePlayers] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [countdownActive, setCountdownActive] = useState(false);
  const [lastRoll, setLastRoll] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [rollError, setRollError] = useState(null);
  const [joinError, setJoinError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(10);
  const [disconnectedPlayer, setDisconnectedPlayer] = useState(null);
  const [myReconnectSeconds, setMyReconnectSeconds] = useState(null);
  const [readyPlayers, setReadyPlayers] = useState([]);
  const [selectedFee, setSelectedFee] = useState(5);
  const [referralBonus, setReferralBonus] = useState(null);

  const resetGameState = useCallback(() => {
    setGame(null);
    setPlayers([]);
    setActivePlayers([]);
    setCurrentPlayer(null);
    setLastRoll(null);
    setRolling(false);
    setRollError(null);
    setGameResult(null);
    setCountdown(null);
    setCountdownActive(false);
    setDisconnectedPlayer(null);
    setMyReconnectSeconds(null);
    setTurnSecondsLeft(10);
    setReadyPlayers([]);
  }, []);

  const handleLangChange = useCallback((code) => {
    setLang(code);
    localStorage.setItem('lang', code);
  }, []);

  useEffect(() => {
    expandApp();
    const startParam = getStartAppParam();
    if (startParam && startParam.length >= 6) {
      setTimeout(() => setScreen(SCREEN.INVITE), 800);
    }
  }, []);

  useEffect(() => {
    if (!connected) return;
    const initData = getInitData();
    const referralCode = getReferralCode();
    if (referralCode) console.log('🔗 Referral code detected:', referralCode);
    emit('authenticate', { initData, referralCode });
    setTimeout(() => emit('find_active_game'), 300);
  }, [connected, emit]);

  useEffect(() => {
    const offAuth = on('authenticated', ({ user }) => {
      setUser(user);
      if (user?.telegram_id) {
        socket?.on(`invite_bonus_${user.telegram_id}`, ({ redeemerName, bonus }) => {
          setUser(u => u ? { ...u, balance: (u.balance ?? 0) + bonus } : u);
          setReferralBonus({ newUser: redeemerName, bonus });
          setTimeout(() => setReferralBonus(null), 4000);
        });
      }
    });
    const offAuthErr = on('auth_error', ({ error }) => console.error('Auth error:', error));
    const offActiveGame = on('active_game_found', ({ snapshot }) => { if (!snapshot) return; setGame(snapshot.game); setPlayers(snapshot.players); setActivePlayers(snapshot.activePlayers); setCurrentPlayer(snapshot.currentPlayer); if (snapshot.turnSecondsLeft !== undefined) setTurnSecondsLeft(snapshot.turnSecondsLeft); if (snapshot.reconnectSecondsLeft > 0) setMyReconnectSeconds(snapshot.reconnectSecondsLeft); setScreen(SCREEN.GAME); });
    const offNoActiveGame = on('no_active_game', () => {});
    const offTimerPaused = on('turn_timer_paused', () => {});
    const offTimerResumed = on('turn_timer_resumed', () => {});
    const offJoined = on('joined_game', ({ game, players, user: updatedUser, countdownActive: ca, countdownSecondsLeft: cs }) => { setGame(game); setPlayers(players); setActivePlayers(players.filter(p => p.status === 'active')); if (updatedUser) setUser(updatedUser); setJoining(false); setJoinError(null); if (ca && cs > 0) { setCountdown(cs); setCountdownActive(true); } else { setCountdown(null); setCountdownActive(false); } setScreen(SCREEN.WAITING); });
    const offJoinErr = on('join_error', (payload) => { setJoining(false); setJoinError(getJoinErrorText(payload, lang)); });
    const offPlayerJoined = on('player_joined', ({ players, pot }) => { setPlayers(players); setActivePlayers(players.filter(p => p.status === 'active')); setGame(g => g ? { ...g, pot } : g); });
    const offPlayerLeft = on('player_left', ({ players, pot }) => { setPlayers(players); setActivePlayers(players.filter(p => p.status === 'active')); setGame(g => g ? { ...g, pot } : g); });
    const offLeftGame = on('left_game', ({ balance }) => { resetGameState(); setUser(u => u ? { ...u, balance } : u); setScreen(SCREEN.LOBBY); });
    const offLeftActiveGame = on('left_active_game', () => { resetGameState(); setScreen(SCREEN.LOBBY); });
    const offLeaveActiveErr = on('leave_active_error', ({ error }) => { setRollError(error); setTimeout(() => setRollError(null), 3000); });
    const offCountdownStart = on('countdown_started', ({ secondsLeft }) => { setCountdown(secondsLeft); setCountdownActive(true); });
    const offCountdownTick = on('countdown_tick', ({ secondsLeft }) => setCountdown(secondsLeft));
    const offCountdownStopped = on('countdown_stopped', () => { setCountdown(null); setCountdownActive(false); });
    const offGameStarted = on('game_started', ({ players, currentPlayer, pot }) => { setPlayers(players); setActivePlayers(players.filter(p => p.status === 'active')); setCurrentPlayer(currentPlayer); setGame(g => g ? { ...g, pot } : g); setCountdownActive(false); setTurnSecondsLeft(10); setScreen(SCREEN.GAME); });
    const offReadyUpdated = on('ready_updated', ({ readyUserIds }) => setReadyPlayers(readyUserIds));
    const offAllReady = on('all_ready', () => {});
    const offTurnTick = on('turn_timer_tick', ({ secondsLeft }) => setTurnSecondsLeft(secondsLeft));
    const offDiceRolled = on('dice_rolled', ({ userId, firstName, diceResult, isEliminated, remainingPlayers, players: updatedPlayers }) => { setRolling(false); setLastRoll({ userId, firstName, diceResult, isEliminated }); setActivePlayers(remainingPlayers); if (updatedPlayers) setPlayers(updatedPlayers); else setPlayers(prev => prev.map(p => p.user_id === userId && isEliminated ? { ...p, status: 'eliminated' } : p)); });
    const offRollErr = on('roll_error', ({ error }) => { setRolling(false); setRollError(error); setTimeout(() => setRollError(null), 3000); });
    const offNextTurn = on('next_turn', ({ currentPlayer, remainingPlayers }) => { setCurrentPlayer(currentPlayer); setActivePlayers(remainingPlayers); });
    const offPlayerDisconnected = on('player_disconnected', ({ userId, firstName, secondsLeft }) => { setDisconnectedPlayer({ userId, firstName, secondsLeft }); });
    const offReconnectTick = on('reconnect_tick', ({ userId, secondsLeft }) => { setDisconnectedPlayer(d => d?.userId === userId ? { ...d, secondsLeft } : d); setMyReconnectSeconds(prev => prev !== null ? secondsLeft : prev); });
    const offPlayerAbandoned = on('player_abandoned', ({ userId, remainingPlayers }) => { setDisconnectedPlayer(null); setActivePlayers(remainingPlayers); setPlayers(prev => prev.map(p => p.user_id === userId ? { ...p, status: 'eliminated' } : p)); });
    const offPlayerReconnected = on('player_reconnected', ({ userId }) => { setDisconnectedPlayer(d => d?.userId === userId ? null : d); setMyReconnectSeconds(null); });
    const offGameOver = on('game_over', ({ winner, pot, prize, houseCut }) => { setGameResult({ winner, pot, prize, houseCut }); setTimeout(() => setScreen(SCREEN.RESULT), 300); });
    const offGameCancelled = on('game_cancelled', ({ reason }) => { setScreen(SCREEN.LOBBY); setJoinError(getJoinErrorText({ code: reason === 'No real players' ? 'NoRealPlayers' : reason }, lang)); });
    const offSnapshot = on('game_snapshot', ({ game, players, activePlayers, currentPlayer, started, turnSecondsLeft, reconnectSecondsLeft }) => { setGame(game); setPlayers(players); setActivePlayers(activePlayers); setCurrentPlayer(currentPlayer); if (turnSecondsLeft !== undefined) setTurnSecondsLeft(turnSecondsLeft); if (started && game.status === 'active') { setScreen(SCREEN.GAME); if (reconnectSecondsLeft && reconnectSecondsLeft > 0) setMyReconnectSeconds(reconnectSecondsLeft); } else if (game.status === 'waiting') { setScreen(SCREEN.WAITING); } });
    const offBalance = on('balance_updated', ({ balance }) => setUser(u => u ? { ...u, balance } : u));
    return () => { offAuth(); offAuthErr(); offActiveGame(); offNoActiveGame(); offTimerPaused(); offTimerResumed(); offJoined(); offJoinErr(); offPlayerJoined(); offPlayerLeft(); offLeftGame(); offLeftActiveGame(); offLeaveActiveErr(); offCountdownStart(); offCountdownTick(); offCountdownStopped(); offReadyUpdated(); offAllReady(); offGameStarted(); offTurnTick(); offDiceRolled(); offRollErr(); offNextTurn(); offPlayerDisconnected(); offReconnectTick(); offPlayerAbandoned(); offPlayerReconnected(); offGameOver(); offGameCancelled(); offSnapshot(); offBalance(); };
  }, [on, resetGameState, socket, lang]);

  const handleJoinGame = useCallback(() => { setJoining(true); setJoinError(null); emit('join_game', { entryFee: selectedFee }); }, [emit, selectedFee]);
  const handleToggleReady = useCallback(() => emit('toggle_ready'), [emit]);
  const handleRoll = useCallback(() => { if (rolling) return; setRolling(true); setRollError(null); emit('roll_dice'); }, [emit, rolling]);
  const handleLeaveGame = useCallback(() => emit('leave_game'), [emit]);
  const handleLeaveActiveGame = useCallback(() => emit('leave_active_game'), [emit]);
  const handleReturnToGame = useCallback(() => { if (game?.room_code) emit('reconnect_game', { roomCode: game.room_code }); setMyReconnectSeconds(null); }, [emit, game]);
  const handleReconnectExit = useCallback(() => { setMyReconnectSeconds(null); setScreen(SCREEN.RESULT); setGameResult(prev => prev ?? { winner: null, pot: game?.pot ?? 0, prize: 0, houseCut: 0 }); }, [game]);
  const handlePlayAgain = useCallback(() => { resetGameState(); setScreen(SCREEN.LOBBY); }, [resetGameState]);

  const ReferralToast = referralBonus ? <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95))', border: '1px solid var(--success2)', borderRadius: 'var(--radius)', padding: '12px 20px', zIndex: 300, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'pop 0.3s ease' }}><span style={{ fontWeight: 700, fontSize: '14px' }}>🎁 +{referralBonus.bonus} קרדיטים! {referralBonus.newUser} הצטרף דרך הקישור שלך</span></div> : null;

  if (screen === SCREEN.SPLASH) return <>{ReferralToast}<SplashScreen lang={lang} onLangChange={handleLangChange} onEnter={() => setScreen(SCREEN.LOBBY)} /></>;
  if (screen === SCREEN.INVITE) return <InviteScreen lang={lang} onLangChange={handleLangChange} user={user} onBack={() => setScreen(SCREEN.LOBBY)} onBalanceUpdate={(balance) => setUser(u => u ? { ...u, balance } : u)} />;
  if (screen === SCREEN.PRIZES) return <PrizesScreen lang={lang} onLangChange={handleLangChange} user={user} onBack={() => setScreen(SCREEN.LOBBY)} onBalanceUpdate={(balance) => setUser(u => u ? { ...u, balance } : u)} />;
  if (screen === SCREEN.LEADERBOARD) return <LeaderboardScreen lang={lang} onLangChange={handleLangChange} onBack={() => setScreen(SCREEN.LOBBY)} myTelegramId={user?.telegram_id} />;
  if (screen === SCREEN.LOBBY) return <LobbyScreen lang={lang} onLangChange={handleLangChange} user={user} onJoin={handleJoinGame} onLeaderboard={() => setScreen(SCREEN.LEADERBOARD)} onPrizes={() => setScreen(SCREEN.PRIZES)} onInvite={() => setScreen(SCREEN.INVITE)} onBack={() => setScreen(SCREEN.SPLASH)} loading={joining} error={joinError} selectedFee={selectedFee} onFeeChange={setSelectedFee} />;
  if (screen === SCREEN.WAITING) return <WaitingRoomScreen lang={lang} onLangChange={handleLangChange} game={game} players={players} myUserId={user?.id} countdown={countdown} countdownActive={countdownActive} onLeave={handleLeaveGame} readyPlayers={readyPlayers} onToggleReady={handleToggleReady} />;
  if (screen === SCREEN.GAME) {
    const ActiveGameScreen = lang === 'en' ? GameScreenEnglish : GameScreen;
    return <>{<ActiveGameScreen lang={lang} game={game} players={players} activePlayers={activePlayers} currentPlayer={currentPlayer} myUserId={user?.id} lastRoll={lastRoll} onRoll={handleRoll} rolling={rolling} rollError={rollError} turnSecondsLeft={turnSecondsLeft} disconnectedPlayer={disconnectedPlayer} onLeaveAfterElimination={handleLeaveActiveGame} />}{myReconnectSeconds !== null && <ReconnectScreen lang={lang} secondsLeft={myReconnectSeconds} onReturn={handleReturnToGame} onGiveUp={handleReconnectExit} />}</>;
  }
  if (screen === SCREEN.RESULT) return <ResultScreen lang={lang} winner={gameResult?.winner} pot={gameResult?.pot} prize={gameResult?.prize} houseCut={gameResult?.houseCut} myUserId={user?.id} onPlayAgain={handlePlayAgain} onLeaderboard={() => setScreen(SCREEN.LEADERBOARD)} />;
  return null;
}
