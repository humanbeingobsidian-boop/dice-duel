// frontend/src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from './hooks/useSocket';
import { getInitData, expandApp } from './utils/telegram';

import SplashScreen from './screens/SplashScreen';
import LobbyScreen from './screens/LobbyScreen';
import WaitingRoomScreen from './screens/WaitingRoomScreen';
import GameScreen from './screens/GameScreen';
import ResultScreen from './screens/ResultScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import ReconnectScreen from './screens/ReconnectScreen';
import PrizesScreen from './screens/PrizesScreen';
import LanguageSwitcher from './components/LanguageSwitcher';

// Screens
const SCREEN = {
  SPLASH: 'splash',
  LOBBY: 'lobby',
  WAITING: 'waiting',
  GAME: 'game',
  RESULT: 'result',
  LEADERBOARD: 'leaderboard',
  PRIZES: 'prizes',
};

export default function App() {
  const { emit, on, off, connected } = useSocket();

  // App state
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
  const [readyPlayers, setReadyPlayers] = useState([]); // userIds who are ready
  const [selectedFee, setSelectedFee] = useState(5); // entry fee for next game

  const handleLangChange = useCallback((code) => {
    setLang(code);
    localStorage.setItem('lang', code);
  }, []);

  // ─── Initial setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    expandApp();
  }, []);

  // ─── Authenticate whenever we connect (or reconnect) ───────────────────────
  useEffect(() => {
    if (!connected) return;
    const initData = getInitData();
    emit('authenticate', { initData });
    // FIX #1: after auth, check if we have an active game to return to
    setTimeout(() => emit('find_active_game'), 300);
  }, [connected, emit]);

  // ─── Socket event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const offAuth = on('authenticated', ({ user }) => setUser(user));
    const offAuthErr = on('auth_error', ({ error }) => console.error('Auth error:', error));

    // FIX #1: auto-rejoin active game after reconnect
    const offActiveGame = on('active_game_found', ({ roomCode, snapshot }) => {
      if (!snapshot) return;
      setGame(snapshot.game); setPlayers(snapshot.players);
      setActivePlayers(snapshot.activePlayers); setCurrentPlayer(snapshot.currentPlayer);
      if (snapshot.turnSecondsLeft !== undefined) setTurnSecondsLeft(snapshot.turnSecondsLeft);
      if (snapshot.reconnectSecondsLeft > 0) setMyReconnectSeconds(snapshot.reconnectSecondsLeft);
      setScreen(SCREEN.GAME);
    });
    const offNoActiveGame = on('no_active_game', () => { /* stay on current screen */ });

    // Turn timer paused/resumed (while player is disconnected)
    const offTimerPaused = on('turn_timer_paused', () => {
      // Freeze display — don't clear, just stop ticking (server stopped sending ticks)
    });
    const offTimerResumed = on('turn_timer_resumed', () => {
      // Server will start sending turn_timer_tick again
    });

    // Joined waiting room
    const offJoined = on('joined_game', ({ game, players, user: updatedUser, countdownActive: ca, countdownSecondsLeft: cs }) => {
      setGame(game);
      setPlayers(players);
      setActivePlayers(players.filter(p => p.status === 'active'));
      if (updatedUser) setUser(updatedUser);
      setJoining(false);
      setJoinError(null);
      // FIX #1: sync countdown for player who joins mid-countdown
      if (ca && cs > 0) { setCountdown(cs); setCountdownActive(true); }
      else { setCountdown(null); setCountdownActive(false); }
      setScreen(SCREEN.WAITING);
    });
    const offJoinErr = on('join_error', ({ error }) => { setJoining(false); setJoinError(error); });

    // Waiting room — players joining/leaving
    const offPlayerJoined = on('player_joined', ({ players, pot }) => {
      setPlayers(players);
      setActivePlayers(players.filter(p => p.status === 'active'));
      setGame(g => g ? { ...g, pot } : g);
    });
    const offPlayerLeft = on('player_left', ({ players, pot }) => {
      setPlayers(players);
      setActivePlayers(players.filter(p => p.status === 'active'));
      setGame(g => g ? { ...g, pot } : g);
    });
    const offLeftGame = on('left_game', ({ balance }) => {
      setGame(null); setPlayers([]); setActivePlayers([]);
      setCountdown(null); setCountdownActive(false);
      setUser(u => u ? { ...u, balance } : u);
      setScreen(SCREEN.LOBBY);
    });

    // Lobby countdown — FIX #1: all players see same timer
    const offCountdownStart = on('countdown_started', ({ secondsLeft }) => {
      setCountdown(secondsLeft); setCountdownActive(true);
    });
    const offCountdownTick = on('countdown_tick', ({ secondsLeft }) => setCountdown(secondsLeft));
    const offCountdownStopped = on('countdown_stopped', () => { setCountdown(null); setCountdownActive(false); });

    // Game started
    const offGameStarted = on('game_started', ({ players, currentPlayer, pot }) => {
      setPlayers(players);
      setActivePlayers(players.filter(p => p.status === 'active'));
      setCurrentPlayer(currentPlayer);
      setGame(g => g ? { ...g, pot } : g);
      setCountdownActive(false);
      setTurnSecondsLeft(10);
      setScreen(SCREEN.GAME);
    });

    // Ready system
    const offReadyUpdated = on('ready_updated', ({ readyUserIds }) => {
      setReadyPlayers(readyUserIds);
    });
    const offAllReady = on('all_ready', () => {});

    // FIX #2: turn timer from server
    const offTurnTick = on('turn_timer_tick', ({ secondsLeft }) => setTurnSecondsLeft(secondsLeft));

    // Dice rolled
    const offDiceRolled = on('dice_rolled', ({ userId, firstName, diceResult, isEliminated, remainingPlayers }) => {
      setRolling(false);
      setLastRoll({ userId, firstName, diceResult, isEliminated });
      setActivePlayers(remainingPlayers);
      setPlayers(prev => prev.map(p =>
        p.user_id === userId && isEliminated ? { ...p, status: 'eliminated' } : p
      ));
      // FIX #3: don't clear lastRoll immediately — let it show for 2.5s
    });
    const offRollErr = on('roll_error', ({ error }) => {
      setRolling(false); setRollError(error);
      setTimeout(() => setRollError(null), 3000);
    });

    // Next turn
    const offNextTurn = on('next_turn', ({ currentPlayer, remainingPlayers }) => {
      setCurrentPlayer(currentPlayer);
      setActivePlayers(remainingPlayers);
    });

    // FIX #6: player disconnected during active game
    const offPlayerDisconnected = on('player_disconnected', ({ userId, firstName, secondsLeft }) => {
      setDisconnectedPlayer({ userId, firstName, secondsLeft });
      // If it's ME who disconnected (e.g. navigated away and came back)
      // The server sends this when they reconnect via game_snapshot path
    });
    const offReconnectTick = on('reconnect_tick', ({ userId, secondsLeft }) => {
      setDisconnectedPlayer(d => d?.userId === userId ? { ...d, secondsLeft } : d);
      // If this tick is for ME, update my reconnect countdown
      setMyReconnectSeconds(prev => {
        if (prev !== null) return secondsLeft; // I'm on reconnect screen
        return prev;
      });
    });
    const offPlayerAbandoned = on('player_abandoned', ({ userId, remainingPlayers }) => {
      setDisconnectedPlayer(null);
      setActivePlayers(remainingPlayers);
      setPlayers(prev => prev.map(p => p.user_id === userId ? { ...p, status: 'eliminated' } : p));
      // If it's me, go to result screen
      // (game_over will follow if only 1 left)
    });
    const offPlayerReconnected = on('player_reconnected', ({ userId }) => {
      setDisconnectedPlayer(d => d?.userId === userId ? null : d);
      setMyReconnectSeconds(null);
    });

    // Game over
    const offGameOver = on('game_over', ({ winner, pot, prize, houseCut }) => {
      setGameResult({ winner, pot, prize, houseCut });
      setTimeout(() => setScreen(SCREEN.RESULT), 300);
    });
    const offGameCancelled = on('game_cancelled', ({ reason }) => { setScreen(SCREEN.LOBBY); setJoinError(reason); });

    // Snapshot on reconnect
    const offSnapshot = on('game_snapshot', ({ game, players, activePlayers, currentPlayer, started, turnSecondsLeft, reconnectSecondsLeft }) => {
      setGame(game); setPlayers(players); setActivePlayers(activePlayers); setCurrentPlayer(currentPlayer);
      if (turnSecondsLeft !== undefined) setTurnSecondsLeft(turnSecondsLeft);
      if (started && game.status === 'active') {
        setScreen(SCREEN.GAME);
        // If server says I have an active reconnect window, show it
        if (reconnectSecondsLeft && reconnectSecondsLeft > 0) {
          setMyReconnectSeconds(reconnectSecondsLeft);
        }
      }
      else if (game.status === 'waiting') setScreen(SCREEN.WAITING);
    });

    const offBalance = on('balance_updated', ({ balance }) => setUser(u => u ? { ...u, balance } : u));

    return () => {
      offAuth(); offAuthErr(); offActiveGame(); offNoActiveGame();
      offTimerPaused(); offTimerResumed();
      offJoined(); offJoinErr();
      offPlayerJoined(); offPlayerLeft(); offLeftGame();
      offCountdownStart(); offCountdownTick(); offCountdownStopped();
      offReadyUpdated(); offAllReady();
      offGameStarted(); offTurnTick(); offDiceRolled(); offRollErr();
      offNextTurn(); offPlayerDisconnected(); offReconnectTick();
      offPlayerAbandoned(); offPlayerReconnected();
      offGameOver(); offGameCancelled(); offSnapshot(); offBalance();
    };
  }, [on]);

  // ─── Actions ─────────────────────────────────────────────────────────────────
  const handleJoinGame = useCallback(() => {
    setJoining(true);
    setJoinError(null);
    emit('join_game', { entryFee: selectedFee });
  }, [emit, selectedFee]);

  const handleToggleReady = useCallback(() => {
    emit('toggle_ready');
  }, [emit]);

  const handleRoll = useCallback(() => {
    if (rolling) return;
    setRolling(true);
    setRollError(null);
    emit('roll_dice');
  }, [emit, rolling]);

  const handleLeaveGame = useCallback(() => {
    emit('leave_game');
  }, [emit]);

  const handleReturnToGame = useCallback(() => {
    // Tell server we're back — cancels the abandon timer
    if (game?.room_code) {
      emit('reconnect_game', { roomCode: game.room_code });
    }
    setMyReconnectSeconds(null);
  }, [emit, game]);

  const handleGiveUp = useCallback(() => {
    // Deliberately abandon — server will eliminate via timeout anyway
    setMyReconnectSeconds(null);
    setScreen(SCREEN.RESULT);
    setGameResult(prev => prev ?? { winner: null, pot: game?.pot ?? 0, prize: 0, houseCut: 0 });
  }, [game]);

  const handlePlayAgain = useCallback(() => {
    setGame(null); setPlayers([]); setActivePlayers([]);
    setCurrentPlayer(null); setLastRoll(null); setGameResult(null);
    setCountdown(null); setCountdownActive(false);
    setDisconnectedPlayer(null); setTurnSecondsLeft(10);
    setReadyPlayers([]);
    setScreen(SCREEN.LOBBY);
  }, []);

  // ─── Language switcher overlay (top-right on all screens) ────────────────────
  const LangBar = () => (
    <div style={{
      position: 'fixed', top: 12, right: 12, zIndex: 200,
    }}>
      <LanguageSwitcher lang={lang} onChange={handleLangChange} />
    </div>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (screen === SCREEN.SPLASH) {
    return <><SplashScreen lang={lang} onEnter={() => setScreen(SCREEN.LOBBY)} /><LangBar /></>;
  }

  if (screen === SCREEN.PRIZES) {
    return (
      <>
        <PrizesScreen
          lang={lang}
          user={user}
          onBack={() => setScreen(SCREEN.LOBBY)}
          onBalanceUpdate={(balance) => setUser(u => u ? { ...u, balance } : u)}
        />
        <LangBar />
      </>
    );
  }

  if (screen === SCREEN.LEADERBOARD) {
    return (
      <>
        <LeaderboardScreen
          lang={lang}
          onBack={() => setScreen(SCREEN.LOBBY)}
          myTelegramId={user?.telegram_id}
        />
        <LangBar />
      </>
    );
  }

  if (screen === SCREEN.LOBBY) {
    return (
      <>
        <LobbyScreen
          lang={lang}
          user={user}
          onJoin={handleJoinGame}
          onLeaderboard={() => setScreen(SCREEN.LEADERBOARD)}
          onPrizes={() => setScreen(SCREEN.PRIZES)}
          onBack={() => setScreen(SCREEN.SPLASH)}
          loading={joining}
          error={joinError}
          selectedFee={selectedFee}
          onFeeChange={setSelectedFee}
        />
        <LangBar />
      </>
    );
  }

  if (screen === SCREEN.WAITING) {
    return (
      <>
        <WaitingRoomScreen
          lang={lang}
          game={game}
          players={players}
          myUserId={user?.id}
          countdown={countdown}
          countdownActive={countdownActive}
          onLeave={handleLeaveGame}
          readyPlayers={readyPlayers}
          onToggleReady={handleToggleReady}
        />
        <LangBar />
      </>
    );
  }

  if (screen === SCREEN.GAME) {
    return (
      <>
        <GameScreen
          lang={lang}
          game={game}
          players={players}
          activePlayers={activePlayers}
          currentPlayer={currentPlayer}
          myUserId={user?.id}
          lastRoll={lastRoll}
          onRoll={handleRoll}
          rolling={rolling}
          rollError={rollError}
          turnSecondsLeft={turnSecondsLeft}
          disconnectedPlayer={disconnectedPlayer}
        />
        {myReconnectSeconds !== null && (
          <ReconnectScreen
            lang={lang}
            secondsLeft={myReconnectSeconds}
            onReturn={handleReturnToGame}
            onGiveUp={handleGiveUp}
          />
        )}
        <LangBar />
      </>
    );
  }

  if (screen === SCREEN.RESULT) {
    return (
      <>
        <ResultScreen
          lang={lang}
          winner={gameResult?.winner}
          pot={gameResult?.pot}
          prize={gameResult?.prize}
          houseCut={gameResult?.houseCut}
          myUserId={user?.id}
          onPlayAgain={handlePlayAgain}
          onLeaderboard={() => setScreen(SCREEN.LEADERBOARD)}
        />
        <LangBar />
      </>
    );
  }

  return null;
}
