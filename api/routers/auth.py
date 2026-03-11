from __future__ import annotations

import os
import random
import smtplib
import string
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText

from fastapi import APIRouter, HTTPException, status
from jose import jwt
from pydantic import BaseModel
from sqlalchemy import select, delete

from src.data.db import SessionLocal
from src.data.models import User, OTPRequest

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv("JWT_SECRET", "finbuddy-dev-secret-change-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 90
OTP_EXPIRE_MINUTES = 10


def _make_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


def _send_email_otp(to_email: str, otp: str) -> None:
    host = os.getenv("SMTP_HOST")
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    port = int(os.getenv("SMTP_PORT", "587"))

    if not (host and user and password):
        print(f"\n[FinBuddy OTP] Email: {to_email}  →  OTP: {otp}  (set SMTP_* vars to send real emails)\n")
        return

    msg = MIMEText(
        f"Your FinBuddy login code is: {otp}\n\nThis code expires in {OTP_EXPIRE_MINUTES} minutes.",
        "plain",
    )
    msg["Subject"] = f"FinBuddy: your login code is {otp}"
    msg["From"] = user
    msg["To"] = to_email

    with smtplib.SMTP(host, port) as smtp:
        smtp.starttls()
        smtp.login(user, password)
        smtp.send_message(msg)


# ── Request OTP ──────────────────────────────────────────────────────────────

class OTPRequestBody(BaseModel):
    contact: str   # email address


@router.post("/request-otp")
def request_otp(body: OTPRequestBody):
    contact = body.contact.strip().lower()
    if not contact or "@" not in contact:
        raise HTTPException(400, "Valid email address required")

    otp = _generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)

    with SessionLocal() as session:
        session.execute(delete(OTPRequest).where(OTPRequest.contact == contact))
        session.add(OTPRequest(contact=contact, otp=otp, expires_at=expires_at))
        session.commit()

    _send_email_otp(contact, otp)

    return {"message": "OTP sent", "contact_type": "email", "expires_in_minutes": OTP_EXPIRE_MINUTES}


# ── Verify OTP ───────────────────────────────────────────────────────────────

class OTPVerifyBody(BaseModel):
    contact: str
    otp: str


@router.post("/verify-otp")
def verify_otp(body: OTPVerifyBody):
    contact = body.contact.strip().lower()
    otp = body.otp.strip()

    with SessionLocal() as session:
        record = session.execute(
            select(OTPRequest).where(OTPRequest.contact == contact).order_by(OTPRequest.created_at.desc())
        ).scalar_one_or_none()

        if not record:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No OTP found for this contact. Request a new one.")

        if record.expires_at < datetime.utcnow():
            session.delete(record)
            session.commit()
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "OTP expired. Request a new one.")

        if record.otp != otp:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid OTP")

        session.delete(record)

        user = session.execute(select(User).where(User.email == contact)).scalar_one_or_none()
        if not user:
            user = User(email=contact, password_hash="")
            session.add(user)

        session.commit()
        session.refresh(user)
        token = _make_token(user.id)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email},
    }
