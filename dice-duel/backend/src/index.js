// backend/src/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const apiRoutes = require('./routes/api');
const setupSocket = require('./socket/socketHandler');

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

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: [FRONTEND_URL, /\.vercel\.app$/, /\.ngrok\.io$/],
  credentials: true,
}));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    devMode: process.env.DEV_MODE === 'true',
    timestamp: new Date().toISOString(),
  });
});

// ─── Socket.IO ───────────────────────────────────────────────────────────────
setupSocket(io);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Dice Duel backend running on port ${PORT}`);
  console.log(`   Dev mode: ${process.env.DEV_MODE === 'true' ? '✅ ON' : '❌ OFF'}`);
  console.log(`   Frontend: ${FRONTEND_URL}`);
});
