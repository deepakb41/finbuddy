"""
Seed 3 years of realistic Indian single-person spending data for deepakbisht.1361@gmail.com.
Run from project root: .venv/bin/python scripts/seed_demo.py
"""
from __future__ import annotations

import random
import uuid
from datetime import date

# Add project root to path
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.data.db import Base, engine, SessionLocal
from src.data.models import Transaction

Base.metadata.create_all(bind=engine)

EMAIL = "deepakbisht.1361@gmail.com"

# ── helpers ────────────────────────────────────────────────────────────────────

def rnd(lo, hi):
    return round(random.uniform(lo, hi), 2)

def pick(seq):
    return random.choice(seq)

def rand_day(year, month, lo=1, hi=28):
    import calendar
    last = calendar.monthrange(year, month)[1]
    return random.randint(lo, min(hi, last))

# ── merchant templates ─────────────────────────────────────────────────────────

FOOD_DELIVERY = ["Swiggy", "Zomato", "EatSure", "Box8"]
GROCERIES = ["BigBasket", "Blinkit", "Zepto", "DMart", "Reliance Fresh", "JioMart"]
EATING_OUT = ["McDonald's", "Domino's", "KFC", "Pizza Hut", "CCD", "Starbucks",
              "Chaayos", "Haldiram's", "Barbeque Nation", "Local Dhaba"]
TRANSPORT = ["Ola", "Uber", "Rapido", "Metro Recharge", "IndiGo", "Air India",
             "SpiceJet", "IRCTC"]
STREAMING = [
    ("Netflix", "Entertainment", 649),
    ("Spotify", "Entertainment", 119),
    ("Hotstar", "Entertainment", 299),
    ("Amazon Prime", "Entertainment", 179),
]
TELECOM = [("Jio", "Telecom", 299), ("Airtel", "Telecom", 349)]
ELECTRICITY = [("Tata Power", "Utilities & Bills", rnd(800, 1800))]
SHOPPING = ["Amazon", "Flipkart", "Myntra", "Ajio", "Nykaa", "Pepperfry"]
HEALTHCARE = ["Apollo Pharmacy", "Practo", "1mg", "Netmeds", "Apollo Hospital"]
FITNESS = [("Cult.fit", "Fitness", 1500), ("Gym Membership", "Fitness", 1200)]
INVESTMENTS = [
    ("Zerodha", "Investments", 5000),
    ("Groww - Nifty 50 SIP", "Investments", 3000),
    ("ELSS SIP", "Investments", 2000),
]

# ── build transactions ─────────────────────────────────────────────────────────

def make_tx(d: date, merchant: str, amount: float, category: str, tx_type="expense", notes=None):
    return dict(
        transaction_id=str(uuid.uuid4()),
        date=d,
        merchant_raw=merchant,
        merchant_normalized=merchant,
        amount=amount,
        currency="INR",
        type=tx_type,
        category=category,
        notes=notes,
        status="new",
    )


def generate_month(year: int, month: int) -> list[dict]:
    txns = []
    is_festival = month in (10, 11)   # Diwali / Navratri season
    is_travel   = month in (12, 1)    # holiday season
    is_summer   = month in (4, 5)

    # Salary
    txns.append(make_tx(date(year, month, 1), "HDFC Bank - Salary", 80000, "Income", "income"))

    # Rent
    txns.append(make_tx(date(year, month, 1), "Rent Payment", 25000, "Rent"))

    # Finance/EMI
    txns.append(make_tx(date(year, month, 5), "Bajaj Finance EMI", 8000, "Finance & EMI"))

    # Investments (SIP)
    for name, cat, amt in INVESTMENTS:
        txns.append(make_tx(date(year, month, 7), name, amt, cat))

    # Telecom
    for name, cat, amt in TELECOM[:1]:  # just Jio
        txns.append(make_tx(date(year, month, rand_day(year, month, 3, 10)), name, amt, cat))

    # Electricity
    txns.append(make_tx(date(year, month, rand_day(year, month, 10, 20)),
                        "Tata Power", rnd(800, 1800), "Utilities & Bills"))

    # Streaming subscriptions
    for name, cat, amt in STREAMING[:2]:  # Netflix + Spotify
        txns.append(make_tx(date(year, month, rand_day(year, month, 1, 5)), name, amt, cat))

    # Fitness
    txns.append(make_tx(date(year, month, rand_day(year, month, 1, 7)),
                        "Cult.fit", 1500, "Fitness"))

    # Food delivery (8-14 per month)
    for _ in range(random.randint(8, 14)):
        merchant = pick(FOOD_DELIVERY)
        amt = rnd(180, 620)
        txns.append(make_tx(date(year, month, rand_day(year, month)),
                            merchant, amt, "Food & Dining"))

    # Groceries (3-6 per month)
    for _ in range(random.randint(3, 6)):
        merchant = pick(GROCERIES)
        amt = rnd(600, 2800)
        txns.append(make_tx(date(year, month, rand_day(year, month)),
                            merchant, amt, "Groceries"))

    # Eating out (4-9 per month; more in festival months)
    n_eat = random.randint(6, 12) if is_festival else random.randint(4, 8)
    for _ in range(n_eat):
        merchant = pick(EATING_OUT)
        amt = rnd(300, 1600)
        txns.append(make_tx(date(year, month, rand_day(year, month)),
                            merchant, amt, "Food & Dining"))

    # Transport (10-20 Ola/Uber rides)
    for _ in range(random.randint(10, 20)):
        merchant = pick(["Ola", "Uber", "Rapido"])
        amt = rnd(80, 450)
        txns.append(make_tx(date(year, month, rand_day(year, month)),
                            merchant, amt, "Transport"))

    # Shopping — more in festival/summer months
    n_shop = random.randint(4, 8) if is_festival else random.randint(2, 4)
    for _ in range(n_shop):
        merchant = pick(SHOPPING)
        amt = rnd(400, 6000)
        txns.append(make_tx(date(year, month, rand_day(year, month)),
                            merchant, amt, "Shopping"))

    # Healthcare — occasional
    if random.random() < 0.4:
        txns.append(make_tx(date(year, month, rand_day(year, month)),
                            pick(HEALTHCARE), rnd(200, 1200), "Healthcare"))

    # Travel — Dec/Jan and a random month mid-year
    if is_travel or (is_summer and random.random() < 0.5):
        txns.append(make_tx(date(year, month, rand_day(year, month, 10, 25)),
                            pick(["IndiGo", "Air India", "SpiceJet"]),
                            rnd(3500, 14000), "Travel"))
        txns.append(make_tx(date(year, month, rand_day(year, month, 10, 25)),
                            "Booking.com Hotel", rnd(2000, 8000), "Travel"))

    # Personal care — monthly
    if random.random() < 0.7:
        txns.append(make_tx(date(year, month, rand_day(year, month)),
                            pick(["Nykaa", "Salon Visit", "Lakmé Salon"]),
                            rnd(200, 1200), "Personal Care"))

    return txns


# ── main ───────────────────────────────────────────────────────────────────────

def main():
    from sqlalchemy import func, select as _select
    with SessionLocal() as session:
        # Check how many transactions already exist
        count = session.execute(
            _select(func.count()).select_from(Transaction)
        ).scalar()
        if count and count > 0:
            print(f"DB already has {count} transactions. Delete them first to re-seed.")
            return

        # Generate Jan 2023 → Mar 2026
        all_txns = []
        for year in range(2023, 2027):
            for month in range(1, 13):
                if year == 2026 and month > 3:
                    break
                all_txns.extend(generate_month(year, month))

        random.shuffle(all_txns)  # mix the order a bit

        for t in all_txns:
            tx = Transaction(**t)
            session.add(tx)

        session.commit()
        print(f"Seeded {len(all_txns)} transactions.")
        print("Done! Restart the backend.")


if __name__ == "__main__":
    main()
