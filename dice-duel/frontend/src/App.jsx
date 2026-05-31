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

// Screens
const SCREEN = {
  SPLASH: 'splash',
  LOBBY: 'lobby',
  WAITING: 'waiting',
  GAME: 'game',
  RESULT: 'result',
  LEADERBOARD: 'leaderboard',
};

export default function App() {
  const { emit, on, off, connected } = useSocket();

  // App state
  const [screen, setScreen] = useState(SCREEN.SPLASH);
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
  const [disconnectedPlayer, setDisconnectedPlayer] = useState(null); // { userId, firstName, secondsLeft }

  // ─── Initial setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    expandApp();
  }, []);

  // ─── Authenticate whenever we connect (or reconnect) ───────────────────────
  useEffect(() => {
    if (!connected) return;
    const initData = getInitData();
    emit('authenticate', { initData });
  }, [connected, emit]);

  // ─── Socket event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const offAuth = on('authenticated', ({ user }) => setUser(user));
    const offAuthErr = on('auth_error', ({ error }) => console.error('Auth error:', error));

    // Joined waiting room
    const offJoined = on('joined_game', ({ game, players, user: updatedUser }) => {
      setGame(game);
      setPlayers(players);
      setActivePlayers(players.filter(p => p.status === 'active'));
      if (updatedUser) setUser(updatedUser);
      setJoining(false);
      setJoinError(null);
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
    const offLeftGame = on('left_game', ({ refunded }) => {
      setGame(null); setPlayers([]); setActivePlayers([]);
      setCountdown(null); setCountdownActive(false);
      setUser(u => u ? { ...u, balance: (u.balance ?? 0) + refunded } : u);
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
    });
    const offReconnectTick = on('reconnect_tick', ({ userId, secondsLeft }) => {
      setDisconnectedPlayer(d => d?.userId === userId ? { ...d, secondsLeft } : d);
    });
    const offPlayerAbandoned = on('player_abandoned', ({ userId, firstName, remainingPlayers }) => {
      setDisconnectedPlayer(null);
      setActivePlayers(remainingPlayers);
      setPlayers(prev => prev.map(p => p.user_id === userId ? { ...p, status: 'eliminated' } : p));
    });
    const offPlayerReconnected = on('player_reconnected', ({ userId }) => {
      setDisconnectedPlayer(d => d?.userId === userId ? null : d);
    });

    // Game over
    const offGameOver = on('game_over', ({ winner, pot, prize, houseCut }) => {
      setGameResult({ winner, pot, prize, houseCut });
      setTimeout(() => setScreen(SCREEN.RESULT), 300);
    });
    const offGameCancelled = on('game_cancelled', ({ reason }) => { setScreen(SCREEN.LOBBY); setJoinError(reason); });

    // Snapshot on reconnect
    const offSnapshot = on('game_snapshot', ({ game, players, activePlayers, currentPlayer, started, turnSecondsLeft }) => {
      setGame(game); setPlayers(players); setActivePlayers(activePlayers); setCurrentPlayer(currentPlayer);
      if (turnSecondsLeft !== undefined) setTurnSecondsLeft(turnSecondsLeft);
      if (started && game.status === 'active') setScreen(SCREEN.GAME);
      else if (game.status === 'waiting') setScreen(SCREEN.WAITING);
    });

    const offBalance = on('balance_updated', ({ balance }) => setUser(u => u ? { ...u, balance } : u));

    return () => {
      offAuth(); offAuthErr(); offJoined(); offJoinErr();
      offPlayerJoined(); offPlayerLeft(); offLeftGame();
      offCountdownStart(); offCountdownTick(); offCountdownStopped();
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
    emit('join_game');
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
    setGame(null);
    setPlayers([]);
    setActivePlayers([]);
    setCurrentPlayer(null);
    setLastRoll(null);
    setGameResult(null);
    setCountdown(null);
    setCountdownActive(false);
    setScreen(SCREEN.LOBBY);
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (screen === SCREEN.SPLASH) {
    return <SplashScreen onEnter={() => setScreen(SCREEN.LOBBY)} />;
  }

  if (screen === SCREEN.LEADERBOARD) {
    return (
      <LeaderboardScreen
        onBack={() => setScreen(SCREEN.LOBBY)}
        myTelegramId={user?.telegram_id}
      />
    );
  }

  if (screen === SCREEN.LOBBY) {
    return (
      <LobbyScreen
        user={user}
        onJoin={handleJoinGame}
        onLeaderboard={() => setScreen(SCREEN.LEADERBOARD)}
        onBack={() => setScreen(SCREEN.SPLASH)}
        loading={joining}
        error={joinError}
      />
    );
  }

  if (screen === SCREEN.WAITING) {
    return (
      <WaitingRoomScreen
        game={game}
        players={players}
        myUserId={user?.id}
        countdown={countdown}
        countdownActive={countdownActive}
        onLeave={handleLeaveGame}
      />
    );
  }

  if (screen === SCREEN.GAME) {
    return (
      <GameScreen
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
    );
  }

  if (screen === SCREEN.RESULT) {
    return (
      <ResultScreen
        winner={gameResult?.winner}
        pot={gameResult?.pot}
        prize={gameResult?.prize}
        houseCut={gameResult?.houseCut}
        myUserId={user?.id}
        onPlayAgain={handlePlayAgain}
        onLeaderboard={() => setScreen(SCREEN.LEADERBOARD)}
      />
    );
  }

  return null;
}
