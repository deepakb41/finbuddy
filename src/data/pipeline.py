import uuid
import pandas as pd
from decimal import Decimal
from sqlalchemy import select
from src.data.db import SessionLocal
from src.data.models import Transaction
from src.data.cleaning.normalize_merchants import load_aliases, normalize_merchant
from src.data.cleaning.category_mapping import load_category_rules, map_category

def _parse_month_to_date(series: pd.Series) -> pd.Series:
    """
    Accepts:
      - 'YYYY-MM' (e.g. 2024-03) → first day of that month
      - 'YYYY-MM-DD'             → preserved as-is
      - actual date objects      → preserved as-is
    Returns:
      - python date objects with day-level precision preserved
    """
    s = series.astype(str).str.strip()

    # If it's YYYY-MM only, append '-01'
    mask_ym = s.str.match(r"^\d{4}-\d{2}$", na=False)
    s.loc[mask_ym] = s.loc[mask_ym] + "-01"

    # Parse to datetime, preserve full date (no month-start normalization)
    dt = pd.to_datetime(s, errors="coerce", dayfirst=False)
    return dt.dt.date

def standardize_df(df: pd.DataFrame) -> pd.DataFrame:
    # Normalize column existence (if missing, add empty)
    for c in ["transaction_id","date","merchant_raw","amount","currency","type","category","notes","status","last_updated"]:
        if c not in df.columns:
            df[c] = ""

    # Date parsing: preserves full YYYY-MM-DD precision
    df["date"] = _parse_month_to_date(df["date"])

    # Amount parsing: numeric only
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")

    # --- NEW: drop rows with missing/invalid amount ---
    before = len(df)
    df = df.dropna(subset=["amount"])
    # also remove amount == 0 if you want (optional)
    # df = df[df["amount"] != 0]
    after = len(df)

    # Type normalization
    df["type"] = df["type"].astype(str).str.strip().str.lower()
    df.loc[~df["type"].isin(["expense", "income", "transfer"]), "type"] = "expense"

    # Currency default
    df["currency"] = df["currency"].astype(str).str.strip()
    df.loc[df["currency"] == "", "currency"] = "GBP"

    # Text fields cleanup
    for c in ["merchant_raw", "category", "notes", "transaction_id", "status"]:
        df[c] = df[c].astype(str).fillna("").str.strip()

    # Drop rows missing essentials
    df = df.dropna(subset=["date"])             # drop if date can't be parsed at all
    df = df[df["merchant_raw"] != ""]
    df = df[df["transaction_id"] != ""]

    # Optional: print summary (or use logging later)
    skipped = before - after
    if skipped > 0:
        print(f"⚠️ Skipped {skipped} rows due to missing/invalid amount.")

    return df

def enrich_df(df: pd.DataFrame, aliases_path: str, category_rules_path: str) -> pd.DataFrame:
    aliases = load_aliases(aliases_path)
    rules = load_category_rules(category_rules_path)

    df["merchant_normalized"] = df["merchant_raw"].apply(lambda x: normalize_merchant(x, aliases))
    df["category_final"] = df.apply(
        lambda r: map_category(r["merchant_normalized"], r["type"], r["category"], rules),
        axis=1
    )
    return df

def ingest_from_form(
    *,
    date: str,
    merchant_raw: str,
    amount: float,
    currency: str,
    tx_type: str,
    notes: str,
    category: str,
    user_id: int | None = None,
    aliases_path: str = "config/merchants_aliases.yml",
    category_rules_path: str = "config/category_rules.yml",
) -> str:
    """
    Create a single transaction directly from form input.
    Returns the generated transaction_id.
    """
    aliases = load_aliases(aliases_path)
    rules = load_category_rules(category_rules_path)

    merchant_normalized = normalize_merchant(merchant_raw, aliases)
    if not category or category == "Uncategorized":
        category = map_category(merchant_normalized, tx_type, "", rules)

    txn_date = _parse_month_to_date(pd.Series([date]))[0]
    transaction_id = "form_" + uuid.uuid4().hex[:16]

    with SessionLocal() as session:
        session.add(Transaction(
            transaction_id=transaction_id,
            date=txn_date,
            merchant_raw=merchant_raw,
            merchant_normalized=merchant_normalized,
            amount=Decimal(str(amount)),
            currency=currency,
            type=tx_type,
            category=category,
            notes=notes,
            status="processed",
            user_id=user_id,
        ))
        session.commit()

    return transaction_id


def upsert_transactions(df: pd.DataFrame) -> int:
    count = 0
    with SessionLocal() as session:
        for _, r in df.iterrows():
            existing = session.execute(
                select(Transaction).where(Transaction.transaction_id == r["transaction_id"])
            ).scalar_one_or_none()

            if existing:
                existing.date = r["date"]
                existing.merchant_raw = r["merchant_raw"]
                existing.merchant_normalized = r.get("merchant_normalized")
                existing.amount = Decimal(str(r["amount"]))
                existing.currency = r["currency"]
                existing.type = r["type"]
                existing.category = r["category_final"]
                existing.notes = r["notes"]
                existing.status = "processed"
            else:
                session.add(Transaction(
                    transaction_id=r["transaction_id"],
                    date=r["date"],
                    merchant_raw=r["merchant_raw"],
                    merchant_normalized=r.get("merchant_normalized"),
                    amount=Decimal(str(r["amount"])),
                    currency=r["currency"],
                    type=r["type"],
                    category=r["category_final"],
                    notes=r["notes"],
                    status="processed",
                ))
            count += 1

        session.commit()
    return count
