#!/usr/bin/env python
"""
Run the FinBuddy Telegram bot.

Usage:
  source .venv/bin/activate
  python scripts/run_bot.py
"""
import logging
import sys
from pathlib import Path

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters

from src.config import settings
from src.bot.telegram_handler import (
    cmd_start,
    cmd_add,
    cmd_recent,
    cmd_summary,
    cmd_undo,
    handle_forwarded_message,
)
from src.bot.voice_handler import handle_voice_note, handle_voice_callback

logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    level=logging.INFO,
)

def main():
    token = settings.telegram_bot_token
    if not token:
        print("❌ TELEGRAM_BOT_TOKEN not set in .env")
        sys.exit(1)

    app = Application.builder().token(token).build()

    # Commands
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help",  cmd_start))
    app.add_handler(CommandHandler("add",   cmd_add))
    app.add_handler(CommandHandler("recent",cmd_recent))
    app.add_handler(CommandHandler("summary",cmd_summary))
    app.add_handler(CommandHandler("undo",  cmd_undo))

    # Voice notes
    app.add_handler(MessageHandler(filters.VOICE, handle_voice_note))
    app.add_handler(CallbackQueryHandler(handle_voice_callback, pattern="^voice_"))

    # Plain text — try to parse as UPI/bank SMS
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_forwarded_message))

    print("🤖 FinBuddy bot is running. Press Ctrl+C to stop.")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
