"""
Setu Account Aggregator (AA) integration router.

Flow:
  1. POST /aa/initiate  — create Setu consent, return redirect URL
  2. User approves consent on Setu → redirected back to app with ?fi=<handle>
  3. POST /aa/callback  — Setu webhook updates consent status
  4. POST /aa/fetch     — create data session, parse FIXML, ingest as suggestions
  5. GET  /aa/consents  — list user's connected accounts
"""
from __future__ import annotations

import base64
import logging
import os
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select

from api.deps import get_optional_user_id
from src.data.db import SessionLocal
from src.data.models import AAConsent, TransactionSuggestion

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/aa", tags=["account-aggregator"])

# ── Setu sandbox credentials ──────────────────────────────────────────────────
SETU_BASE              = os.getenv("SETU_BASE_URL", "https://fiu-uat.setu.co")
SETU_CLIENT_ID         = os.getenv("SETU_CLIENT_ID", "2dd0d642-a86b-4efa-9ef7-3a719fef3231")
SETU_CLIENT_SECRET     = os.getenv("SETU_CLIENT_SECRET", "jIQ4frbPdsZDwd1kJgmbImtHfODkHZrg")
SETU_PRODUCT_ID        = os.getenv("SETU_PRODUCT_INSTANCE_ID", "6ca28222-9906-437c-89e7-505ccaf55d2b")
APP_REDIRECT_URL       = os.getenv("APP_URL", "https://finbuddy-nine.vercel.app")

_token_cache: dict = {}  # {"token": ..., "expires_at": float}


def _setu_token() -> str:
    """Get a cached Setu bearer token (auto-refreshes on expiry)."""
    if _token_cache.get("token") and time.time() < _token_cache.get("expires_at", 0):
        return _token_cache["token"]
    creds = base64.b64encode(f"{SETU_CLIENT_ID}:{SETU_CLIENT_SECRET}".encode()).decode()
    r = httpx.post(
        f"{SETU_BASE}/v2/auth/token",
        headers={
            "Authorization": f"Basic {creds}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"grant_type": "client_credentials"},
        timeout=10,
    )
    r.raise_for_status()
    data = r.json()
    _token_cache["token"] = data["accessToken"]
    _token_cache["expires_at"] = time.time() + int(data.get("expiresIn", 3600)) - 60
    return _token_cache["token"]


def _setu_headers() -> dict:
    return {
        "Authorization": f"Bearer {_setu_token()}",
        "x-product-instance-id": SETU_PRODUCT_ID,
        "Content-Type": "application/json",
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_fi_xml(xml_str: str) -> list[dict]:
    """Parse Setu FIXML and return list of raw transaction dicts."""
    txns = []
    try:
        root = ET.fromstring(xml_str)
        # Strip namespace prefix if present
        ns = root.tag.split("}")[0] + "}" if "}" in root.tag else ""
        for txn in root.iter(f"{ns}Transaction"):
            t_type = txn.get("type", "DEBIT")  # DEBIT | CREDIT
            amount_str = txn.get("amount", "0")
            narration = txn.get("narration", "").strip()
            date_raw = txn.get("valueDate") or txn.get("transactionTimestamp", "")
            date = date_raw[:10] if date_raw else None
            txns.append({
                "narration": narration,
                "amount": float(amount_str or 0),
                "date": date,
                "credit": t_type == "CREDIT",
                "reference": txn.get("txnId", ""),
            })
    except Exception as exc:
        logger.warning("FIXML parse error: %s", exc)
    return txns


def _ingest_setu_transactions(txn_list: list[dict], user_id: int | None) -> int:
    """Run each transaction narration through AI and save as pending suggestions."""
    from api.routers.suggestions import _parse_raw

    count = 0
    with SessionLocal() as session:
        for t in txn_list:
            narration = t["narration"] or f"₹{t['amount']} transaction"
            raw_text = f"₹{t['amount']} - {narration}"
            parsed = _parse_raw(raw_text)
            # CREDIT transactions are income unless AI says otherwise
            tx_type = parsed.get("tx_type", "income" if t["credit"] else "expense")
            suggestion = TransactionSuggestion(
                user_id=user_id,
                source="setu",
                raw_text=raw_text,
                merchant=parsed.get("merchant") or narration[:80],
                amount=float(parsed.get("amount") or t["amount"]),
                currency=parsed.get("currency", "INR"),
                date=parsed.get("date") or t["date"],
                category=parsed.get("category"),
                tx_type=tx_type,
                status="pending",
            )
            session.add(suggestion)
            count += 1
        session.commit()
    return count


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/initiate")
def initiate_consent(
    body: dict,
    user_id: int | None = Depends(get_optional_user_id),
):
    """
    Create a Setu consent request for the given phone number.
    Returns { consent_handle, redirect_url }.
    """
    phone = str(body.get("phone", "")).strip().lstrip("+91").lstrip("91")
    if len(phone) != 10 or not phone.isdigit():
        raise HTTPException(400, "Provide a valid 10-digit Indian mobile number")

    now = datetime.now(timezone.utc)
    payload = {
        "redirectUrl": f"{APP_REDIRECT_URL}/inbox",
        "vua": f"{phone}@onemoney",
        "consentDuration": {"unit": "MONTH", "value": 12},
        "dataRange": {
            "from": (now - timedelta(days=730)).strftime("%Y-%m-%dT00:00:00.000Z"),
            "to": now.strftime("%Y-%m-%dT23:59:59.000Z"),
        },
        "consentTypes": ["TRANSACTIONS"],
        "fiTypes": ["DEPOSIT"],
        "purpose": {
            "code": "102",
            "text": "Customer spending and budget analysis",
        },
    }

    try:
        r = httpx.post(
            f"{SETU_BASE}/v2/consents",
            headers=_setu_headers(),
            json=payload,
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
    except httpx.HTTPStatusError as exc:
        logger.error("Setu consent creation failed: %s %s", exc.response.status_code, exc.response.text)
        raise HTTPException(502, f"Setu error: {exc.response.text[:200]}")
    except Exception as exc:
        raise HTTPException(502, f"Setu unreachable: {exc}")

    handle = data.get("id") or data.get("consentHandle")
    setu_url = data.get("url") or data.get("redirectUrl")
    if not handle:
        raise HTTPException(502, f"Unexpected Setu response: {data}")

    # Persist consent record
    with SessionLocal() as session:
        existing = session.execute(
            select(AAConsent).where(AAConsent.consent_handle == handle)
        ).scalar_one_or_none()
        if not existing:
            session.add(AAConsent(
                user_id=user_id,
                consent_handle=handle,
                phone=phone,
                status="PENDING",
                setu_redirect_url=setu_url,
            ))
            session.commit()

    return {"consent_handle": handle, "redirect_url": setu_url}


@router.post("/callback")
def setu_callback(body: dict):
    """
    Setu webhook — receives consent status updates and data-ready notifications.
    Must return 200 quickly; heavy work deferred.
    """
    event_type = body.get("type", "")
    handle = body.get("consentHandle") or body.get("consentId", "")
    status = body.get("status", "")
    consent_id = body.get("consentId")

    logger.info("Setu callback: type=%s handle=%s status=%s", event_type, handle, status)

    if handle:
        with SessionLocal() as session:
            row = session.execute(
                select(AAConsent).where(AAConsent.consent_handle == handle)
            ).scalar_one_or_none()
            if row:
                if status:
                    row.status = status
                if consent_id and not row.consent_id:
                    row.consent_id = consent_id
                session.commit()

    return {"status": "ok"}


@router.post("/fetch/{consent_handle}")
def fetch_data(
    consent_handle: str,
    user_id: int | None = Depends(get_optional_user_id),
):
    """
    Create a Setu data session for an ACTIVE consent, poll for data,
    parse FIXML transactions and ingest as pending suggestions.
    """
    with SessionLocal() as session:
        row = session.execute(
            select(AAConsent).where(AAConsent.consent_handle == consent_handle)
        ).scalar_one_or_none()
        if not row:
            raise HTTPException(404, "Consent not found")

        # Refresh consent status from Setu
        try:
            sr = httpx.get(
                f"{SETU_BASE}/v2/consents/{consent_handle}",
                headers=_setu_headers(),
                timeout=15,
            )
            sr.raise_for_status()
            sdata = sr.json()
            row.status = sdata.get("status", row.status)
            row.consent_id = sdata.get("id") or row.consent_id
            session.commit()
        except Exception as exc:
            logger.warning("Could not refresh consent status: %s", exc)

        if row.status not in ("ACTIVE", "active"):
            raise HTTPException(409, f"Consent is {row.status} — user must approve first")

        consent_id = row.consent_id
        uid = row.user_id or user_id
        now = datetime.now(timezone.utc)
        data_from = (now - timedelta(days=730)).strftime("%Y-%m-%dT00:00:00.000Z")
        data_to = now.strftime("%Y-%m-%dT23:59:59.000Z")

    # Create data session
    try:
        sr = httpx.post(
            f"{SETU_BASE}/v2/sessions",
            headers=_setu_headers(),
            json={
                "consentId": consent_id,
                "from": data_from,
                "to": data_to,
                "fiTypes": ["DEPOSIT"],
            },
            timeout=15,
        )
        sr.raise_for_status()
        session_data = sr.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, f"Setu session creation failed: {exc.response.text[:200]}")

    session_id = session_data.get("id")
    if not session_id:
        raise HTTPException(502, "No session ID from Setu")

    # Poll for data (max 10 attempts, 3s apart)
    fi_data = None
    for attempt in range(10):
        time.sleep(3)
        try:
            gr = httpx.get(
                f"{SETU_BASE}/v2/sessions/{session_id}",
                headers=_setu_headers(),
                timeout=15,
            )
            gr.raise_for_status()
            gd = gr.json()
            if gd.get("status") in ("COMPLETED", "PARTIAL"):
                fi_data = gd
                break
            if gd.get("status") == "FAILED":
                raise HTTPException(502, "Setu data session failed")
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Poll attempt %d failed: %s", attempt, exc)

    if not fi_data:
        raise HTTPException(504, "Timed out waiting for Setu data — try again in a moment")

    # Parse FIXML and ingest transactions
    all_txns: list[dict] = []
    for fip in fi_data.get("payload", []):
        for acct in fip.get("data", []):
            xml_str = acct.get("decryptedFI", "")
            if xml_str:
                all_txns.extend(_parse_fi_xml(xml_str))

    ingested = _ingest_setu_transactions(all_txns, uid)

    # Update last_fetched_at
    with SessionLocal() as session:
        row = session.execute(
            select(AAConsent).where(AAConsent.consent_handle == consent_handle)
        ).scalar_one_or_none()
        if row:
            row.last_fetched_at = datetime.utcnow()
            session.commit()

    return {"status": "ok", "transactions_found": len(all_txns), "suggestions_created": ingested}


@router.get("/consents")
def list_consents(user_id: int | None = Depends(get_optional_user_id)):
    """Return all AA consents for the current user."""
    with SessionLocal() as session:
        q = select(AAConsent).order_by(AAConsent.created_at.desc())
        if user_id:
            q = q.where(AAConsent.user_id == user_id)
        rows = session.execute(q).scalars().all()
        return [
            {
                "id": r.id,
                "consent_handle": r.consent_handle,
                "phone": f"XXXXXX{r.phone[-4:]}",
                "status": r.status,
                "last_fetched_at": r.last_fetched_at.isoformat() if r.last_fetched_at else None,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]


@router.delete("/consents/{consent_handle}")
def revoke_consent(
    consent_handle: str,
    user_id: int | None = Depends(get_optional_user_id),
):
    """Mark consent revoked locally (user should also revoke via AA app)."""
    with SessionLocal() as session:
        row = session.execute(
            select(AAConsent).where(AAConsent.consent_handle == consent_handle)
        ).scalar_one_or_none()
        if not row:
            raise HTTPException(404, "Consent not found")
        row.status = "REVOKED"
        session.commit()
    return {"status": "revoked"}
