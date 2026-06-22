# backend/src/userbot/userbot.py
import os
import asyncio
from aiohttp import web
from pyrogram import Client

API_ID   = int(os.environ.get("TELEGRAM_API_ID", "0"))
API_HASH = os.environ.get("TELEGRAM_API_HASH", "")
SESSION  = os.environ.get("TELEGRAM_SESSION", "")
SECRET   = os.environ.get("USERBOT_SECRET", "userbot_secret")
PORT     = int(os.environ.get("USERBOT_PORT", "3002"))

# Optional profile settings for the Telegram user account that sends prize messages.
# Set these in Render Environment Variables. USERBOT_USERNAME must be without @.
USERBOT_FIRST_NAME = os.environ.get("USERBOT_FIRST_NAME", "Dice Duel").strip()
USERBOT_LAST_NAME  = os.environ.get("USERBOT_LAST_NAME", "Prizes").strip()
USERBOT_USERNAME   = os.environ.get("USERBOT_USERNAME", "DiceDuelPrizes").strip().lstrip("@")

if not all([API_ID, API_HASH, SESSION]):
    print("⚠️  Userbot env vars not set — skipping")
    exit(0)

app_tg = Client(
    name="userbot",
    api_id=API_ID,
    api_hash=API_HASH,
    session_string=SESSION,
)

async def sync_userbot_profile():
    """Update the Telegram account profile from environment variables.

    This changes the real Telegram account connected by TELEGRAM_SESSION.
    Telegram may reject unavailable usernames, invalid usernames, or frequent changes.
    """
    me = await app_tg.get_me()

    if USERBOT_FIRST_NAME or USERBOT_LAST_NAME:
        try:
            await app_tg.update_profile(
                first_name=USERBOT_FIRST_NAME or me.first_name or "Dice Duel",
                last_name=USERBOT_LAST_NAME or "",
            )
            print(f"✅ Userbot display name set to: {USERBOT_FIRST_NAME or me.first_name} {USERBOT_LAST_NAME}".strip())
        except Exception as e:
            print(f"⚠️  Failed to update userbot display name: {e}")

    if USERBOT_USERNAME and USERBOT_USERNAME != (me.username or ""):
        try:
            await app_tg.set_username(USERBOT_USERNAME)
            print(f"✅ Userbot username set to: @{USERBOT_USERNAME}")
        except Exception as e:
            print(f"⚠️  Failed to update userbot username @{USERBOT_USERNAME}: {e}")

# ─── HTTP endpoint שה-backend קורא לו ──────────────────────────────────────
async def send_prize(request):
    # אימות
    auth = request.headers.get("X-Userbot-Secret", "")
    if auth != SECRET:
        return web.json_response({"error": "Unauthorized"}, status=401)

    data = await request.json()
    user_id     = data.get("user_id")
    prize_label = data.get("prize_label")
    order_id    = data.get("order_id")

    if not all([user_id, prize_label, order_id]):
        return web.json_response({"error": "Missing fields"}, status=400)

    print(f"📦 Sending prize notification: user={user_id} prize={prize_label} order=#{order_id}")

    try:
        await app_tg.send_message(
            int(user_id),
            f"🎁 **הפרס שלך התקבל!**\n\n"
            f"📋 **מה רכשת:** {prize_label}\n"
            f"🆔 **מספר הזמנה:** #{order_id}\n\n"
            f"⏳ הפרס יישלח אליך בקרוב.\n"
            f"תקבל הודעה נוספת ברגע שהפרס נשלח ✅"
        )
        print(f"✅ Sent to user {user_id}")
        return web.json_response({"success": True})
    except Exception as e:
        print(f"❌ Failed to send to user {user_id}: {e}")
        return web.json_response({"error": str(e)}, status=500)

async def health(request):
    return web.json_response({"status": "ok"})

async def main():
    print("🤖 Userbot starting...")
    await app_tg.start()
    await sync_userbot_profile()
    me = await app_tg.get_me()
    username = f"@{me.username}" if me.username else "no username"
    print(f"✅ Userbot connected as: {me.first_name} ({username}, ID: {me.id})")

    # הפעל HTTP server
    web_app = web.Application()
    web_app.router.add_post("/send-prize", send_prize)
    web_app.router.add_get("/health", health)

    runner = web.AppRunner(web_app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    await site.start()
    print(f"🌐 Userbot HTTP server on port {PORT}")

    await asyncio.Event().wait()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
