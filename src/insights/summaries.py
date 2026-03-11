from __future__ import annotations
from sqlalchemy import text
from src.data.db import engine


def monthly_spend_by_category():
    """Total spend per category per month (all time), for backward compat."""
    sql = text("""
        SELECT
          date as month,
          category,
          SUM(amount) as total_amount
        FROM transactions
        WHERE type = 'expense'
        GROUP BY date, category
        ORDER BY date DESC, total_amount DESC
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql).fetchall()
    return rows


def monthly_trend(n_months: int = 6):
    """Spend per category per month for the last n_months months."""
    sql = text("""
        SELECT
          date as month,
          category,
          SUM(amount) as total_amount
        FROM transactions
        WHERE type = 'expense'
          AND date >= date('now', :offset)
        GROUP BY date, category
        ORDER BY date ASC, total_amount DESC
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"offset": f"-{n_months} months"}).fetchall()
    return rows


def top_merchants(month: str | None = None):
    """Top 10 merchants by spend for a given month (default: current month)."""
    if month:
        where = "AND strftime('%Y-%m', date) = :month"
        params: dict = {"month": month}
    else:
        where = "AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')"
        params = {}
    sql = text(f"""
        SELECT
          COALESCE(merchant_normalized, merchant_raw) as merchant,
          SUM(amount) as total_amount,
          COUNT(*) as tx_count
        FROM transactions
        WHERE type = 'expense'
          {where}
        GROUP BY merchant
        ORDER BY total_amount DESC
        LIMIT 10
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return rows


def category_comparison():
    """
    Month-over-month spend comparison per category.
    Returns (category, this_month, last_month) for all categories
    that appear in either month.
    """
    sql = text("""
        SELECT
          category,
          SUM(CASE WHEN strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
                   THEN amount ELSE 0 END) as this_month,
          SUM(CASE WHEN strftime('%Y-%m', date) = strftime('%Y-%m', date('now', '-1 month'))
                   THEN amount ELSE 0 END) as last_month
        FROM transactions
        WHERE type = 'expense'
          AND date >= date('now', '-2 months')
        GROUP BY category
        ORDER BY this_month DESC
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql).fetchall()
    return rows


def total_spend(month: str | None = None):
    """
    Returns (total_expense, total_income, tx_count) for a month.
    Defaults to current month.
    """
    if month:
        where = "strftime('%Y-%m', date) = :month"
        params: dict = {"month": month}
    else:
        where = "strftime('%Y-%m', date) = strftime('%Y-%m', 'now')"
        params = {}
    sql = text(f"""
        SELECT
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
          COUNT(*) as tx_count
        FROM transactions
        WHERE {where}
    """)
    with engine.connect() as conn:
        row = conn.execute(sql, params).fetchone()
    return row


def recent_transactions(limit: int = 200):
    """Most recent transactions, newest first."""
    sql = text("""
        SELECT
          transaction_id, date, merchant_raw, merchant_normalized,
          amount, currency, type, category, notes, status
        FROM transactions
        ORDER BY date DESC, id DESC
        LIMIT :limit
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"limit": limit}).fetchall()
    return rows


def known_merchants(limit: int = 100) -> list[str]:
    """Top merchants by frequency for autocomplete suggestions."""
    sql = text("""
        SELECT
          COALESCE(merchant_normalized, merchant_raw) as merchant,
          COUNT(*) as freq
        FROM transactions
        GROUP BY merchant
        ORDER BY freq DESC
        LIMIT :limit
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"limit": limit}).fetchall()
    return [r[0] for r in rows if r[0]]


def budget_vs_actual(month: str | None = None) -> list[dict]:
    """Budget vs actual spend per category for a given month (default: current)."""
    from src.data.db import SessionLocal
    from src.data.models import Budget

    month_filter = month or "strftime('%Y-%m', 'now')"

    spend_sql = text(f"""
        SELECT category, SUM(amount) as spent
        FROM transactions
        WHERE type = 'expense'
          AND strftime('%Y-%m', date) = {
            ':month' if month else "strftime('%Y-%m', 'now')"
          }
        GROUP BY category
    """)
    params = {"month": month} if month else {}

    with engine.connect() as conn:
        spend_rows = conn.execute(spend_sql, params).fetchall()

    spent_map = {r[0]: float(r[1]) for r in spend_rows}

    with SessionLocal() as session:
        budgets = session.execute(
            __import__("sqlalchemy", fromlist=["select"]).select(Budget)
        ).scalars().all()

    result = []
    for b in budgets:
        spent = spent_map.get(b.category, 0.0)
        limit = float(b.monthly_limit)
        result.append({
            "category": b.category,
            "budget": limit,
            "spent": spent,
            "currency": b.currency,
            "pct_used": round(spent / limit, 4) if limit > 0 else 0.0,
        })

    return result


def savings_rate(month: str | None = None) -> float:
    """Returns savings rate as a fraction (0-1) for the given month."""
    row = total_spend(month)
    if not row or not row[1] or float(row[1]) == 0:
        return 0.0
    income = float(row[1])
    expense = float(row[0] or 0)
    return max(0.0, round((income - expense) / income, 4))


def spending_trend_direction(n_months: int = 3) -> float:
    """
    Returns the month-over-month spending change as a fraction.
    Positive = spending increased, negative = spending decreased.
    """
    sql = text("""
        SELECT
          strftime('%Y-%m', date) as month,
          SUM(amount) as total
        FROM transactions
        WHERE type = 'expense'
          AND date >= date('now', :offset)
        GROUP BY month
        ORDER BY month ASC
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"offset": f"-{n_months} months"}).fetchall()
    if len(rows) < 2:
        return 0.0
    prev = float(rows[-2][1] or 0)
    curr = float(rows[-1][1] or 0)
    if prev == 0:
        return 0.0
    return round((curr - prev) / prev, 4)
