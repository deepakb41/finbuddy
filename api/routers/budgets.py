from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import get_db
from src.data.models import Budget

router = APIRouter(prefix="/budgets", tags=["budgets"])


class BudgetUpsert(BaseModel):
    category: str
    monthly_limit: float
    currency: str = "GBP"


@router.get("")
def list_budgets(db: Session = Depends(get_db)):
    budgets = db.execute(select(Budget)).scalars().all()
    return [
        {
            "id": b.id,
            "category": b.category,
            "monthly_limit": float(b.monthly_limit),
            "currency": b.currency,
        }
        for b in budgets
    ]


@router.post("", status_code=201)
def upsert_budget(body: BudgetUpsert, db: Session = Depends(get_db)):
    """Create or update a monthly budget for a category."""
    existing = db.execute(
        select(Budget).where(Budget.category == body.category)
    ).scalar_one_or_none()

    if existing:
        existing.monthly_limit = body.monthly_limit
        existing.currency = body.currency
        db.commit()
        return {"status": "updated", "category": body.category}
    else:
        db.add(Budget(
            category=body.category,
            monthly_limit=body.monthly_limit,
            currency=body.currency,
        ))
        db.commit()
        return {"status": "created", "category": body.category}


@router.delete("/{category}")
def delete_budget(category: str, db: Session = Depends(get_db)):
    budget = db.execute(
        select(Budget).where(Budget.category == category)
    ).scalar_one_or_none()

    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    db.delete(budget)
    db.commit()
    return {"status": "deleted"}
