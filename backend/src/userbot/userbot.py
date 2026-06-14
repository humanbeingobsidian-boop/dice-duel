# backend/src/userbot/userbot.py
# Userbot שמאזין להודעות מהבוט ושולח פרסים למשתמשים

import os
import asyncio
from pyrogram import Client, filters
from pyrogram.types import Message

API_ID   = int(os.environ.get("TELEGRAM_API_ID", "0"))
API_HASH = os.environ.get("TELEGRAM_API_HASH", "")
SESSION  = os.environ.get("TELEGRAM_SESSION", "")
BOT_ID   = int(os.environ.get("BOT_TELEGRAM_ID", "0"))  # ה-ID של הבוט שלך

if not all([API_ID, API_HASH, SESSION]):
    print("⚠️  Userbot env vars not set — skipping")
    exit(0)

app = Client(
    name="userbot",
    api_id=API_ID,
    api_hash=API_HASH,
    session_string=SESSION,
)

# ─── מאזין להודעות מהבוט ─────────────────────────────────────────────────────
@app.on_message(filters.user(BOT_ID) & filters.private)
async def handle_bot_message(client: Client, message: Message):
    text = message.text or ""

    # הבוט שולח הודעה בפורמט:
    # PRIZE_ORDER|user_id|prize_label|order_id
    if not text.startswith("PRIZE_ORDER|"):
        return

    parts = text.split("|")
    if len(parts) < 4:
        return

    _, user_id, prize_label, order_id = parts[0], parts[1], parts[2], parts[3]

    print(f"📦 Prize order received: user={user_id} prize={prize_label} order={order_id}")

    try:
        # שלח הודעה למשתמש
        await client.send_message(
            int(user_id),
            f"🎁 *הפרס שלך בדרך!*\n\n"
            f"פרס: {prize_label}\n"
            f"מספר הזמנה: #{order_id}\n\n"
            f"הפרס יישלח אליך תוך זמן קצר. 📬",
            parse_mode="markdown"
        )
        print(f"✅ Sent prize notification to user {user_id}")
    except Exception as e:
        print(f"❌ Failed to notify user {user_id}: {e}")

# ─── הפעלה ───────────────────────────────────────────────────────────────────
print("🤖 Userbot starting...")
app.run()
