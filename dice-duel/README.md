# 🎲 Dice Duel — Telegram Mini App

משחק קוביות מולטיפלייר בזמן אמת ל-Telegram Mini App.

---

## ארכיטקטורת הפרויקט

```
dice-duel/
├── frontend/          # React + Vite (Telegram Mini App)
│   ├── src/
│   │   ├── screens/   # מסכי האפליקציה
│   │   │   ├── SplashScreen.jsx      # מסך פתיחה
│   │   │   ├── LobbyScreen.jsx       # לובי + הצטרפות למשחק
│   │   │   ├── WaitingRoomScreen.jsx # חדר המתנה + טיימר
│   │   │   ├── GameScreen.jsx        # מסך משחק פעיל
│   │   │   ├── ResultScreen.jsx      # ניצחון/הפסד
│   │   │   └── LeaderboardScreen.jsx # לוח מצטיינים
│   │   ├── components/
│   │   │   └── Dice.jsx              # קובייה אנימציה
│   │   ├── hooks/
│   │   │   └── useSocket.js          # WebSocket hook
│   │   ├── utils/
│   │   │   └── telegram.js           # Telegram WebApp SDK
│   │   ├── App.jsx                   # ניהול state מרכזי
│   │   └── index.css
│   ├── vercel.json
│   └── package.json
│
├── backend/           # Node.js + Express + Socket.IO
│   ├── src/
│   │   ├── db/
│   │   │   └── queries.js            # SQLite queries + transactions
│   │   ├── middleware/
│   │   │   └── telegramAuth.js       # אימות Telegram initData
│   │   ├── routes/
│   │   │   └── api.js                # REST endpoints
│   │   ├── socket/
│   │   │   ├── socketHandler.js      # Socket.IO events
│   │   │   └── roomManager.js        # לוגיקת משחק (server-side)
│   │   └── index.js
│   ├── render.yaml
│   └── package.json
│
└── bot/               # Telegram Bot (grammY)
    ├── src/
    │   └── bot.js
    └── package.json
```

---

## סכמת Database (SQLite)

```sql
-- שחקנים
users (id, telegram_id, username, first_name, balance, total_games, total_wins, created_at)

-- משחקים
games (id, room_code, status, entry_fee, house_fee_percent, pot, max_players, winner_user_id, created_at, started_at, finished_at)

-- שחקנים במשחק
game_players (id, game_id, user_id, status, seat_order, joined_at, eliminated_at)

-- תורות
turns (id, game_id, user_id, dice_result, was_eliminated, created_at)
```

---

## הרצה מקומית

### 1. Clone ו-Setup

```bash
git clone <your-repo>
cd dice-duel
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# ערוך .env - DEV_MODE=true לפיתוח
npm run dev
# רץ על http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# VITE_BACKEND_URL=http://localhost:3001
npm run dev
# רץ על http://localhost:5173
```

### 4. Bot (אופציונלי בשלב פיתוח)

```bash
cd bot
npm install
cp .env.example .env
# הכנס BOT_TOKEN + MINI_APP_URL
npm run dev
```

### בדיקה ב-Browser (בלי Telegram)

פתח `http://localhost:5173` — DEV_MODE=true יצור משתמשי mock אוטומטית.

לפתיחת מספר חלונות עם שחקנים שונים, פתח בחלונות incognito שונים.

---

## Deploy לייצור

### Frontend → Vercel

```bash
cd frontend

# התקן Vercel CLI
npm i -g vercel

# Deploy
vercel

# הגדר Environment Variable:
# VITE_BACKEND_URL = https://your-backend.onrender.com
```

דומיין חינמי: `https://your-game.vercel.app`

### Backend → Render

1. לך ל-[render.com](https://render.com)
2. New → Web Service
3. חבר Git repo, בחר תיקיית `backend`
4. Build: `npm install`
5. Start: `npm start`
6. הגדר Environment Variables:
   ```
   PORT=3001
   DEV_MODE=false
   BOT_TOKEN=<your bot token>
   FRONTEND_URL=https://your-game.vercel.app
   DB_PATH=/opt/render/project/src/data/dice_duel.db
   ```

> **חשוב:** Render מוחק קבצים ב-redeploy. לייצור אמיתי, עבור ל-PostgreSQL (Supabase/Neon).

### Bot

```bash
cd bot
# הגדר .env עם BOT_TOKEN ו-MINI_APP_URL
npm start
```

ניתן להריץ הבוט בכל שרת (Railway, VPS, וכו').

---

## חיבור Mini App לבוט ב-Telegram

### 1. צור בוט עם BotFather

```
/newbot
# תן שם לבוט
# קבל BOT_TOKEN
```

### 2. הגדר Mini App

```
/newapp
# בחר את הבוט שלך
# הגדר:
#   Title: Dice Duel
#   Description: משחק קוביות מולטיפלייר
#   URL: https://your-game.vercel.app
```

### 3. הגדר כפתור Menu

```
/setmenubutton
# בחר את הבוט
# הגדר URL: https://your-game.vercel.app
# טקסט: 🎲 שחק
```

### 4. וידוא HTTPS

Telegram Mini Apps **חייבים** HTTPS.  
Vercel מספק זאת אוטומטית.

---

## אבטחה

| מה | איפה מחושב |
|----|------------|
| תוצאת קובייה | ✅ שרת בלבד |
| מי מנצח | ✅ שרת בלבד |
| עדכון יתרה | ✅ שרת בלבד |
| אימות משתמש | ✅ Telegram initData |
| מניעת כניסה כפולה | ✅ DB UNIQUE constraint |
| מצב משחק | ✅ נשמר בשרת |

---

## הוספת Telegram Stars (שלב הבא)

1. הפעל Bot Payments עם BotFather: `/mybots → Payments`
2. בבוט, שלח `sendInvoice` עם `currency: "XTR"` ו-`prices: [{ amount: 100 }]`
3. קבל `successful_payment` webhook → רק אז הכנס שחקן לחדר
4. עדכן `DEV_MODE=false` ב-backend

---

## Socket.IO Events

### Client → Server
| Event | Data | תיאור |
|-------|------|--------|
| `authenticate` | `{ initData }` | אימות Telegram |
| `join_game` | — | הצטרף למשחק |
| `roll_dice` | — | זרוק קובייה |
| `reconnect_game` | `{ roomCode }` | חיבור מחדש |

### Server → Client
| Event | Data | תיאור |
|-------|------|--------|
| `authenticated` | `{ user }` | אימות הצליח |
| `joined_game` | `{ game, players, user, roomCode }` | נכנסת לחדר |
| `player_joined` | `{ players, pot }` | שחקן נוסף הצטרף |
| `countdown_started` | `{ secondsLeft }` | הטיימר התחיל |
| `countdown_tick` | `{ secondsLeft }` | עדכון טיימר |
| `game_started` | `{ players, currentPlayer, pot }` | המשחק התחיל |
| `dice_rolled` | `{ userId, diceResult, isEliminated, remainingPlayers }` | קובייה נזרקה |
| `next_turn` | `{ currentPlayer, remainingPlayers }` | תור הבא |
| `game_over` | `{ winner, pot, prize, houseCut }` | סוף המשחק |
| `balance_updated` | `{ balance }` | יתרה עודכנה |

---

## טכנולוגיות

- **Frontend:** React 18, Vite, Socket.IO Client
- **Backend:** Node.js, Express, Socket.IO, better-sqlite3
- **Bot:** grammY
- **DB:** SQLite (dev) → PostgreSQL (prod)
- **Deploy:** Vercel (frontend) + Render (backend)
"# dice-duel" 
