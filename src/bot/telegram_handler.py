"""
Telegram bot command and message handlers.
"""
from __future__ import annotations

from telegram import Update
from telegram.ext import ContextTypes

from src.bot.message_parser import parse_add_command, parse_upi_message
from src.data.pipeline import ingest_from_form
from src.insights.summaries import recent_transactions, total_spend, monthly_trend


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "👋 *Welcome to FinBuddy!*\n\n"
        "Commands:\n"
        "• `/add 250 Swiggy lunch` — log expense\n"
        "• `/add +50000 salary` — log income\n"
        "• `/recent` — last 5 transactions\n"
        "• `/summary` — this month's spending\n"
        "• `/undo` — delete last transaction\n\n"
        "Or forward a UPI / bank SMS and I'll parse it automatically!\n"
        "You can also send a 🎤 voice note.",
        parse_mode="Markdown",
    )


async def cmd_add(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    args = " ".join(context.args or [])
    tx = parse_add_command(args)

    if not tx:
        await update.message.reply_text(
            "❓ Usage: `/add 250 Swiggy lunch` or `/add +50000 salary`",
            parse_mode="Markdown",
        )
        return

    try:
        tx_id = ingest_from_form(
            date=tx["date"],
            merchant_raw=tx["merchant_raw"],
            amount=tx["amount"],
            currency=tx.get("currency", "INR"),
            tx_type=tx["tx_type"],
            notes=tx.get("notes", ""),
            category="",
        )
        # Store last added for /undo
        context.user_data["last_tx_id"] = tx_id

        symbol = "₹" if tx.get("currency") == "INR" else "£"
        await update.message.reply_text(
            f"✅ *{tx['tx_type'].capitalize()}* logged!\n"
            f"{symbol}{tx['amount']:,.0f} at *{tx['merchant_raw']}*"
            + (f"\n📝 {tx['notes']}" if tx.get("notes") else ""),
            parse_mode="Markdown",
        )
    except Exception as e:
        await update.message.reply_text(f"❌ Failed to save: {e}")


async def cmd_recent(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    rows = recent_transactions(limit=5)
    active = [r for r in rows if r[9] != "deleted"]

    if not active:
        await update.message.reply_text("No transactions found.")
        return

    lines = ["*Last 5 transactions:*\n"]
    for r in active:
        merchant = r[3] or r[2]
        date = str(r[1])[:10]
        amount = float(r[4])
        tx_type = r[6]
        cat = r[7] or "—"
        symbol = "₹" if r[5] == "INR" else "£"
        lines.append(f"• {date} | {merchant} | {symbol}{amount:,.0f} | {cat}")

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def cmd_summary(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    row = total_spend()
    expense = float(row[0] or 0)
    income = float(row[1] or 0)
    tx_count = int(row[2] or 0)

    trend = monthly_trend(n_months=1)
    cat_lines = []
    for r in sorted(trend, key=lambda x: -float(x[2]))[:6]:
        cat_lines.append(f"  • {r[1]}: ₹{float(r[2]):,.0f}")

    msg = (
        f"📊 *This month's summary:*\n\n"
        f"💸 Spent: ₹{expense:,.0f}\n"
        f"💰 Income: ₹{income:,.0f}\n"
        f"🔢 Transactions: {tx_count}\n\n"
    )
    if cat_lines:
        msg += "*By category:*\n" + "\n".join(cat_lines)

    await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_undo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    tx_id = context.user_data.get("last_tx_id")
    if not tx_id:
        await update.message.reply_text("Nothing to undo.")
        return

    try:
        from sqlalchemy import select
        from src.data.db import SessionLocal
        from src.data.models import Transaction

        with SessionLocal() as session:
            tx = session.execute(
                select(Transaction).where(Transaction.transaction_id == tx_id)
            ).scalar_one_or_none()
            if tx:
                tx.status = "deleted"
                session.commit()
                context.user_data.pop("last_tx_id", None)
                await update.message.reply_text(f"✅ Undone: {tx.merchant_raw} (₹{float(tx.amount):,.0f})")
            else:
                await update.message.reply_text("Transaction not found.")
    except Exception as e:
        await update.message.reply_text(f"❌ Failed: {e}")


async def handle_forwarded_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle any plain text message — try to parse as a UPI/bank SMS.
    Ignores messages that look like commands.
    """
    msg = update.message
    if not msg or not msg.text:
        return
    if msg.text.startswith("/"):
        return

    text = msg.text.strip()
    tx = parse_upi_message(text)

    if not tx:
        # Not a UPI message — ignore silently or help
        await msg.reply_text(
            "ℹ️ I couldn't parse that as a transaction.\n"
            "Try `/add 250 Swiggy` or forward a bank SMS.",
            parse_mode="Markdown",
        )
        return

    try:
        tx_id = ingest_from_form(
            date=tx["date"],
            merchant_raw=tx["merchant_raw"],
            amount=tx["amount"],
            currency=tx.get("currency", "INR"),
            tx_type=tx["tx_type"],
            notes=tx.get("notes", ""),
            category="",
        )
        context.user_data["last_tx_id"] = tx_id
        await msg.reply_text(
            f"✅ *Parsed & saved!*\n"
            f"₹{tx['amount']:,.0f} — {tx['merchant_raw']} ({tx['tx_type']})\n"
            f"_/undo to reverse_",
            parse_mode="Markdown",
        )
    except Exception as e:
        await msg.reply_text(f"❌ Failed to save: {e}")
