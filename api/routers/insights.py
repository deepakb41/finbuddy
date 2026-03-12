from __future__ import annotations

import calendar
import json
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from api.deps import get_current_user_id
from src.insights.summaries import (
    total_spend,
    monthly_trend,
    monthly_spend_by_category,
    category_comparison,
    top_merchants,
    budget_vs_actual,
    savings_rate,
    spending_trend_direction,
    recent_transactions,
)

router = APIRouter(prefix="/insights", tags=["insights"])


def _uid_clause(user_id: int) -> str:
    return "AND user_id = :uid"


@router.get("/latest-month")
def get_latest_month(user_id: int = Depends(get_current_user_id)):
    from sqlalchemy import text
    from src.data.db import engine
    sql = text("""
        SELECT strftime('%Y-%m', date) as m
        FROM transactions
        WHERE status != 'deleted'
          AND user_id = :uid
        ORDER BY date DESC
        LIMIT 1
    """)
    with engine.connect() as conn:
        row = conn.execute(sql, {"uid": user_id}).fetchone()
    fallback = date.today().strftime("%Y-%m")
    return {"month": row[0] if row else fallback}


@router.get("/summary")
def get_summary(
    month: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    alltime: Optional[str] = Query(None),
    user_id: int = Depends(get_current_user_id),
):
    from sqlalchemy import text as _t
    from src.data.db import engine as _e

    if alltime is not None or (not month and not year and alltime == "1"):
        with _e.connect() as conn:
            row = conn.execute(_t("""
                SELECT SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),
                       SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), COUNT(*)
                FROM transactions WHERE status != 'deleted' AND user_id = :uid
            """), {"uid": user_id}).fetchone()
            months_row = conn.execute(_t("""
                SELECT COUNT(DISTINCT strftime('%Y-%m', date))
                FROM transactions WHERE status != 'deleted' AND user_id = :uid
            """), {"uid": user_id}).fetchone()
        expense = float(row[0] or 0); income = float(row[1] or 0); tx_count = int(row[2] or 0)
        n_months = int(months_row[0] or 1)
        rate = round((income - expense) / income, 4) if income > 0 else 0.0
        return {"total_expense": expense, "total_income": income, "tx_count": tx_count,
                "savings_rate": rate, "projected_month_end": round(expense / n_months, 2),
                "days_elapsed": n_months * 30, "days_in_month": n_months * 30,
                "tx_count_last_month": 0}

    if year and not month:
        with _e.connect() as conn:
            row = conn.execute(_t("""
                SELECT SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),
                       SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), COUNT(*)
                FROM transactions
                WHERE strftime('%Y', date) = :y AND status != 'deleted' AND user_id = :uid
            """), {"y": year, "uid": user_id}).fetchone()
        expense = float(row[0] or 0); income = float(row[1] or 0); tx_count = int(row[2] or 0)
        rate = round((income - expense) / income, 4) if income > 0 else 0.0
        return {"total_expense": expense, "total_income": income, "tx_count": tx_count,
                "savings_rate": rate, "projected_month_end": expense, "days_elapsed": 365, "days_in_month": 365,
                "tx_count_last_month": 0}

    row = total_spend(month, user_id=user_id)
    expense = float(row[0] or 0)
    income = float(row[1] or 0)
    tx_count = int(row[2] or 0)
    rate = savings_rate(month, user_id=user_id)

    today = date.today()

    from datetime import datetime as _dt
    import datetime as _datetime_mod
    _active_month = month if month else today.strftime("%Y-%m")
    is_current_month = (_active_month == today.strftime("%Y-%m"))
    _ay, _am = map(int, _active_month.split("-"))
    days_in_month = calendar.monthrange(_ay, _am)[1]

    if is_current_month:
        day_of_month = today.day
        projected_expense = round((expense / day_of_month) * days_in_month, 2) if day_of_month > 0 else expense
    else:
        day_of_month = days_in_month
        projected_expense = 0

    _prev_d = _dt(_ay, _am, 1) - _datetime_mod.timedelta(days=1)
    _prev_month = _prev_d.strftime("%Y-%m")

    from sqlalchemy import text as _t2
    from src.data.db import engine as _e2
    with _e2.connect() as _conn:
        _prev_row = _conn.execute(_t2("""
            SELECT COUNT(*) FROM transactions
            WHERE strftime('%Y-%m', date) = :prev_month AND status != 'deleted' AND user_id = :uid
        """), {"prev_month": _prev_month, "uid": user_id}).fetchone()
        _prev_expense_row = _conn.execute(_t2("""
            SELECT SUM(amount) FROM transactions
            WHERE strftime('%Y-%m', date) = :m AND type='expense'
              AND status != 'deleted' AND user_id = :uid
        """), {"m": _prev_month, "uid": user_id}).fetchone()
    tx_count_last_month = int(_prev_row[0] or 0) if _prev_row else 0
    last_month_expense = float(_prev_expense_row[0] or 0) if _prev_expense_row else 0.0

    return {
        "total_expense": expense,
        "total_income": income,
        "tx_count": tx_count,
        "savings_rate": rate,
        "projected_month_end": projected_expense,
        "days_elapsed": day_of_month,
        "days_in_month": days_in_month,
        "tx_count_last_month": tx_count_last_month,
        "last_month_expense": last_month_expense,
    }


@router.get("/monthly-trend")
def get_monthly_trend(
    n_months: int = Query(6, ge=1, le=24),
    user_id: int = Depends(get_current_user_id),
):
    rows = monthly_trend(n_months, user_id=user_id)
    return [
        {"month": str(r[0]), "category": r[1], "total": float(r[2])}
        for r in rows
    ]


@router.get("/categories")
def get_categories(
    month: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    alltime: Optional[str] = Query(None),
    user_id: int = Depends(get_current_user_id),
):
    from sqlalchemy import text as _t
    from src.data.db import engine as _e

    if alltime is not None:
        with _e.connect() as conn:
            rows = conn.execute(_t("""
                SELECT category, SUM(amount) as total
                FROM transactions
                WHERE type='expense' AND status!='deleted' AND user_id = :uid
                GROUP BY category ORDER BY total DESC
            """), {"uid": user_id}).fetchall()
        return [{"category": r[0], "this_month": float(r[1] or 0), "last_month": 0.0} for r in rows]

    if year and not month:
        with _e.connect() as conn:
            rows = conn.execute(_t("""
                SELECT category, SUM(amount) as total
                FROM transactions
                WHERE type='expense' AND strftime('%Y',date)=:y
                  AND status!='deleted' AND user_id = :uid
                GROUP BY category ORDER BY total DESC
            """), {"y": year, "uid": user_id}).fetchall()
        return [{"category": r[0], "this_month": float(r[1] or 0), "last_month": 0.0} for r in rows]

    rows = category_comparison(user_id=user_id)
    return [
        {"category": r[0], "this_month": float(r[1] or 0), "last_month": float(r[2] or 0)}
        for r in rows
    ]


_forecast_cache: dict = {}


@router.get("/forecast")
def get_forecast(user_id: int = Depends(get_current_user_id)):
    """AI-powered 3-month spending forecast using Groq. Cached 24 hours per user."""
    import time
    from sqlalchemy import text as _t
    from src.data.db import engine as _e
    from src.llm.client import chat

    cached = _forecast_cache.get(user_id)
    if cached and time.time() - cached[0] < 86400:
        return cached[1]

    with _e.connect() as conn:
        history_rows = conn.execute(_t("""
            SELECT strftime('%Y-%m', date) as month, SUM(amount) as total
            FROM transactions
            WHERE type='expense' AND status!='deleted' AND user_id = :uid
            GROUP BY month ORDER BY month ASC
        """), {"uid": user_id}).fetchall()

    history = [{"month": str(r[0]), "total": round(float(r[1] or 0), 2)} for r in history_rows]

    if len(history) < 2:
        return {"history": history, "forecast": [], "trend": "stable", "insight": "Not enough data to forecast yet."}

    from datetime import datetime
    last_month = history[-1]["month"]
    y, m = map(int, last_month.split("-"))
    next_months = []
    for i in range(1, 4):
        nm = m + i
        ny = y + (nm - 1) // 12
        nm = ((nm - 1) % 12) + 1
        next_months.append(f"{ny}-{nm:02d}")

    history_text = "\n".join(f"  {h['month']}: ₹{h['total']:,.0f}" for h in history[-24:])
    prompt = (
        f"Monthly expense history (last 24 months):\n{history_text}\n\n"
        f"Predict total expenses for the next 3 months: {', '.join(next_months)}.\n"
        f"Use same-month-prior-year values as anchors where available. "
        f"Consider Indian seasonal patterns (festivals in Oct-Nov, travel in Dec-Jan, summer in Apr-May).\n"
        f"Return ONLY valid JSON: "
        f'{{\"forecast\":[{{\"month\":\"YYYY-MM\",\"total\":number}},...], '
        f'\"trend\":\"increasing\"|\"stable\"|\"decreasing\", '
        f'\"insight\":\"one sentence\"}}'
    )
    messages = [
        {
            "role": "system",
            "content": (
                "You are a financial forecasting assistant for an Indian professional. "
                "Analyze the ₹ expense history and forecast the next 3 months. "
                "Account for Indian seasonal patterns: festival shopping in Oct-Nov, "
                "travel spikes in Dec-Jan and May-Jun, year-end financial activity in Mar. "
                "Return ONLY valid JSON, no markdown, no explanation outside the JSON."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    try:
        raw = chat(messages, max_tokens=300)
        import re
        raw = re.sub(r"```[a-z]*", "", raw).strip()
        parsed = json.loads(raw)
        result = {
            "history": history,
            "forecast": parsed.get("forecast", []),
            "trend": parsed.get("trend", "stable"),
            "insight": parsed.get("insight", ""),
        }
    except Exception as exc:
        avg = sum(h["total"] for h in history[-6:]) / min(6, len(history))
        result = {
            "history": history,
            "forecast": [{"month": m, "total": round(avg, 2)} for m in next_months],
            "trend": "stable",
            "insight": f"Forecast based on recent average (AI unavailable: {exc})",
        }

    _forecast_cache[user_id] = (time.time(), result)
    return result


@router.get("/top-merchants")
def get_top_merchants(
    month: Optional[str] = Query(None),
    user_id: int = Depends(get_current_user_id),
):
    rows = top_merchants(month, user_id=user_id)
    return [
        {"merchant": r[0], "total": float(r[1]), "tx_count": int(r[2])}
        for r in rows
    ]


@router.get("/budget")
def get_budget(
    month: Optional[str] = Query(None),
    user_id: int = Depends(get_current_user_id),
):
    return budget_vs_actual(month, user_id=user_id)


@router.get("/health-score")
def get_health_score(
    month: Optional[str] = Query(None),
    user_id: int = Depends(get_current_user_id),
):
    from sqlalchemy import text as _ht
    from src.data.db import engine as _he
    with _he.connect() as _hc:
        _total = _hc.execute(_ht(
            "SELECT COUNT(*) FROM transactions WHERE status != 'deleted' AND user_id = :uid"
        ), {"uid": user_id}).fetchone()
    if not _total or (_total[0] or 0) == 0:
        return {"score": 0, "breakdown": {}}

    score = 0
    breakdown = {}

    rate = savings_rate(month, user_id=user_id)
    savings_pts = min(25, round((rate / 0.20) * 25))
    score += savings_pts
    breakdown["savings_rate"] = {"score": savings_pts, "value": rate}

    budget_rows = budget_vs_actual(month, user_id=user_id)
    overruns = [r for r in budget_rows if r["pct_used"] > 1.0]
    adherence_pts = max(0, 25 - len(overruns) * 8) if budget_rows else 12
    score += adherence_pts
    breakdown["budget_adherence"] = {"score": adherence_pts, "overruns": len(overruns)}

    trend = spending_trend_direction(3, user_id=user_id)
    trend_pts = 25 if trend <= 0 else (20 if trend < 0.10 else (15 if trend < 0.20 else (10 if trend < 0.30 else 5)))
    score += trend_pts
    breakdown["spending_trend"] = {"score": trend_pts, "value": trend}

    row = total_spend(month, user_id=user_id)
    tx_count = int(row[2] or 0)
    completeness_pts = min(25, round((tx_count / 10) * 25))
    score += completeness_pts
    breakdown["data_completeness"] = {"score": completeness_pts, "tx_count": tx_count}

    total_score = min(100, score)

    try:
        from src.llm.client import chat
        import re as _re
        ai_prompt = (
            f"Financial health breakdown for an Indian user:\n"
            f"- Savings rate score: {savings_pts}/25 (actual rate: {rate*100:.0f}%)\n"
            f"- Budget adherence: {adherence_pts}/25 ({len(overruns)} categories overrun)\n"
            f"- Spending trend: {trend_pts}/25 (trend: {trend*100:+.0f}% change)\n"
            f"- Data completeness: {completeness_pts}/25 ({tx_count} transactions this month)\n\n"
            f"For each of the 4 sub-scores, write a 1-line actionable tip (max 12 words) in second person.\n"
            f'Return JSON: {{"savings_rate":"tip","budget_adherence":"tip","spending_trend":"tip","data_completeness":"tip"}}'
        )
        ai_raw = chat(
            [
                {"role": "system", "content": "Return only valid JSON, no markdown."},
                {"role": "user", "content": ai_prompt},
            ],
            max_tokens=200,
            temperature=0.3,
        )
        ai_tips = json.loads(_re.sub(r"```[a-z]*|```", "", ai_raw).strip())
        for key in breakdown:
            breakdown[key]["tip"] = ai_tips.get(key, "")
    except Exception:
        pass

    return {"score": total_score, "breakdown": breakdown}


# ── AI endpoints ──────────────────────────────────────────────────────────────

_summary_cache: dict = {}


@router.get("/ai-summary")
def get_ai_summary(
    month: Optional[str] = Query(None),
    user_id: int = Depends(get_current_user_id),
):
    """Groq-generated bullet-point summary of recent spending. Cached 1 hour."""
    import time
    from src.llm.client import chat

    cache_key = (user_id, month or "current")
    cached = _summary_cache.get(cache_key)
    if cached and time.time() - cached[0] < 3600:
        return {"summary": cached[1], "cached": True}

    trend_rows = monthly_trend(3, user_id=user_id)
    cat_rows = category_comparison(user_id=user_id)

    trend_text = "\n".join(
        f"  {str(r[0])} | {r[1]}: ₹{float(r[2]):.0f}"
        for r in trend_rows
    ) or "  No data"

    cat_text = "\n".join(
        f"  {r[0]}: this month ₹{float(r[1] or 0):.0f}, last month ₹{float(r[2] or 0):.0f}"
        for r in cat_rows
    ) or "  No data"

    totals = total_spend(month, user_id=user_id)
    expense = float(totals[0] or 0)
    income = float(totals[1] or 0)

    messages = [
        {
            "role": "system",
            "content": (
                "You are a personal finance advisor reviewing an Indian professional's monthly spending. "
                "Give exactly 3-5 bullet-point insights. Rules:\n"
                "- Always use ₹ for amounts (same currency as the data)\n"
                "- Flag any category that increased >20% vs last month\n"
                "- Highlight if savings rate is below 20% (unhealthy) or above 30% (great)\n"
                "- Note the top 2 expense categories and whether they seem high\n"
                "- Keep each bullet under 25 words\n"
                "- Start each bullet with '• '\n"
                "- Do NOT give generic advice — refer to actual numbers from the data"
            ),
        },
        {
            "role": "user",
            "content": (
                f"Monthly trend (last 3 months):\n{trend_text}\n\n"
                f"Category comparison (this vs last month):\n{cat_text}\n\n"
                f"This month: expenses=₹{expense:.0f}, income=₹{income:.0f}"
            ),
        },
    ]

    try:
        result = chat(messages, max_tokens=400)
        _summary_cache[cache_key] = (time.time(), result)
        return {"summary": result, "cached": False}
    except Exception as exc:
        return {"summary": f"AI summary unavailable: {exc}", "cached": False}


@router.post("/ask")
def ask_finances(
    body: dict,
    user_id: int = Depends(get_current_user_id),
):
    """Answer a natural language question about the user's finances."""
    from src.llm.client import chat

    question = str(body.get("question", "")).strip()
    if not question:
        return {"answer": "Please ask a question."}

    rows = recent_transactions(limit=50, user_id=user_id)
    tx_list = [
        {
            "date": str(r[1]),
            "merchant": r[3] or r[2],
            "amount": float(r[4]),
            "type": r[6],
            "category": r[7] or "Uncategorized",
        }
        for r in rows
    ]

    messages = [
        {
            "role": "system",
            "content": (
                "You are a personal finance assistant for an Indian professional. "
                "Answer ONLY questions about the user's personal finances and transactions. "
                "Always use ₹ symbol for amounts (matching the data currency). "
                "Be specific: quote actual figures, dates, and merchant names from the data. "
                "If asked something outside personal finance, politely decline and redirect. "
                "Keep answers concise — 2-4 sentences max unless a breakdown is explicitly requested."
            ),
        },
        {
            "role": "user",
            "content": (
                f"User's currency: ₹ (Indian Rupees). All amounts below are in ₹.\n\n"
                f"Recent transactions:\n{json.dumps(tx_list, indent=2)}\n\n"
                f"Question: {question}"
            ),
        },
    ]

    try:
        return {"answer": chat(messages, max_tokens=500)}
    except Exception as exc:
        return {"answer": f"Could not answer: {exc}"}
