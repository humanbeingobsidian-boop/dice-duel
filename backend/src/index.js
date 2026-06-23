// backend/src/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const createApiRouter = require('./routes/api');
const createProfileRouter = require('./routes/profile');
const setupSocket = require('./socket/socketHandler');
const { startBot } = require('./bot');

const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: [FRONTEND_URL, /\.vercel\.app$/, /\.ngrok\.io$/],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [FRONTEND_URL, /\.vercel\.app$/, /\.ngrok\.io$/],
  credentials: true,
}));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', createApiRouter(io));
app.use('/api', createProfileRouter());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    devMode: process.env.DEV_MODE === 'true',
    timestamp: new Date().toISOString(),
  });
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
setupSocket(io);

// ─── Userbot (Python/Pyrogram) ────────────────────────────────────────────────
function startUserbot() {
  if (!process.env.TELEGRAM_SESSION) {
    console.log('ℹ️  TELEGRAM_SESSION not set — userbot not started');
    return;
  }

  const userbotPath = path.join(__dirname, 'userbot/userbot.py');
  const proc = spawn('python3', [userbotPath], {
    env: process.env,
    stdio: 'inherit',
  });

  proc.on('error', (err) => {
    console.warn('⚠️  Userbot process error:', err.message);
  });

  proc.on('exit', (code) => {
    if (code !== 0) {
      console.warn(`⚠️  Userbot exited (code ${code}) — restarting in 15s`);
      setTimeout(startUserbot, 15000);
    }
  });

  console.log('🤖 Userbot process started');
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Dice Duel backend running on port ${PORT}`);
  console.log(`   Dev mode: ${process.env.DEV_MODE === 'true' ? '✅ ON' : '❌ OFF'}`);
  console.log(`   Frontend: ${FRONTEND_URL}`);
  startBot();
  startUserbot();
});
