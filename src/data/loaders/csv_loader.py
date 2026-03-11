from __future__ import annotations

import io
import uuid
import pandas as pd

# Maps our canonical field names to common column aliases found in bank CSVs
_COLUMN_ALIASES: dict[str, list[str]] = {
    "date": ["date", "transaction date", "value date", "trans date", "posted date", "booking date"],
    "merchant_raw": [
        "description", "merchant", "payee", "narration",
        "transaction description", "details", "memo", "particulars",
    ],
    "amount": ["amount", "transaction amount", "sum", "value"],
    "currency": ["currency", "ccy"],
    "type": ["type", "transaction type", "kind", "dr/cr"],
    "notes": ["notes", "note", "remarks", "reference", "ref"],
}


def _detect_column(df: pd.DataFrame, field: str) -> str | None:
    aliases = [a.lower() for a in _COLUMN_ALIASES.get(field, [])]
    for col in df.columns:
        if col.strip().lower() in aliases:
            return col
    return None


def load_csv(source: str | io.IOBase) -> pd.DataFrame:
    """
    Load a bank CSV export and return a normalized DataFrame
    compatible with pipeline.standardize_df().

    Auto-detects common column names. Also handles debit/credit split
    columns common in UK/Indian bank exports.
    """
    raw = pd.read_csv(source, skipinitialspace=True)
    raw.columns = raw.columns.str.strip()

    out = pd.DataFrame()

    # Map detected columns to our canonical names
    for field in ["date", "merchant_raw", "amount", "currency", "type", "notes"]:
        col = _detect_column(raw, field)
        out[field] = raw[col] if col else ""

    # Handle debit/credit split columns (common in bank exports)
    amount_missing = out["amount"].eq("").all() or out["amount"].isna().all()
    if amount_missing:
        debit_col = next(
            (c for c in raw.columns if "debit" in c.lower() or "withdrawal" in c.lower()), None
        )
        credit_col = next(
            (c for c in raw.columns if "credit" in c.lower() or "deposit" in c.lower()), None
        )
        if debit_col or credit_col:
            debit = pd.to_numeric(
                raw.get(debit_col, pd.Series(0, index=raw.index)), errors="coerce"
            ).fillna(0).abs()
            credit = pd.to_numeric(
                raw.get(credit_col, pd.Series(0, index=raw.index)), errors="coerce"
            ).fillna(0).abs()
            out["amount"] = debit.where(debit > 0, credit)
            if out["type"].eq("").all():
                out["type"] = "expense"
                out.loc[credit > 0, "type"] = "income"

    # Generate stable transaction IDs from content hash
    out["transaction_id"] = out.apply(
        lambda r: "csv_" + uuid.uuid5(
            uuid.NAMESPACE_DNS,
            f"{r.get('date', '')}|{r.get('merchant_raw', '')}|{r.get('amount', '')}",
        ).hex[:16],
        axis=1,
    )
    out["status"] = "new"
    out["last_updated"] = ""

    return out
