from __future__ import annotations

import uuid
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from api.deps import get_current_user_id
from src.data.db import SessionLocal
from src.data.models import UserProfile, RecurringTransaction, Transaction

router = APIRouter(prefix="/profile", tags=["profile"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class ProfileUpsert(BaseModel):
    monthly_income: Optional[float] = None
    savings_target_pct: Optional[int] = None
    onboarding_completed: Optional[bool] = None


class RecurringCreate(BaseModel):
    merchant_raw: str
    amount: float
    currency: str = "INR"
    category: str = "EMI"
    day_of_month: int = 1
    months_remaining: Optional[int] = None
    frequency: str = "monthly"
    notes: Optional[str] = None


class RecurringPatch(BaseModel):
    scope: str  # "this_month" | "future"
    merchant_raw: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    category: Optional[str] = None
    day_of_month: Optional[int] = None
    months_remaining: Optional[int] = None
    frequency: Optional[str] = None
    notes: Optional[str] = None


# ── Profile endpoints ──────────────────────────────────────────────────────────

@router.get("")
def get_profile(user_id: int = Depends(get_current_user_id)):
    with SessionLocal() as session:
        profile = session.execute(
            select(UserProfile).where(UserProfile.user_id == user_id)
        ).scalar_one_or_none()

        if not profile:
            profile = UserProfile(user_id=user_id)
            session.add(profile)
            session.commit()
            session.refresh(profile)

        return {
            "user_id": profile.user_id,
            "monthly_income": float(profile.monthly_income) if profile.monthly_income else None,
            "savings_target_pct": profile.savings_target_pct,
            "onboarding_completed": profile.onboarding_completed,
        }


@router.post("")
def upsert_profile(
    body: ProfileUpsert,
    user_id: int = Depends(get_current_user_id),
):
    with SessionLocal() as session:
        profile = session.execute(
            select(UserProfile).where(UserProfile.user_id == user_id)
        ).scalar_one_or_none()

        if not profile:
            profile = UserProfile(user_id=user_id)
            session.add(profile)

        if body.monthly_income is not None:
            profile.monthly_income = body.monthly_income
        if body.savings_target_pct is not None:
            profile.savings_target_pct = body.savings_target_pct
        if body.onboarding_completed is not None:
            profile.onboarding_completed = body.onboarding_completed

        session.commit()
    return {"status": "ok"}


# ── Recurring endpoints ────────────────────────────────────────────────────────

@router.get("/recurring")
def list_recurring(user_id: int = Depends(get_current_user_id)):
    with SessionLocal() as session:
        rows = session.execute(
            select(RecurringTransaction).where(
                RecurringTransaction.user_id == user_id,
                RecurringTransaction.is_active == True,
            ).order_by(RecurringTransaction.created_at.desc())
        ).scalars().all()

        return [
            {
                "id": r.id,
                "merchant_raw": r.merchant_raw,
                "amount": float(r.amount),
                "currency": r.currency,
                "category": r.category,
                "day_of_month": r.day_of_month,
                "months_remaining": r.months_remaining,
                "frequency": r.frequency or "monthly",
                "last_created_month": r.last_created_month,
                "notes": r.notes,
            }
            for r in rows
        ]


@router.post("/recurring", status_code=201)
def create_recurring(
    body: RecurringCreate,
    user_id: int = Depends(get_current_user_id),
):
    with SessionLocal() as session:
        rec = RecurringTransaction(
            user_id=user_id,
            merchant_raw=body.merchant_raw,
            amount=body.amount,
            currency=body.currency,
            category=body.category,
            day_of_month=max(1, min(28, body.day_of_month)),
            months_remaining=body.months_remaining,
            frequency=body.frequency,
            notes=body.notes,
        )
        session.add(rec)
        session.commit()
        session.refresh(rec)
        return {"id": rec.id, "status": "created"}


@router.patch("/recurring/{rec_id}")
def patch_recurring(
    rec_id: int,
    body: RecurringPatch,
    user_id: int = Depends(get_current_user_id),
):
    with SessionLocal() as session:
        rec = session.execute(
            select(RecurringTransaction).where(
                RecurringTransaction.id == rec_id,
                RecurringTransaction.user_id == user_id,
            )
        ).scalar_one_or_none()

        if not rec:
            raise HTTPException(404, "Recurring transaction not found")

        if body.scope == "this_month":
            # Only edit the already-created transaction for this month (if any)
            current_month = date.today().strftime("%Y-%m")
            tx = session.execute(
                select(Transaction).where(
                    Transaction.user_id == user_id,
                    Transaction.merchant_raw == rec.merchant_raw,
                    Transaction.notes.like(f"%recurring:{rec_id}%"),
                )
            ).scalar_one_or_none()
            if tx:
                if body.amount is not None:
                    tx.amount = body.amount
                if body.category is not None:
                    tx.category = body.category
                if body.notes is not None:
                    tx.notes = body.notes
        else:
            # "future" — update the template
            if body.merchant_raw is not None:
                rec.merchant_raw = body.merchant_raw
            if body.amount is not None:
                rec.amount = body.amount
            if body.currency is not None:
                rec.currency = body.currency
            if body.category is not None:
                rec.category = body.category
            if body.day_of_month is not None:
                rec.day_of_month = max(1, min(28, body.day_of_month))
            if body.months_remaining is not None:
                rec.months_remaining = body.months_remaining
            if body.frequency is not None:
                rec.frequency = body.frequency
            if body.notes is not None:
                rec.notes = body.notes

        session.commit()
    return {"status": "updated"}


@router.delete("/recurring/{rec_id}")
def delete_recurring(
    rec_id: int,
    user_id: int = Depends(get_current_user_id),
):
    with SessionLocal() as session:
        rec = session.execute(
            select(RecurringTransaction).where(
                RecurringTransaction.id == rec_id,
                RecurringTransaction.user_id == user_id,
            )
        ).scalar_one_or_none()

        if not rec:
            raise HTTPException(404, "Recurring transaction not found")

        rec.is_active = False
        session.commit()
    return {"status": "deleted"}


@router.post("/recurring/process", status_code=200)
def process_recurring(user_id: int = Depends(get_current_user_id)):
    """
    Idempotent — creates this month's transactions for all active recurring items.
    Safe to call on every app open (checks last_created_month to avoid duplicates).
    """
    today = date.today()
    current_month = today.strftime("%Y-%m")
    created = []

    with SessionLocal() as session:
        rows = session.execute(
            select(RecurringTransaction).where(
                RecurringTransaction.user_id == user_id,
                RecurringTransaction.is_active == True,
            )
        ).scalars().all()

        for rec in rows:
            if rec.last_created_month == current_month:
                # Verify the transaction still exists and wasn't cleared
                existing = session.execute(
                    select(Transaction).where(
                        Transaction.user_id == user_id,
                        Transaction.notes.like(f"%recurring:{rec.id}%"),
                        Transaction.status != "deleted",
                    )
                ).scalar_one_or_none()
                if existing:
                    continue
                # Transaction was deleted — fall through to re-create it

            # Only create if today >= day_of_month (or it's the last day)
            target_day = min(rec.day_of_month, today.day if today.day >= rec.day_of_month else 0)
            if today.day < rec.day_of_month:
                continue

            tx_date = f"{current_month}-{min(rec.day_of_month, 28):02d}"
            tx_id = "rec_" + uuid.uuid4().hex[:16]

            tx = Transaction(
                transaction_id=tx_id,
                date=tx_date,
                merchant_raw=rec.merchant_raw,
                amount=rec.amount,
                currency=rec.currency,
                type="expense",
                category=rec.category,
                notes=f"{rec.notes or rec.merchant_raw} [recurring:{rec.id}]",
                status="processed",
                user_id=user_id,
            )
            session.add(tx)

            rec.last_created_month = current_month
            if rec.months_remaining is not None:
                rec.months_remaining = max(0, rec.months_remaining - 1)
                if rec.months_remaining == 0:
                    rec.is_active = False

            created.append(rec.merchant_raw)

        session.commit()

    return {"created": created, "count": len(created)}
