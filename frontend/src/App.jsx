// frontend/src/App.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
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

  const authenticatedRef = useRef(false);

  // ─── Initial setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    expandApp();
  }, []);

  // ─── Authenticate when connected ────────────────────────────────────────────
  useEffect(() => {
    if (!connected) return;
    if (authenticatedRef.current) return;

    const initData = getInitData();
    emit('authenticate', { initData });
  }, [connected, emit]);

  // ─── Socket event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    // Auth success
    const offAuth = on('authenticated', ({ user }) => {
      setUser(user);
      authenticatedRef.current = true;
    });

    const offAuthErr = on('auth_error', ({ error }) => {
      console.error('Auth error:', error);
    });

    // Joined game
    const offJoined = on('joined_game', ({ game, players, user: updatedUser, roomCode }) => {
      setGame(game);
      setPlayers(players);
      setActivePlayers(players.filter(p => p.status === 'active'));
      if (updatedUser) setUser(updatedUser);
      setJoining(false);
      setJoinError(null);
      setScreen(SCREEN.WAITING);
    });

    const offJoinErr = on('join_error', ({ error }) => {
      setJoining(false);
      setJoinError(error);
    });

    // Player joined the room
    const offPlayerJoined = on('player_joined', ({ players, pot }) => {
      setPlayers(players);
      setActivePlayers(players.filter(p => p.status === 'active'));
      setGame(g => g ? { ...g, pot } : g);
    });

    // Countdown
    const offCountdownStart = on('countdown_started', ({ secondsLeft }) => {
      setCountdown(secondsLeft);
      setCountdownActive(true);
    });
    const offCountdownTick = on('countdown_tick', ({ secondsLeft }) => {
      setCountdown(secondsLeft);
    });

    // Game started
    const offGameStarted = on('game_started', ({ players, currentPlayer, pot }) => {
      setPlayers(players);
      setActivePlayers(players.filter(p => p.status === 'active'));
      setCurrentPlayer(currentPlayer);
      setGame(g => g ? { ...g, pot } : g);
      setCountdownActive(false);
      setScreen(SCREEN.GAME);
    });

    // Dice rolled
    const offDiceRolled = on('dice_rolled', ({ userId, telegramId, firstName, diceResult, isEliminated, remainingPlayers }) => {
      setRolling(false);
      setLastRoll({ userId, firstName, diceResult, isEliminated });
      setActivePlayers(remainingPlayers);
      setPlayers(prev => prev.map(p =>
        p.user_id === userId && isEliminated
          ? { ...p, status: 'eliminated' }
          : p
      ));
    });

    const offRollErr = on('roll_error', ({ error }) => {
      setRolling(false);
      setRollError(error);
      setTimeout(() => setRollError(null), 3000);
    });

    // Next turn
    const offNextTurn = on('next_turn', ({ currentPlayer, remainingPlayers }) => {
      setCurrentPlayer(currentPlayer);
      setActivePlayers(remainingPlayers);
    });

    // Game over
    const offGameOver = on('game_over', ({ winner, pot, prize, houseCut }) => {
      setGameResult({ winner, pot, prize, houseCut });
      setScreen(SCREEN.RESULT);
    });

    const offGameCancelled = on('game_cancelled', ({ reason }) => {
      setScreen(SCREEN.LOBBY);
      setJoinError(reason);
    });

    // Snapshot (reconnect)
    const offSnapshot = on('game_snapshot', ({ game, players, activePlayers, currentPlayer, started }) => {
      setGame(game);
      setPlayers(players);
      setActivePlayers(activePlayers);
      setCurrentPlayer(currentPlayer);
      if (started && game.status === 'active') {
        setScreen(SCREEN.GAME);
      } else if (game.status === 'waiting') {
        setScreen(SCREEN.WAITING);
      }
    });

    // Balance updated
    const offBalance = on('balance_updated', ({ balance }) => {
      setUser(u => u ? { ...u, balance } : u);
    });

    return () => {
      offAuth(); offAuthErr(); offJoined(); offJoinErr();
      offPlayerJoined(); offCountdownStart(); offCountdownTick();
      offGameStarted(); offDiceRolled(); offRollErr();
      offNextTurn(); offGameOver(); offGameCancelled();
      offSnapshot(); offBalance();
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

  const handlePlayAgain = useCallback(() => {
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
