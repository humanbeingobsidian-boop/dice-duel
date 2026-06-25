// backend/src/db/gameFinalizers.js
// Centralizes no-human-winner finalization so every real participant gets a played game
// counted even when the game ends in a draw, no active players remain, or only a bot survives.

const queries = require('./queries');
const { db, getGamePlayers } = queries;

function finalizeGameWithoutWinnerTransaction(gameId) {
  return db.transaction((id) => {
    const game = db.prepare(`SELECT status FROM games WHERE id = ?`).get(id);
    if (!game || game.status === 'finished') return false;

    originalUpdateGameStatusRun({ status: 'finished', id });

    const allPlayers = getGamePlayers.all(id);
    for (const p of allPlayers) {
      db.prepare(`
        UPDATE users SET
          total_games = total_games + 1,
          total_wins = total_wins + 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(p.user_id);
    }

    return true;
  })(gameId);
}

const originalUpdateGameStatusRun = queries.updateGameStatus.run.bind(queries.updateGameStatus);
let patched = false;

function installGameFinalizers() {
  if (patched) return;
  patched = true;

  queries.finalizeGameWithoutWinnerTransaction = finalizeGameWithoutWinnerTransaction;

  queries.updateGameStatus.run = (params) => {
    if (params?.status === 'finished' && params?.id) {
      return { changes: finalizeGameWithoutWinnerTransaction(params.id) ? 1 : 0 };
    }
    return originalUpdateGameStatusRun(params);
  };
}

module.exports = {
  installGameFinalizers,
  finalizeGameWithoutWinnerTransaction,
};
