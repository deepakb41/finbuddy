from pathlib import Path
import yaml

def load_category_rules(path: str) -> dict:
    return yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}

def map_category(merchant_normalized: str, tx_type: str, existing_category: str | None, rules: dict) -> str:
    if existing_category and str(existing_category).strip():
        return str(existing_category).strip()

    merchant = (merchant_normalized or "").strip()

    for rule in rules.get("rules", []):
        if merchant in (rule.get("merchants", []) or []):
            return rule.get("category", "Uncategorized")

    return (rules.get("fallback", {}) or {}).get(tx_type, "Uncategorized")
