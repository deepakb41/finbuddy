from __future__ import annotations

from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, update, text
from sqlalchemy.orm import Session

from api.deps import get_db
from src.data.models import Transaction
from src.data.pipeline import ingest_from_form
from src.insights.summaries import recent_transactions, known_merchants

router = APIRouter(prefix="/transactions", tags=["transactions"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class TransactionCreate(BaseModel):
    date: str
    merchant_raw: str
    amount: float
    currency: str = "GBP"
    tx_type: str = "expense"
    notes: str = ""
    category: str = ""


class TransactionPatch(BaseModel):
    category: Optional[str] = None
    notes: Optional[str] = None
    merchant_normalized: Optional[str] = None


class TransactionOut(BaseModel):
    transaction_id: str
    date: str
    merchant_raw: str
    merchant_normalized: Optional[str]
    amount: float
    currency: str
    type: str
    category: Optional[str]
    notes: Optional[str]
    status: str

    class Config:
        from_attributes = True


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_transaction(body: TransactionCreate):
    """Add a single transaction (from form / bot / voice)."""
    tx_id = ingest_from_form(
        date=body.date,
        merchant_raw=body.merchant_raw,
        amount=body.amount,
        currency=body.currency,
        tx_type=body.tx_type,
        notes=body.notes,
        category=body.category,
    )
    return {"transaction_id": tx_id, "status": "created"}


@router.get("")
def list_transactions(
    month: Optional[str] = Query(None, description="YYYY-MM"),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
):
    """List transactions with optional filters."""
    rows = recent_transactions(limit=limit)
    result = []
    for r in rows:
        tx = {
            "transaction_id": r[0],
            "date": str(r[1]),
            "merchant_raw": r[2],
            "merchant_normalized": r[3],
            "amount": float(r[4]),
            "currency": r[5],
            "type": r[6],
            "category": r[7],
            "notes": r[8],
            "status": r[9],
        }
        # Apply filters
        if month and not str(r[1]).startswith(month):
            continue
        if category and r[7] != category:
            continue
        if search:
            needle = search.lower()
            haystack = f"{r[2]} {r[3] or ''} {r[8] or ''}".lower()
            if needle not in haystack:
                continue
        result.append(tx)
    return result


@router.patch("/{transaction_id}")
def patch_transaction(
    transaction_id: str,
    body: TransactionPatch,
    db: Session = Depends(get_db),
):
    """Update category, notes, or merchant_normalized on a transaction."""
    tx = db.execute(
        select(Transaction).where(Transaction.transaction_id == transaction_id)
    ).scalar_one_or_none()

    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if body.category is not None:
        tx.category = body.category
        tx.status = "corrected"
    if body.notes is not None:
        tx.notes = body.notes
    if body.merchant_normalized is not None:
        tx.merchant_normalized = body.merchant_normalized

    db.commit()
    return {"status": "updated"}


@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: str, db: Session = Depends(get_db)):
    """Soft-delete a transaction by setting status to 'deleted'."""
    tx = db.execute(
        select(Transaction).where(Transaction.transaction_id == transaction_id)
    ).scalar_one_or_none()

    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    tx.status = "deleted"
    db.commit()
    return {"status": "deleted"}


@router.get("/meta/merchants")
def get_merchants():
    """Return known merchant names for autocomplete."""
    return {"merchants": known_merchants(limit=100)}
