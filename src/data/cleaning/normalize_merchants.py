import re
from pathlib import Path
import yaml

def _clean(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9\s&'-]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def load_aliases(path: str) -> dict[str, list[str]]:
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}
    return {str(k): (v or []) for k, v in data.items()}

def normalize_merchant(merchant_raw: str, aliases: dict[str, list[str]]) -> str:
    raw_clean = _clean(merchant_raw)

    for canonical, alist in aliases.items():
        for a in alist:
            a_clean = _clean(a)
            if a_clean and (a_clean in raw_clean or raw_clean == a_clean):
                return canonical

    return " ".join(w.capitalize() for w in raw_clean.split()) if raw_clean else ""
