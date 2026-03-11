"""
PDF bank statement parser.

Supports:
  - HDFC account statement
  - HDFC credit card statement
  - SBI passbook / statement
  - ICICI credit card statement
  - Generic fallback (pdfplumber table extraction)

Returns a DataFrame matching the contract of csv_loader.load_csv():
  columns: date, merchant_raw, amount, currency, type, notes, transaction_id, status, last_updated
"""
from __future__ import annotations

import io
import re
import uuid
from datetime import datetime

import pandas as pd


def _make_id(date: str, merchant: str, amount: str) -> str:
    return "pdf_" + uuid.uuid5(
        uuid.NAMESPACE_DNS, f"{date}|{merchant}|{amount}"
    ).hex[:16]


def _parse_amount(s: str) -> float | None:
    """Parse an amount string like '1,234.56' or '1234.56 Dr' to float."""
    s = s.strip().replace(",", "").replace("₹", "").replace("Rs.", "").replace("Rs", "")
    s = re.sub(r"[^0-9.\-]", "", s)
    try:
        return abs(float(s))
    except ValueError:
        return None


def _infer_type(row_text: str, debit_col: str, credit_col: str) -> str:
    """Infer expense/income from which column has the value."""
    if debit_col and float(debit_col.replace(",", "").strip() or 0) > 0:
        return "expense"
    if credit_col and float(credit_col.replace(",", "").strip() or 0) > 0:
        return "income"
    text_lower = row_text.lower()
    if any(w in text_lower for w in ["dr", "debit", "purchase", "withdrawal"]):
        return "expense"
    return "income"


def _normalize_date(date_str: str) -> str | None:
    """Try multiple date formats, return YYYY-MM-DD string or None."""
    formats = [
        "%d/%m/%Y", "%d/%m/%y", "%d-%m-%Y", "%d-%m-%y",
        "%d %b %Y", "%d %b %y", "%d-%b-%Y", "%d-%b-%y",
        "%Y-%m-%d", "%d/%b/%Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


# ── Bank-specific parsers ─────────────────────────────────────────────────────

def _parse_hdfc(pages: list) -> pd.DataFrame:
    """Parse HDFC account or credit card statement pages."""
    rows = []
    for page in pages:
        # Try table extraction first
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                if not row or len(row) < 3:
                    continue
                # HDFC account: Date | Narration | Ref | Val Date | Debit | Credit | Balance
                # HDFC credit:  Date | Description | Amount | Cr/Dr
                date_str = str(row[0] or "").strip()
                date = _normalize_date(date_str)
                if not date:
                    continue

                merchant = str(row[1] or "").strip()
                if not merchant or merchant.lower() in ("narration", "description", "particulars"):
                    continue

                # Try to find debit / credit columns
                debit = credit = ""
                if len(row) >= 6:
                    debit  = str(row[4] or "").strip()
                    credit = str(row[5] or "").strip()
                elif len(row) >= 3:
                    # Might be combined amount with Dr/Cr
                    raw_amt = str(row[2] or "").strip()
                    if "cr" in raw_amt.lower():
                        credit = raw_amt
                    else:
                        debit = raw_amt

                amount = _parse_amount(debit) or _parse_amount(credit)
                if not amount:
                    continue

                tx_type = "expense" if _parse_amount(debit) else "income"
                rows.append({
                    "date": date,
                    "merchant_raw": merchant,
                    "amount": amount,
                    "currency": "INR",
                    "type": tx_type,
                    "notes": "",
                })
    return pd.DataFrame(rows)


def _parse_sbi(pages: list) -> pd.DataFrame:
    """Parse SBI passbook / account statement."""
    rows = []
    for page in pages:
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                if not row or len(row) < 3:
                    continue
                # SBI: Date | Description | Ref | Debit | Credit | Balance
                date = _normalize_date(str(row[0] or "").strip())
                if not date:
                    continue
                merchant = str(row[1] or "").strip()
                if not merchant or "description" in merchant.lower():
                    continue
                debit  = str(row[3] or "").strip() if len(row) > 3 else ""
                credit = str(row[4] or "").strip() if len(row) > 4 else ""
                amount = _parse_amount(debit) or _parse_amount(credit)
                if not amount:
                    continue
                tx_type = "expense" if _parse_amount(debit) else "income"
                rows.append({
                    "date": date,
                    "merchant_raw": merchant,
                    "amount": amount,
                    "currency": "INR",
                    "type": tx_type,
                    "notes": "",
                })
    return pd.DataFrame(rows)


def _parse_icici(pages: list) -> pd.DataFrame:
    """Parse ICICI credit card statement."""
    rows = []
    for page in pages:
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                if not row or len(row) < 3:
                    continue
                # ICICI: Date | Description | Amount (with Dr/Cr)
                date = _normalize_date(str(row[0] or "").strip())
                if not date:
                    continue
                merchant = str(row[1] or "").strip()
                if not merchant:
                    continue
                raw_amt = str(row[-1] or "").strip()
                amount = _parse_amount(raw_amt)
                if not amount:
                    continue
                tx_type = "income" if "cr" in raw_amt.lower() else "expense"
                rows.append({
                    "date": date,
                    "merchant_raw": merchant,
                    "amount": amount,
                    "currency": "INR",
                    "type": tx_type,
                    "notes": "",
                })
    return pd.DataFrame(rows)


def _parse_generic(pages: list) -> pd.DataFrame:
    """Generic fallback: try to extract any table with date-like and amount-like columns."""
    rows = []
    for page in pages:
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                if not row or len(row) < 2:
                    continue
                # Find first cell that looks like a date
                date = None
                date_idx = -1
                for i, cell in enumerate(row):
                    d = _normalize_date(str(cell or "").strip())
                    if d:
                        date = d
                        date_idx = i
                        break
                if not date:
                    continue

                # Merchant: next non-empty cell after date
                merchant = ""
                for j in range(date_idx + 1, len(row)):
                    val = str(row[j] or "").strip()
                    if val and not re.match(r"^[\d,. ]+$", val):
                        merchant = val
                        break
                if not merchant:
                    continue

                # Amount: last numeric cell
                amount = None
                for cell in reversed(row):
                    a = _parse_amount(str(cell or ""))
                    if a and a > 0:
                        amount = a
                        break
                if not amount:
                    continue

                rows.append({
                    "date": date,
                    "merchant_raw": merchant,
                    "amount": amount,
                    "currency": "INR",
                    "type": "expense",
                    "notes": "",
                })
    return pd.DataFrame(rows)


# ── Bank detection ────────────────────────────────────────────────────────────

def _detect_bank(text: str) -> str:
    text_lower = text.lower()
    if "hdfc" in text_lower:
        return "hdfc"
    if "state bank" in text_lower or "sbi" in text_lower:
        return "sbi"
    if "icici" in text_lower:
        return "icici"
    return "generic"


# ── Main entry point ──────────────────────────────────────────────────────────

def load_pdf(source: str | io.IOBase) -> pd.DataFrame:
    """
    Load a bank PDF statement and return a normalized DataFrame
    compatible with pipeline.standardize_df().
    """
    try:
        import pdfplumber
    except ImportError:
        raise ImportError(
            "pdfplumber is required for PDF parsing. "
            "Install it with: pip install pdfplumber"
        )

    with pdfplumber.open(source) as pdf:
        # Detect bank from first page text
        first_page_text = pdf.pages[0].extract_text() or ""
        bank = _detect_bank(first_page_text)

        if bank == "hdfc":
            df = _parse_hdfc(pdf.pages)
        elif bank == "sbi":
            df = _parse_sbi(pdf.pages)
        elif bank == "icici":
            df = _parse_icici(pdf.pages)
        else:
            df = _parse_generic(pdf.pages)

    if df.empty:
        raise ValueError(f"No transactions found in PDF (detected bank: {bank})")

    # Add required pipeline columns
    df["transaction_id"] = df.apply(
        lambda r: _make_id(str(r["date"]), str(r["merchant_raw"]), str(r["amount"])),
        axis=1,
    )
    df["status"] = "new"
    df["last_updated"] = ""

    return df
