from __future__ import annotations

import io

from fastapi import APIRouter, HTTPException, UploadFile, File
from src.data.loaders.csv_loader import load_csv
from src.data.pipeline import standardize_df, enrich_df, upsert_transactions

router = APIRouter(prefix="/import", tags=["imports"])

_ALIASES = "config/merchants_aliases.yml"
_RULES = "config/category_rules.yml"


@router.post("/csv")
async def import_csv(file: UploadFile = File(...)):
    """Upload a bank CSV export and import transactions."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")

    contents = await file.read()
    try:
        raw_df = load_csv(io.BytesIO(contents))
        std_df = standardize_df(raw_df)
        enriched_df = enrich_df(std_df, _ALIASES, _RULES)
        count = upsert_transactions(enriched_df)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse CSV: {e}")

    return {"imported": count, "filename": file.filename}


@router.post("/pdf")
async def import_pdf(file: UploadFile = File(...)):
    """Upload a bank PDF statement and import transactions."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf files are accepted")

    try:
        from src.data.loaders.pdf_loader import load_pdf
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="PDF parsing requires 'pdfplumber'. Run: pip install pdfplumber",
        )

    contents = await file.read()
    try:
        raw_df = load_pdf(io.BytesIO(contents))
        std_df = standardize_df(raw_df)
        enriched_df = enrich_df(std_df, _ALIASES, _RULES)
        count = upsert_transactions(enriched_df)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse PDF: {e}")

    return {"imported": count, "filename": file.filename}
