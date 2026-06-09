"""
seed_transactions.py
====================
Generates realistic transaction data (Jan–Jun 2026) for the Money Manager app.

Usage:
    python seed_transactions.py          # from the project root
    python ..\\seed_transactions.py      # from the backend folder

What it does:
  1. Backs up data/money.db before touching anything
  2. Reads the live schema to verify accounts and categories
  3. Inserts 120–150 transactions per month (700–900 total)
  4. Skips insertion if rows already exist (idempotent)
  5. Prints a summary at the end
"""

import sqlite3, shutil, random, os, sys, io
from datetime import datetime, timedelta
from pathlib import Path

# Force UTF-8 output so emoji/special chars work on Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# -- Locate the database -------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
DB_PATH    = SCRIPT_DIR / "data" / "money.db"

# Set True to wipe existing Jan-Jun 2026 seeded data before re-inserting.
# Use this when you want a clean re-run without duplicate accumulation.
CLEAR_SEED_DATA = True

if not DB_PATH.exists():
    raise FileNotFoundError(f"Database not found at {DB_PATH}. "
                            "Make sure the backend has been started at least once.")

# -- Step 1: Backup ------------------------------------------------------------
backup_path = DB_PATH.with_suffix(
    f".backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
)
shutil.copy2(DB_PATH, backup_path)
print(f"[OK] Backup created: {backup_path.name}\n")

# -- Step 2: Connect and optionally clear old seed data -----------------------
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur  = conn.cursor()

if CLEAR_SEED_DATA:
    cur.execute("""
        DELETE FROM transactions
        WHERE user_id = 1
          AND date >= '2026-01-01 00:00:00'
          AND date <  '2026-07-01 00:00:00'
    """)
    deleted = cur.rowcount
    conn.commit()
    print(f"[OK] Cleared {deleted} existing Jan-Jun 2026 transactions.\n")

print("-" * 55)
print("DATABASE SCHEMA VERIFICATION")
print("-" * 55)

# Verify transactions table columns
cur.execute("PRAGMA table_info(transactions)")
cols = [row["name"] for row in cur.fetchall()]
print(f"transactions columns : {cols}")

# Verify user
cur.execute("SELECT id, username, email FROM users WHERE id = 1")
user = cur.fetchone()
if not user:
    raise ValueError("user_id=1 not found. Register an account first.")
print(f"User                 : id={user['id']}  username={user['username']}")

# Verify accounts
cur.execute("SELECT id, name, account_type FROM accounts WHERE user_id = 1 ORDER BY id")
accounts_rows = cur.fetchall()
print(f"\nAccounts for user_id=1:")
account_map = {}
for a in accounts_rows:
    print(f"  [{a['id']}] {a['name']}  ({a['account_type']})")
    account_map[a['id']] = {"name": a['name'], "type": a['account_type']}

# Verify categories
cur.execute("SELECT id, name, category_type FROM categories WHERE user_id = 1 ORDER BY id")
cat_rows = cur.fetchall()
print(f"\nCategories for user_id=1:")
cat_map = {}
for c in cat_rows:
    print(f"  [{c['id']}] {c['name']}  ({c['category_type']})")
    cat_map[c['id']] = {"name": c['name'], "type": c['category_type']}

# Map category names → ids (so the logic below is name-driven, not hardcoded)
cat_id = {v["name"]: k for k, v in cat_map.items()}
# Map account names → ids
acc_id = {v["name"]: k for k, v in account_map.items()}

print("\n" + "-" * 55)
print("Starting data generation …\n")

# -- Step 3: Transaction templates ---------------------------------------------
# Each entry: (category_name, account_names_pool, amount_range, descriptions)
EXPENSE_TEMPLATES = [

    # -- Food & Dining ---------------------------------------------------------
    ("Food & Dining", ["Paytm", "Cash"], (50, 600), [
        "Zomato order", "Swiggy delivery", "Lunch at office cafeteria",
        "Dinner with family", "Breakfast at café", "Street food",
        "Domino's pizza", "McDonald's", "Grocery shopping – Big Bazaar",
        "Grocery – D-Mart", "Milk and vegetables", "Snacks from store",
        "Coffee at Starbucks", "Tea stall", "Restaurant dinner",
        "Biryani takeaway", "Fruit & vegetables market", "Bakery items",
        "Maggi noodles and snacks", "Evening snacks",
    ]),

    # -- Transport -------------------------------------------------------------
    ("Transport", ["Paytm", "Cash"], (20, 500), [
        "Uber cab", "Ola cab", "Auto rickshaw", "Metro card recharge",
        "Bus ticket", "Petrol filling", "Rapido bike taxi",
        "Station to office cab", "Weekend trip cab", "Local train ticket",
        "Airport cab", "InDrive ride", "Rickshaw to market",
        "Toll charges", "Monthly metro pass",
    ]),

    # -- Shopping --------------------------------------------------------------
    ("Shopping", ["Paytm", "Credit Card"], (200, 5000), [
        "Amazon order", "Flipkart purchase", "Myntra clothes",
        "Ajio fashion haul", "Electronics – Croma", "Books – Amazon",
        "Nykaa skincare", "Household items – IKEA",
        "Mobile accessories", "Shoes – Puma outlet",
        "Sports wear", "Kitchen utensils", "Gift shopping",
        "Stationery – Crossword", "Home decor items",
    ]),

    # -- Bills & Utilities -----------------------------------------------------
    ("Bills & Utilities", ["Bank Account"], (300, 3000), [
        "Electricity bill – BESCOM", "Internet bill – Jio Fiber",
        "Mobile recharge – Airtel", "Gas cylinder – Indane",
        "Water bill", "DTH recharge – Tata Play",
        "Broadband – ACT Fibernet", "Postpaid bill – Vi",
        "OTT subscription combo", "Society maintenance",
    ]),

    # -- Health ----------------------------------------------------------------
    ("Health", ["Cash", "Paytm"], (150, 2500), [
        "Medicine – Apollo Pharmacy", "Doctor consultation",
        "Gym membership monthly", "Lab test charges",
        "Dental checkup", "Eye checkup – Vision Plus",
        "Pharmacy – MedPlus", "Vitamin supplements",
        "Physiotherapy session", "Health checkup package",
    ]),

    # -- Entertainment ---------------------------------------------------------
    ("Entertainment", ["Paytm", "Cash"], (100, 2000), [
        "Netflix subscription", "Amazon Prime renewal",
        "Movie tickets – PVR", "Movie tickets – INOX",
        "Spotify premium", "YouTube Premium",
        "Gaming – Steam purchase", "Book fair",
        "Amusement park entry", "Weekend outing",
        "Comedy show tickets", "Cricket match tickets",
        "Disney+ Hotstar", "ZEE5 subscription",
    ]),

    # -- Rent ------------------------------------------------------------------
    ("Rent", ["Bank Account"], (15000, 25000), [
        "Monthly house rent",
        "Rent – 1BHK flat",
        "Apartment rent transfer",
    ]),
]

INCOME_TEMPLATES = [
    ("Salary", ["Bank Account"], (50000, 85000), [
        "Monthly salary credit", "Salary – January",
        "Salary – February", "Salary – March",
        "Salary – April", "Salary – May", "Salary – June",
    ]),
    ("Freelance", ["Bank Account"], (5000, 30000), [
        "Freelance project payment", "Client payment – website",
        "Logo design payment", "Consulting fee",
        "Content writing payment", "App development milestone",
        "Social media management", "SEO project payment",
        "UI/UX design fee", "Data analysis project",
    ]),
    ("Investment", ["Bank Account"], (2000, 15000), [
        "Mutual fund dividend", "FD interest credit",
        "Stock dividend payout", "SIP maturity",
        "RD maturity", "PPF interest credit",
    ]),
]

# -- Step 4: Per-category monthly counts (sum = 120–150 / month) ---------------
# We draw from these ranges to get realistic distribution.
MONTHLY_EXPENSE_COUNTS = {
    "Food & Dining":    (50, 60),   # multiple meals + snacks per day
    "Transport":        (28, 38),
    "Shopping":         (14, 22),
    "Bills & Utilities":(6,  9),
    "Health":           (4,  7),
    "Entertainment":    (8,  14),
    "Rent":             (1,  1),    # always exactly 1
}
# Totals: min=111+income(3) = ~114, max=151+income(8) = ~159  ->  avg ~136/month
MONTHLY_INCOME_COUNTS = {
    "Salary":     (1, 1),
    "Freelance":  (2, 5),
    "Investment": (0, 2),
}

# -- Step 5: Helper functions ---------------------------------------------------

def random_datetime(year: int, month: int) -> datetime:
    """Random datetime within a given year/month."""
    if month == 12:
        next_month = datetime(year + 1, 1, 1)
    else:
        next_month = datetime(year, month + 1, 1)
    start = datetime(year, month, 1, 6, 0, 0)
    end   = next_month - timedelta(seconds=1)
    delta = int((end - start).total_seconds())
    return start + timedelta(seconds=random.randint(0, delta))


def pick_account(pool: list) -> int:
    """Return the account_id for a randomly chosen account name from the pool."""
    available = [name for name in pool if name in acc_id]
    if not available:
        # fallback to first account
        return list(acc_id.values())[0]
    return acc_id[random.choice(available)]


def already_exists(cur, user_id: int, txn_type: str,
                   amount: float, cat_id_val: int,
                   dt: datetime) -> bool:
    """Return True if an identical row already exists (prevents duplicates on re-run)."""
    cur.execute("""
        SELECT 1 FROM transactions
        WHERE user_id=? AND transaction_type=? AND amount=?
          AND category_id=? AND date=?
        LIMIT 1
    """, (user_id, txn_type, round(amount, 2), cat_id_val, dt.strftime("%Y-%m-%d %H:%M:%S")))
    return cur.fetchone() is not None


# -- Step 6: Generate and insert -----------------------------------------------
MONTHS = [
    (2026, 1), (2026, 2), (2026, 3),
    (2026, 4), (2026, 5), (2026, 6),
]

SALARY_MONTHS = {m: False for m in range(1, 7)}   # track salary per month
inserted_total = 0
monthly_counts  = {}
total_income    = 0.0
total_expense   = 0.0

MONTH_NAMES = {1:"Jan",2:"Feb",3:"Mar",4:"Apr",5:"May",6:"Jun"}

for year, month in MONTHS:
    month_inserted = 0

    # -- Expenses --------------------------------------------------------------
    for tmpl in EXPENSE_TEMPLATES:
        cat_name, acc_pool, (amt_lo, amt_hi), descriptions = tmpl

        if cat_name not in cat_id:
            continue   # category doesn't exist for this user, skip

        lo, hi = MONTHLY_EXPENSE_COUNTS.get(cat_name, (4, 8))
        count  = random.randint(lo, hi)

        for _ in range(count):
            amount  = round(random.uniform(amt_lo, amt_hi), 2)
            desc    = random.choice(descriptions)
            dt      = random_datetime(year, month)
            acc     = pick_account(acc_pool)
            cat     = cat_id[cat_name]

            if already_exists(cur, 1, "expense", amount, cat, dt):
                continue

            cur.execute("""
                INSERT INTO transactions
                    (user_id, account_id, category_id, amount,
                     transaction_type, description, date, created_at)
                VALUES (?, ?, ?, ?, 'expense', ?, ?, ?)
            """, (1, acc, cat, amount, desc,
                  dt.strftime("%Y-%m-%d %H:%M:%S"),
                  dt.strftime("%Y-%m-%d %H:%M:%S")))
            month_inserted += 1
            total_expense  += amount

    # -- Income ----------------------------------------------------------------
    for tmpl in INCOME_TEMPLATES:
        cat_name, acc_pool, (amt_lo, amt_hi), descriptions = tmpl

        if cat_name not in cat_id:
            continue

        lo, hi = MONTHLY_INCOME_COUNTS.get(cat_name, (1, 2))
        count  = random.randint(lo, hi)

        # Salary always exactly once per month
        if cat_name == "Salary":
            count = 1

        for i in range(count):
            amount  = round(random.uniform(amt_lo, amt_hi), 2)
            # Salary uses a month-specific description
            if cat_name == "Salary":
                desc = f"Salary credit – {MONTH_NAMES[month]} {year}"
                # Fix salary day to 1st of month
                dt = datetime(year, month, 1,
                              random.randint(9, 11),
                              random.randint(0, 59), 0)
            else:
                desc = random.choice(descriptions)
                dt   = random_datetime(year, month)

            acc = pick_account(acc_pool)
            cat = cat_id[cat_name]

            if already_exists(cur, 1, "income", amount, cat, dt):
                continue

            cur.execute("""
                INSERT INTO transactions
                    (user_id, account_id, category_id, amount,
                     transaction_type, description, date, created_at)
                VALUES (?, ?, ?, ?, 'income', ?, ?, ?)
            """, (1, acc, cat, amount, desc,
                  dt.strftime("%Y-%m-%d %H:%M:%S"),
                  dt.strftime("%Y-%m-%d %H:%M:%S")))
            month_inserted += 1
            total_income   += amount

    conn.commit()
    monthly_counts[f"{MONTH_NAMES[month]} {year}"] = month_inserted
    inserted_total += month_inserted
    print(f"  {MONTH_NAMES[month]} {year}  →  {month_inserted} transactions")

conn.close()

# -- Step 7: Summary -----------------------------------------------------------
print("\n" + "=" * 55)
print("SEED SUMMARY")
print("=" * 55)
print(f"{'Month':<12}  {'Count':>6}")
print("-" * 22)
for m, c in monthly_counts.items():
    print(f"{m:<12}  {c:>6}")
print("-" * 22)
print(f"{'TOTAL':<12}  {inserted_total:>6}")
print()
print(f"Total Income  : Rs.{total_income:>12,.2f}")
print(f"Total Expenses: Rs.{total_expense:>12,.2f}")
print(f"Net           : Rs.{total_income - total_expense:>12,.2f}")
print("=" * 55)
print(f"\n[OK] Done! Backup saved as: {backup_path.name}")
