"""
Parse text messages into transaction dicts.

Handles:
  1. Bot commands: "/add 250 Swiggy lunch", "/add +50000 salary"
  2. Forwarded UPI / bank SMS alerts
"""
from __future__ import annotations

import re
from datetime import date as date_type

# ── UPI / bank SMS patterns ──────────────────────────────────────────────────
# Each pattern: (regex, amount_group, merchant_group, type)
_UPI_PATTERNS = [
    # PhonePe / GPay: "Paid ₹250.00 to Swiggy via PhonePe"
    (r"[Pp]aid\s+[₹Rs\.]*\s*([\d,]+(?:\.\d{1,2})?)\s+to\s+(.+?)\s+via", 1, 2, "expense"),
    # Generic UPI: "Sent ₹500 to Zomato UPI Ref: …"
    (r"[Ss]ent\s+[₹Rs\.]*\s*([\d,]+(?:\.\d{1,2})?)\s+to\s+(.+?)\s+(?:UPI|via|on)", 1, 2, "expense"),
    # HDFC / bank debit: "₹1,500 debited ... to Amazon"
    (r"[₹Rs\.]*\s*([\d,]+(?:\.\d{1,2})?)\s+debited.+?(?:to|at)\s+(.+?)(?:\.|$)", 1, 2, "expense"),
    # Credit card: "used for ₹500 at Zomato on"
    (r"used for\s+[₹Rs\.]*\s*([\d,]+(?:\.\d{1,2})?)\s+at\s+(.+?)\s+on", 1, 2, "expense"),
    # SBI / credit: "Rs. 500 debited from ... for Amazon"
    (r"[Rr]s\.?\s*([\d,]+(?:\.\d{1,2})?)\s+debited.+?for\s+(.+?)(?:\.|$)", 1, 2, "expense"),
    # Credit received: "₹5000 credited to your account"
    (r"[₹Rs\.]*\s*([\d,]+(?:\.\d{1,2})?)\s+credited", 1, None, "income"),
]


def parse_upi_message(text: str) -> dict | None:
    """
    Try to extract a transaction from a forwarded UPI / bank SMS.
    Returns None if the text doesn't match any known pattern.
    """
    for pattern, amt_grp, merch_grp, tx_type in _UPI_PATTERNS:
        m = re.search(pattern, text)
        if m:
            try:
                amount = float(m.group(amt_grp).replace(",", ""))
            except (IndexError, ValueError):
                continue

            merchant = ""
            if merch_grp:
                try:
                    merchant = m.group(merch_grp).strip().title()
                    # Trim trailing junk words
                    merchant = re.split(r"\s+(?:on|at|via|ref|upi|from|to)\b", merchant, flags=re.I)[0].strip()
                except IndexError:
                    pass

            return {
                "amount": amount,
                "merchant_raw": merchant or "UPI Payment",
                "tx_type": tx_type,
                "notes": text[:120],
                "date": str(date_type.today()),
                "currency": "INR",
            }
    return None


# ── /add command parser ───────────────────────────────────────────────────────

def parse_add_command(args: str) -> dict | None:
    """
    Parse the arguments to the /add command.

    Formats:
      "250 Swiggy lunch"    → expense, 250, Swiggy, notes=lunch
      "+50000 salary"       → income, 50000, salary
      "1200 Uber transport" → expense, 1200, Uber, notes=transport
    """
    args = args.strip()
    if not args:
        return None

    tx_type = "expense"
    if args.startswith("+"):
        tx_type = "income"
        args = args[1:].strip()
    elif args.startswith("-"):
        args = args[1:].strip()

    # First token = amount
    parts = args.split(None, 2)  # ["250", "Swiggy", "lunch"]
    if not parts:
        return None

    try:
        amount = float(parts[0].replace(",", "").replace("₹", "").replace("£", ""))
    except ValueError:
        return None

    merchant = parts[1].strip().title() if len(parts) > 1 else "Unknown"
    notes = parts[2].strip() if len(parts) > 2 else ""

    return {
        "amount": amount,
        "merchant_raw": merchant,
        "tx_type": tx_type,
        "notes": notes,
        "date": str(date_type.today()),
        "currency": "INR",
    }
