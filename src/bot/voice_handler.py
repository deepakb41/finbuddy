"""
Handle Telegram voice notes:
  voice note → download → Whisper transcription → parse → confirm with inline keyboard
"""
from __future__ import annotations

import io
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from src.llm.client import get_client
from api.routers.voice import parse_voice_text


async def handle_voice_note(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Download voice note, transcribe with Whisper, parse, ask user to confirm."""
    msg = update.message
    if not msg or not msg.voice:
        return

    await msg.reply_text("🎤 Transcribing your voice note…")

    # Download audio
    voice_file = await context.bot.get_file(msg.voice.file_id)
    buf = io.BytesIO()
    await voice_file.download_to_memory(buf)
    buf.seek(0)

    # Whisper transcription
    try:
        client = get_client()
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=("voice.ogg", buf),
        )
        text = transcript.text
    except Exception as e:
        await msg.reply_text(f"❌ Transcription failed: {e}")
        return

    # Parse
    parsed = parse_voice_text(text)

    if not parsed.amount and not parsed.merchant:
        await msg.reply_text(
            f"🤔 I heard: *\"{text}\"*\n\nCouldn't extract a transaction. Try: `250 Swiggy lunch`",
            parse_mode="Markdown",
        )
        return

    # Store pending in context
    context.user_data["pending_tx"] = {
        "amount": parsed.amount,
        "merchant_raw": parsed.merchant or "Unknown",
        "tx_type": parsed.tx_type,
        "notes": parsed.notes or "",
        "date": __import__("datetime").date.today().isoformat(),
        "currency": "INR",
    }

    amt = f"₹{parsed.amount:,.0f}" if parsed.amount else "?"
    summary = (
        f"*{parsed.tx_type.upper()}* | {amt}\n"
        f"Merchant: {parsed.merchant or '?'}\n"
        f"Notes: {parsed.notes or '—'}\n\n"
        f"_Heard: \"{text}\"_"
    )

    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Save", callback_data="voice_save"),
            InlineKeyboardButton("✏️ Edit", callback_data="voice_edit"),
            InlineKeyboardButton("✗ Cancel", callback_data="voice_cancel"),
        ]
    ])
    await msg.reply_text(summary, parse_mode="Markdown", reply_markup=keyboard)


async def handle_voice_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle inline button responses for voice confirmation."""
    query = update.callback_query
    if not query:
        return
    await query.answer()

    action = query.data
    pending = context.user_data.get("pending_tx")

    if action == "voice_save" and pending:
        try:
            from src.data.pipeline import ingest_from_form
            tx_id = ingest_from_form(
                date=pending["date"],
                merchant_raw=pending["merchant_raw"],
                amount=pending["amount"],
                currency=pending.get("currency", "INR"),
                tx_type=pending["tx_type"],
                notes=pending["notes"],
                category="",
            )
            context.user_data.pop("pending_tx", None)
            await query.edit_message_text(
                f"✅ Saved! `{tx_id[:12]}…`\n"
                f"{pending['tx_type'].upper()} ₹{pending['amount']:,.0f} at {pending['merchant_raw']}",
                parse_mode="Markdown",
            )
        except Exception as e:
            await query.edit_message_text(f"❌ Failed to save: {e}")

    elif action == "voice_edit":
        await query.edit_message_text(
            "✏️ Send the transaction in text format:\n`/add 250 Swiggy lunch`",
            parse_mode="Markdown",
        )

    elif action == "voice_cancel":
        context.user_data.pop("pending_tx", None)
        await query.edit_message_text("Cancelled.")
