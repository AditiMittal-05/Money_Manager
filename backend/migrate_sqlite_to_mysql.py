"""
migrate_sqlite_to_mysql.py
──────────────────────────
One-time script: copies all data from the old SQLite file (data/money.db)
into the new MySQL database (money_manager).

Run once from the backend folder:
    python migrate_sqlite_to_mysql.py
"""

import os
import sqlite3
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import pymysql
from sqlalchemy import create_engine, text
from database import DATABASE_URL, Base
import models  # registers all table definitions

# ── Path to your existing SQLite database ──────────────────────────────────
SQLITE_PATH = Path(__file__).parent.parent / "data" / "money.db"

# ── Tables to migrate (in order — respects foreign keys) ───────────────────
TABLES = [
    "users",
    "accounts",
    "categories",
    "transactions",
    "budgets",
    "recurring_payments",
    "notifications",
    "password_reset_tokens",
    "chat_messages",
]


def create_mysql_database():
    """Create the MySQL database if it doesn't exist yet."""
    host     = os.getenv("DB_HOST", "localhost")
    port     = int(os.getenv("DB_PORT", "3306"))
    user     = os.getenv("DB_USER", "root")
    password = os.getenv("DB_PASSWORD", "")
    db_name  = os.getenv("DB_NAME", "money_manager")

    conn = pymysql.connect(host=host, port=port, user=user, password=password)
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
                f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        conn.commit()
        print(f"✅  MySQL database '{db_name}' is ready.")
    finally:
        conn.close()


def migrate():
    # ── 1. Check SQLite file exists ────────────────────────────────────────
    if not SQLITE_PATH.exists():
        print(f"❌  SQLite file not found at: {SQLITE_PATH}")
        print("    Make sure money.db is in the data/ folder.")
        return

    print(f"📂  Reading from SQLite: {SQLITE_PATH}")

    # ── 2. Create MySQL database ───────────────────────────────────────────
    create_mysql_database()

    # ── 3. Create all tables in MySQL ──────────────────────────────────────
    mysql_engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        echo=False
    )
    Base.metadata.create_all(bind=mysql_engine)
    print("✅  All tables created in MySQL.")

    # ── 4. Copy rows table by table ────────────────────────────────────────
    sqlite_conn  = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row   # lets us access columns by name

    print("\n  Migrating data...\n")
    print(f"  {'Table':<35} {'Rows':>8}")
    print("  " + "-" * 45)

    with mysql_engine.begin() as mysql_conn:
        # Disable FK checks while inserting so order doesn't matter
        mysql_conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))

        for table in TABLES:
            # Check if table exists in SQLite
            exists = sqlite_conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table,)
            ).fetchone()

            if not exists:
                print(f"  {table:<35} {'(skipped — not in SQLite)':>8}")
                continue

            rows = sqlite_conn.execute(f"SELECT * FROM `{table}`").fetchall()

            if not rows:
                print(f"  {table:<35} {'0':>8}")
                continue

            # Build INSERT statement dynamically from column names
            cols    = rows[0].keys()
            col_str = ", ".join(f"`{c}`" for c in cols)
            ph_str  = ", ".join([":" + c for c in cols])

            # Clear existing MySQL rows first (idempotent re-run)
            mysql_conn.execute(text(f"DELETE FROM `{table}`"))

            # Insert all rows
            mysql_conn.execute(
                text(f"INSERT INTO `{table}` ({col_str}) VALUES ({ph_str})"),
                [dict(row) for row in rows]
            )
            print(f"  {table:<35} {len(rows):>8,} rows")

        # Re-enable FK checks
        mysql_conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))

    sqlite_conn.close()

    print("\n✅  Migration complete! Your MySQL database is ready.")
    print("    You can now start the backend normally:")
    print("    python -m uvicorn main:app --reload\n")


if __name__ == "__main__":
    migrate()
