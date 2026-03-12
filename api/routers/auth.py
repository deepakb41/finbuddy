from __future__ import annotations

import os
import random
import smtplib
import string
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, HTTPException, status
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from jose import jwt
from pydantic import BaseModel
from sqlalchemy import select, delete

from src.data.db import SessionLocal
from src.data.models import User, OTPRequest

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY       = os.getenv("JWT_SECRET", "finbuddy-dev-secret-change-in-production")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 90
OTP_EXPIRE_MINUTES = 10


def _make_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


LOGO_URL = "https://finbuddy-nine.vercel.app/logo.png"
APP_URL  = "https://finbuddy-nine.vercel.app"


def _otp_html(otp: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FinBuddy — Verify your email</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.08);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#0f766e;padding:32px 24px 28px;">
              <img src="{LOGO_URL}" alt="FinBuddy" width="52" height="52"
                   style="display:block;margin:0 auto 12px;border-radius:12px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">FinBuddy</p>
              <p style="margin:4px 0 0;font-size:13px;color:#99f6e4;">Your AI-powered personal finance companion</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.3px;">Verify your email</p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.55;">
                Use the code below to sign in to your FinBuddy account. It expires in <strong style="color:#374151;">{OTP_EXPIRE_MINUTES} minutes</strong>.
              </p>

              <!-- OTP box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background-color:#f0fdf4;border:2px dashed #6ee7b7;border-radius:12px;padding:28px 16px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;">Your verification code</p>
                    <p style="margin:0;font-size:44px;font-weight:800;color:#0f766e;letter-spacing:10px;font-variant-numeric:tabular-nums;">{otp}</p>
                  </td>
                </tr>
              </table>

              <!-- App description -->
              <p style="margin:28px 0 0;font-size:14px;color:#6b7280;line-height:1.6;border-top:1px solid #f3f4f6;padding-top:24px;">
                FinBuddy automatically tracks your spending, categorizes transactions, and provides
                AI-powered insights to help you manage your money better.
              </p>

              <!-- Security note -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                <tr>
                  <td style="background-color:#fffbeb;border-left:3px solid #fbbf24;border-radius:0 8px 8px 0;padding:12px 16px;">
                    <p style="margin:0;font-size:13px;color:#92400e;">
                      If you did not request this code, you can safely ignore this email. Your account is secure.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 40px 28px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:13px;color:#9ca3af;">
                <strong style="color:#6b7280;">FinBuddy</strong> &mdash; AI-powered personal finance
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:#d1d5db;">
                &copy; 2026 FinBuddy &bull; <a href="{APP_URL}" style="color:#0f766e;text-decoration:none;">finbuddy-nine.vercel.app</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _send_email_otp(to_email: str, otp: str) -> None:
    host = os.getenv("SMTP_HOST")
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    port = int(os.getenv("SMTP_PORT", "587"))

    if not (host and user and password):
        print(f"\n[FinBuddy OTP] Email: {to_email}  →  OTP: {otp}  (set SMTP_* vars to send real emails)\n")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Your FinBuddy login code: {otp}"
    msg["From"] = f"FinBuddy <{user}>"
    msg["To"] = to_email

    # Plain-text fallback for email clients that don't render HTML
    plain = (
        f"Your FinBuddy login code is: {otp}\n\n"
        f"This code expires in {OTP_EXPIRE_MINUTES} minutes.\n\n"
        f"If you did not request this code, you can safely ignore this email."
    )
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(_otp_html(otp), "html"))

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


# ── Google Sign-In ────────────────────────────────────────────────────────────

class GoogleSignInBody(BaseModel):
    credential: str  # Google ID token from frontend


@router.post("/google")
def google_signin(body: GoogleSignInBody):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(500, "Google sign-in is not configured on this server")

    try:
        idinfo = google_id_token.verify_oauth2_token(
            body.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid Google token: {exc}")

    email = idinfo.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No email in Google token")

    with SessionLocal() as session:
        user = session.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if not user:
            user = User(email=email, password_hash="")
            session.add(user)
        session.commit()
        session.refresh(user)
        token = _make_token(user.id)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email},
    }
