"""
IMAP email parser for bank alert emails.

Polls your inbox for unseen emails from configured bank senders,
extracts transactions using the same UPI patterns as the Telegram bot,
and ingests them via ingest_from_form().

Usage:
  python scripts/run_email_sync.py
"""
from __future__ import annotations

import email
import imaplib
import logging
from email.header import decode_header
from email.message import Message

from src.config import settings
from src.bot.message_parser import parse_upi_message
from src.data.pipeline import ingest_from_form

logger = logging.getLogger(__name__)


def _get_bank_senders() -> list[str]:
    raw = settings.email_bank_senders or ""
    return [s.strip() for s in raw.split(",") if s.strip()]


def _decode_header_str(value: str) -> str:
    parts = decode_header(value)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(part)
    return "".join(decoded)


def _extract_text(msg: Message) -> str:
    """Extract plain text from an email message (handles multipart)."""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                payload = part.get_payload(decode=True)
                if payload:
                    return payload.decode(part.get_content_charset() or "utf-8", errors="replace")
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            return payload.decode(msg.get_content_charset() or "utf-8", errors="replace")
    return ""


def sync_emails(mark_read: bool = True) -> int:
    """
    Connect to IMAP, find unseen bank emails, parse transactions, ingest them.
    Returns the number of transactions imported.
    """
    if not settings.imap_email or not settings.imap_app_password:
        logger.warning("IMAP credentials not configured — skipping email sync")
        return 0

    senders = _get_bank_senders()
    if not senders:
        logger.warning("EMAIL_BANK_SENDERS not configured — skipping email sync")
        return 0

    imported = 0
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(settings.imap_email, settings.imap_app_password)
        mail.select("INBOX")

        for sender in senders:
            # Search for unseen emails from this sender
            _, data = mail.search(None, f'(UNSEEN FROM "{sender}")')
            ids = data[0].split() if data and data[0] else []

            for msg_id in ids:
                _, raw = mail.fetch(msg_id, "(RFC822)")
                if not raw or not raw[0]:
                    continue

                raw_email = raw[0][1]
                if not isinstance(raw_email, bytes):
                    continue

                msg = email.message_from_bytes(raw_email)
                subject = _decode_header_str(msg.get("Subject", ""))
                body = _extract_text(msg)

                # Try parsing subject first, then body
                tx = parse_upi_message(subject) or parse_upi_message(body)

                if tx:
                    try:
                        ingest_from_form(
                            date=tx["date"],
                            merchant_raw=tx["merchant_raw"],
                            amount=tx["amount"],
                            currency=tx.get("currency", "INR"),
                            tx_type=tx["tx_type"],
                            notes=f"[email] {tx.get('notes', '')[:100]}",
                            category="",
                        )
                        imported += 1
                        logger.info(
                            "Imported from email: %s ₹%.0f @ %s",
                            tx["tx_type"], tx["amount"], tx["merchant_raw"],
                        )
                    except Exception as e:
                        logger.error("Failed to ingest email transaction: %s", e)

                    # Mark as read
                    if mark_read:
                        mail.store(msg_id, "+FLAGS", "\\Seen")

        mail.logout()
    except imaplib.IMAP4.error as e:
        logger.error("IMAP error: %s", e)
    except Exception as e:
        logger.error("Email sync error: %s", e)

    return imported
