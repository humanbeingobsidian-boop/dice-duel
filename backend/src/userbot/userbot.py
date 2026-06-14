# backend/src/userbot/userbot.py
import os
import asyncio
from pyrogram import Client, filters

API_ID  = int(os.environ.get("TELEGRAM_API_ID", "0"))
API_HASH = os.environ.get("TELEGRAM_API_HASH", "")
SESSION  = os.environ.get("TELEGRAM_SESSION", "")
BOT_ID   = int(os.environ.get("BOT_TELEGRAM_ID", "0"))

if not all([API_ID, API_HASH, SESSION]):
    print("⚠️  Userbot env vars not set — skipping")
    exit(0)

app = Client(
    name="userbot",
    api_id=API_ID,
    api_hash=API_HASH,
    session_string=SESSION,
)

@app.on_message(filters.user(BOT_ID) & filters.private)
async def handle_bot_message(client, message):
    text = message.text or ""

    if not text.startswith("PRIZE_ORDER|"):
        return

    parts = text.split("|")
    if len(parts) < 4:
        return

    user_id    = parts[1]
    prize_label = parts[2]
    order_id   = parts[3]

    print(f"📦 Prize order: user={user_id} prize={prize_label} order={order_id}")

    try:
        await client.send_message(
            int(user_id),
            f"🎁 *הפרס שלך בדרך!*\n\n"
            f"פרס: {prize_label}\n"
            f"מספר הזמנה: #{order_id}\n\n"
            f"הפרס יישלח אליך תוך זמן קצר. 📬",
            parse_mode="markdown"
        )
        print(f"✅ Notified user {user_id}")
    except Exception as e:
        print(f"❌ Failed to notify user {user_id}: {e}")

async def main():
    print("🤖 Userbot starting...")
    await app.start()
    print("✅ Userbot connected!")
    await asyncio.Event().wait()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
