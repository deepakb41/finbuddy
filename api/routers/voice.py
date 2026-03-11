from __future__ import annotations

import json
import logging
import os
import re

from fastapi import APIRouter, File, HTTPException, UploadFile

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])

_SYSTEM_PROMPT = """\
You are a transaction parser. Extract transaction details from natural language.
Return ONLY valid JSON, no explanation, no markdown:
{"amount": <number or null>, "merchant": <string or null>, "category": <string or null>, "tx_type": "expense"|"income"|"investment", "notes": <string or null>}

Category must be one of: Food & Dining, Groceries, Transport, Shopping, Entertainment, Travel, Rent, Utilities & Bills, Telecom, Healthcare, Fitness, Finance & EMI, Investments, Personal Care, Education, Other

Rules:
- For food delivery (Swiggy, Zomato) and restaurants → "Food & Dining"
- For electricity, water, gas, internet → "Utilities & Bills"
- For EMI, loan repayment, insurance → "Finance & EMI"
- For SIP, mutual funds, stocks → category "Investments", tx_type "investment"
- For salary, freelance income → tx_type "income", category "Other"
- Strip currency symbols (₹, Rs, rs) from amount; return as number

Examples:
"spent 300 on Swiggy" → {"amount": 300, "merchant": "Swiggy", "category": "Food & Dining", "tx_type": "expense", "notes": null}
"paid 450 at Zomato for lunch" → {"amount": 450, "merchant": "Zomato", "category": "Food & Dining", "tx_type": "expense", "notes": "lunch"}
"got salary 50000" → {"amount": 50000, "merchant": null, "category": "Other", "tx_type": "income", "notes": "salary"}
"paid 1200 electricity bill" → {"amount": 1200, "merchant": null, "category": "Utilities & Bills", "tx_type": "expense", "notes": "electricity bill"}
"uber 180" → {"amount": 180, "merchant": "Uber", "category": "Transport", "tx_type": "expense", "notes": null}
"invested 5000 in SIP" → {"amount": 5000, "merchant": null, "category": "Investments", "tx_type": "investment", "notes": "SIP"}
"""


def _parse_with_llm(text: str) -> dict:
    """Use Groq/OpenAI to parse natural language into a transaction dict."""
    from src.llm.client import chat
    raw = chat(
        [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        max_tokens=150,
        temperature=0,
    )
    # Strip markdown fences if present
    raw = re.sub(r"```(?:json)?|```", "", raw).strip()
    return json.loads(raw)


def _parse_fallback(text: str) -> dict:
    """Simple regex fallback when no LLM key is configured."""
    amount_match = re.search(r"[\₹\$\£]?\s*([\d,]+(?:\.\d{1,2})?)", text)
    amount = float(amount_match.group(1).replace(",", "")) if amount_match else None

    tx_type = "income" if re.search(r"\b(received|got|earned|salary|credited)\b", text, re.I) else "expense"

    return {
        "amount": amount,
        "merchant": None,
        "category": None,
        "tx_type": tx_type,
        "notes": text,
        "raw_text": text,
    }


@router.post("/parse")
def parse_voice(body: dict):
    """Parse natural language text into a transaction dict."""
    text = str(body.get("text", "")).strip()
    if not text:
        raise HTTPException(400, "text is required")

    try:
        parsed = _parse_with_llm(text)
    except Exception as exc:
        logger.warning("LLM parse failed (%s), using fallback", exc)
        parsed = _parse_fallback(text)

    parsed["raw_text"] = text
    return parsed


@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe audio via Groq Whisper (primary) or OpenAI Whisper (fallback)."""
    groq_key = os.getenv("GROQ_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    if not groq_key and not openai_key:
        raise HTTPException(503, "No transcription API key configured (set GROQ_API_KEY or OPENAI_API_KEY)")

    import io
    audio_bytes = await file.read()
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = file.filename or "recording.webm"

    if groq_key:
        from groq import Groq
        client = Groq(api_key=groq_key)
        transcript_resp = client.audio.transcriptions.create(
            model="whisper-large-v3-turbo",
            file=audio_file,
        )
    else:
        from openai import OpenAI
        client = OpenAI(api_key=openai_key)
        transcript_resp = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
        )
    transcript = transcript_resp.text

    try:
        parsed = _parse_with_llm(transcript)
    except Exception:
        parsed = _parse_fallback(transcript)

    parsed["raw_text"] = transcript
    return {"transcript": transcript, "parsed": parsed}
