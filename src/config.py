import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel

PROJECT_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env")

def _req(name: str) -> str:
    v = os.getenv(name, "").strip()
    return v

class Settings(BaseModel):
    database_url: str = _req("DATABASE_URL") or "sqlite:///data/finance.db"

settings = Settings()
