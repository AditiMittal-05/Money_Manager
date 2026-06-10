"""
migrate_sqlite_to_mysql.py
==========================
Copies ALL data from SQLite (data/money.db) into MySQL.
Run this ONCE from the project root after installing MySQL.

  python migrate_sqlite_to_mysql.py

Steps this script performs:
  1. Reads credentials from backend/.env
  2. Creates the MySQL database if it doesn't exist
  3. Creates all tables via SQLAlchemy models
  4. Copies every row from every SQLite table into MySQL
  5. Prints a summary of rows migrated per table
"""

import sys, os, sqlite3, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SCRIPT_DIR  = Path(__file__).parent
SQLITE_PATH = SCRIPT_DIR / 'data' / 'money.db'
ENV_PATH    = SCRIPT_DIR / 'backend' / '.env'

# ── Load .env ──────────────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv(ENV_PATH)

DB_HOST     = os.getenv('DB_HOST', 'localhost')
DB_PORT     = int(os.getenv('DB_PORT', '3306'))
DB_USER     = os.getenv('DB_USER', 'root')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME     = os.getenv('DB_NAME', 'money_manager')


def main():
    print("=" * 60)
    print("  SQLite  →  MySQL  Migration")
    print("=" * 60)

    # ── 1. Check SQLite exists ─────────────────────────────────
    if not SQLITE_PATH.exists():
        print(f"[ERROR] SQLite file not found: {SQLITE_PATH}")
        print("        Start the backend at least once to create the DB.")
        sys.exit(1)
    print(f"[OK]  SQLite source : {SQLITE_PATH}")

    # ── 2. Connect to MySQL (no DB selected yet) ───────────────
    try:
        import pymysql
    except ImportError:
        print("[ERROR] PyMySQL not installed. Run:  pip install PyMySQL")
        sys.exit(1)

    try:
        mysql_conn = pymysql.connect(
            host=DB_HOST, port=DB_PORT,
            user=DB_USER, password=DB_PASSWORD,
            charset='utf8mb4', autocommit=False,
            connect_timeout=10,
        )
    except Exception as e:
        print(f"\n[ERROR] Cannot connect to MySQL: {e}")
        print(
            f"\nCheck that:\n"
            f"  • MySQL Server is installed and running\n"
            f"  • backend/.env has the correct DB_USER / DB_PASSWORD\n"
            f"  • DB_HOST={DB_HOST}  DB_PORT={DB_PORT}"
        )
        sys.exit(1)

    mc = mysql_conn.cursor()
    print(f"[OK]  MySQL target  : {DB_USER}@{DB_HOST}:{DB_PORT}")

    # ── 3. Create database ─────────────────────────────────────
    mc.execute(
        f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` "
        f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    )
    mc.execute(f"USE `{DB_NAME}`")
    mysql_conn.commit()
    print(f"[OK]  Database '{DB_NAME}' ready\n")

    # ── 4. Create tables via SQLAlchemy models ─────────────────
    sys.path.insert(0, str(SCRIPT_DIR / 'backend'))
    from sqlalchemy import create_engine
    from database import Base
    import models  # registers all ORM models

    engine = create_engine(
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}"
        f"@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4",
        pool_pre_ping=True,
    )
    Base.metadata.create_all(bind=engine)
    print("[OK]  MySQL tables created")
    print("-" * 60)
    print(f"  {'Table':<30}  {'Rows migrated':>14}")
    print("-" * 60)

    # ── 5. Copy data ───────────────────────────────────────────
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    sc = sqlite_conn.cursor()

    mc.execute("SET FOREIGN_KEY_CHECKS = 0")  # skip FK order requirement

    def sqlite_columns(table: str):
        sc.execute(f"PRAGMA table_info(`{table}`)")
        return [row[1] for row in sc.fetchall()]

    def copy_table(table: str):
        cols = sqlite_columns(table)
        if not cols:
            print(f"  {'[SKIP] ' + table:<30}  {'not in SQLite':>14}")
            return

        sc.execute(f"SELECT * FROM `{table}`")
        rows = sc.fetchall()
        if not rows:
            print(f"  {table:<30}  {'0 rows':>14}")
            return

        col_list     = ", ".join(f"`{c}`" for c in cols)
        placeholders = ", ".join(["%s"] * len(cols))
        sql = f"INSERT IGNORE INTO `{table}` ({col_list}) VALUES ({placeholders})"

        data = [tuple(row[c] for c in cols) for row in rows]
        mc.executemany(sql, data)
        mysql_conn.commit()
        print(f"  {table:<30}  {len(data):>14,} rows")

    # Order matters for foreign keys (even with checks off, cleaner this way)
    copy_table("users")
    copy_table("accounts")
    copy_table("categories")
    copy_table("transactions")
    copy_table("budgets")
    copy_table("recurring_payments")
    copy_table("notifications")
    copy_table("password_reset_tokens")
    copy_table("chat_messages")

    mc.execute("SET FOREIGN_KEY_CHECKS = 1")
    mysql_conn.commit()

    sqlite_conn.close()
    mysql_conn.close()

    print("-" * 60)
    print("[DONE] Migration complete!")
    print(
        f"\nConnect with MySQL Workbench / DBeaver:\n"
        f"  Host     : {DB_HOST}\n"
        f"  Port     : {DB_PORT}\n"
        f"  Database : {DB_NAME}\n"
        f"  User     : {DB_USER}\n"
    )


if __name__ == "__main__":
    main()
