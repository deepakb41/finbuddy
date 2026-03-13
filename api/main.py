from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env FIRST — before any module-level os.getenv() calls in routers/deps
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from api.routers import transactions, insights, voice, budgets
from api.routers import auth, suggestions, aa, profile
from src.data.db import Base, engine

# Create all tables (including new User, TransactionSuggestion)
Base.metadata.create_all(bind=engine)

# Clear seed data if requested (set CLEAR_SEED_DATA=true in .env once to wipe)
if os.getenv("CLEAR_SEED_DATA", "").lower() == "true":
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM transactions"))
        conn.execute(text("DELETE FROM budgets"))
        conn.commit()

app = FastAPI(
    title="FinBuddy API",
    description="Personal finance tracker backend",
    version="2.0.0",
    docs_url=None,  # override below with custom favicon
)

from fastapi.openapi.docs import get_swagger_ui_html

@app.get("/docs", include_in_schema=False)
def custom_docs():
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title="FinBuddy API",
        swagger_favicon_url="/static/logo.png",
    )

app.mount("/static", StaticFiles(directory="api/static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,         prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(insights.router,     prefix="/api")
app.include_router(voice.router,        prefix="/api")
app.include_router(budgets.router,      prefix="/api")
app.include_router(suggestions.router,  prefix="/api")
app.include_router(aa.router,           prefix="/api")
app.include_router(profile.router,      prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "finbuddy-api"}
