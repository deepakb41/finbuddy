from __future__ import annotations

from pathlib import Path


def ensure_db_ready():
    Path("data").mkdir(parents=True, exist_ok=True)
    from src.data.db import Base, engine
    from src.data.models import Transaction  # noqa: F401
    Base.metadata.create_all(bind=engine)
