from __future__ import annotations

import json
import logging
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select

from api.deps import get_current_user_id, get_optional_user_id
from src.data.db import SessionLocal
from src.data.models import Transaction, TransactionSuggestion

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/suggestions", tags=["suggestions"])

_PARSE_PROMPT = """\
You are a bank SMS/email parser for an Indian user. Extract transaction details and return ONLY valid JSON:
{"merchant": <string or null>, "amount": <number or null>, "currency": "INR", "date": <"YYYY-MM-DD" or null>, "tx_type": "expense"|"income"|"investment", "category": <string or null>}

Category must be exactly one of: Food & Dining, Groceries, Transport, Shopping, Entertainment, Travel, Rent, Utilities & Bills, Healthcare, Fitness, EMI, Investments, Personal Care, Gifting, Education, Other

Rules:
- Swiggy, Zomato, restaurant, cafe, hotel dining → "Food & Dining"
- BigBasket, Blinkit, Zepto, grocery, supermarket → "Groceries"
- Uber, Ola, Rapido, Metro, fuel, petrol → "Transport"
- Electricity, water, gas, internet, broadband, DTH, Jio, Airtel, Vi, BSNL, mobile recharge → "Utilities & Bills"
- EMI, loan repayment, insurance premium, Bajaj Finance → "EMI"
- SIP, mutual fund, stocks, Zerodha, Groww, Kuvera → category "Investments", tx_type "investment"
- Salary, credited by employer → tx_type "income", category "Other"
- Gift, donation, flowers → "Gifting"
- Strip Rs., ₹, INR from amount; return as plain number

Examples:
"Dear UPI user, Rs.450.00 debited to Swiggy" → {"merchant":"Swiggy","amount":450,"currency":"INR","date":null,"tx_type":"expense","category":"Food & Dining"}
"Salary credit ₹80000 from Acme Corp" → {"merchant":"Acme Corp","amount":80000,"currency":"INR","date":null,"tx_type":"income","category":"Other"}
"EMI of Rs.8000 debited for Bajaj Finance" → {"merchant":"Bajaj Finance","amount":8000,"currency":"INR","date":null,"tx_type":"expense","category":"EMI"}
"Jio recharge Rs.299 successful" → {"merchant":"Jio","amount":299,"currency":"INR","date":null,"tx_type":"expense","category":"Utilities & Bills"}
"""


def _parse_raw(raw_text: str) -> dict:
    from src.llm.client import chat
    try:
        raw = chat(
            [
                {"role": "system", "content": _PARSE_PROMPT},
                {"role": "user", "content": raw_text},
            ],
            max_tokens=150,
            temperature=0,
        )
        raw = re.sub(r"```(?:json)?|```", "", raw).strip()
        return json.loads(raw)
    except Exception as exc:
        logger.warning("Suggestion parse failed: %s", exc)
        return {}


@router.post("/ingest", status_code=201)
def ingest(body: dict, user_id: int | None = Depends(get_optional_user_id)):
    """Accept raw SMS/email text, parse with Groq, store as pending suggestion."""
    raw_text = str(body.get("raw_text", "")).strip()
    source = str(body.get("source", "manual"))
    if not raw_text:
        raise HTTPException(400, "raw_text is required")

    parsed = _parse_raw(raw_text)

    suggestion = TransactionSuggestion(
        user_id=user_id,
        source=source,
        raw_text=raw_text,
        merchant=parsed.get("merchant"),
        amount=parsed.get("amount"),
        currency=parsed.get("currency", "INR"),
        date=parsed.get("date"),
        category=parsed.get("category"),
        tx_type=parsed.get("tx_type", "expense"),
        status="pending",
    )

    with SessionLocal() as session:
        session.add(suggestion)
        session.commit()
        session.refresh(suggestion)
        sid = suggestion.id

    return {"id": sid, "status": "pending", "parsed": parsed}


@router.get("/pending")
def get_pending(
    user_id: int | None = Depends(get_optional_user_id),
    month: str | None = Query(None, description="Filter by month YYYY-MM"),
):
    """Return all pending suggestions for the current user, optionally filtered by month."""
    with SessionLocal() as session:
        q = select(TransactionSuggestion).where(
            TransactionSuggestion.status == "pending"
        )
        if user_id is not None:
            q = q.where(TransactionSuggestion.user_id == user_id)
        if month:
            q = q.where(
                func.strftime("%Y-%m", TransactionSuggestion.date) == month
            )
        rows = session.execute(q.order_by(TransactionSuggestion.created_at.desc())).scalars().all()
        return [
            {
                "id": r.id,
                "source": r.source,
                "raw_text": r.raw_text,
                "merchant": r.merchant,
                "amount": float(r.amount) if r.amount else None,
                "currency": r.currency,
                "date": r.date,
                "category": r.category,
                "tx_type": r.tx_type,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]


@router.post("/ingest-bank", status_code=201)
def ingest_bank(body: dict, user_id: int | None = Depends(get_optional_user_id)):
    """Accept structured bank transaction (Setu format), run narration through AI, create suggestion."""
    narration = str(body.get("narration", "")).strip()
    amount = body.get("amount")
    date = body.get("date")  # "YYYY-MM-DD"
    if not narration and not amount:
        raise HTTPException(400, "narration or amount required")

    # Build description for AI parsing
    raw_text = narration if narration else f"₹{amount} transaction"
    if amount and narration:
        raw_text = f"₹{amount} - {narration}"

    parsed = _parse_raw(raw_text)

    suggestion = TransactionSuggestion(
        user_id=user_id,
        source="setu",
        raw_text=raw_text,
        merchant=parsed.get("merchant") or body.get("merchant"),
        amount=float(parsed.get("amount") or amount or 0),
        currency=parsed.get("currency", "INR"),
        date=parsed.get("date") or date,
        category=parsed.get("category"),
        tx_type=parsed.get("tx_type", "expense"),
        status="pending",
    )
    with SessionLocal() as session:
        session.add(suggestion)
        session.commit()
        session.refresh(suggestion)
        sid = suggestion.id

    return {"id": sid, "status": "pending", "parsed": parsed}


@router.patch("/{suggestion_id}/accept")
def accept_suggestion(
    suggestion_id: int,
    user_id: int | None = Depends(get_optional_user_id),
):
    """Create a Transaction from the suggestion and mark it accepted."""
    import uuid
    with SessionLocal() as session:
        s = session.get(TransactionSuggestion, suggestion_id)
        if not s:
            raise HTTPException(404, "Suggestion not found")
        if s.status != "pending":
            raise HTTPException(409, f"Already {s.status}")

        tx_date = s.date or datetime.today().strftime("%Y-%m-%d")
        tx = Transaction(
            transaction_id=str(uuid.uuid4()).replace("-", ""),
            date=tx_date,
            merchant_raw=s.merchant or "Unknown",
            amount=s.amount or 0,
            currency=s.currency,
            type=s.tx_type,
            category=s.category,
            status="processed",
            user_id=user_id or s.user_id,
        )
        session.add(tx)
        s.status = "accepted"
        session.commit()

    return {"status": "accepted", "transaction_id": tx.transaction_id}


@router.patch("/{suggestion_id}/reject")
def reject_suggestion(
    suggestion_id: int,
    user_id: int | None = Depends(get_optional_user_id),
):
    with SessionLocal() as session:
        s = session.get(TransactionSuggestion, suggestion_id)
        if not s:
            raise HTTPException(404, "Suggestion not found")
        s.status = "rejected"
        session.commit()
    return {"status": "rejected"}
