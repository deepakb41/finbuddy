from __future__ import annotations
from typing import Iterable
from sqlalchemy import select, update
from src.data.db import SessionLocal
from src.data.models import Transaction

def fetch_needs_categorization(limit: int = 50) -> list[Transaction]:
    with SessionLocal() as s:
        q = (
            select(Transaction)
            .where((Transaction.category == None) | (Transaction.category == "") | (Transaction.category == "Uncategorized"))
            .order_by(Transaction.date.desc())
            .limit(limit)
        )
        return list(s.execute(q).scalars().all())

def update_transaction_category(
    transaction_id: str,
    category: str,
    merchant_normalized: str | None = None,
    confidence: float | None = None,
    status: str = "processed",
):
    with SessionLocal() as s:
        stmt = (
            update(Transaction)
            .where(Transaction.transaction_id == transaction_id)
            .values(
                category=category,
                merchant_normalized=merchant_normalized,
                status=status,
            )
        )
        s.execute(stmt)
        s.commit()
