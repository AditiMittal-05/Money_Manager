"""
rag_engine.py  —  Local Finance Q&A Engine

  RETRIEVE  →  Pull user's real financial data from SQLite with targeted SQL queries
  ANSWER    →  Compute the answer directly in Python — no external API needed

All calculations are done locally so there are no API keys, rate limits, or costs.
"""

import calendar
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
import models


# ── Helpers ────────────────────────────────────────────────────────────────

MONTH_MAP = {
    'january': 1, 'february': 2, 'march': 3, 'april': 4,
    'may': 5, 'june': 6, 'july': 7, 'august': 8,
    'september': 9, 'october': 10, 'november': 11, 'december': 12,
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4,
    'jun': 6, 'jul': 7, 'aug': 8,
    'sep': 9, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12
}

CATEGORY_ALIASES = {
    'grocery': 'food', 'groceries': 'food', 'eating': 'food',
    'restaurant': 'food', 'dining': 'food', 'meal': 'food',
    'commute': 'transport', 'cab': 'transport', 'uber': 'transport',
    'ola': 'transport', 'petrol': 'transport', 'fuel': 'transport',
    'bus': 'transport', 'metro': 'transport', 'auto': 'transport',
    'clothes': 'shopping', 'clothing': 'shopping', 'amazon': 'shopping',
    'flipkart': 'shopping', 'online': 'shopping',
    'doctor': 'health', 'medicine': 'health', 'medical': 'health',
    'hospital': 'health', 'pharmacy': 'health', 'gym': 'health',
    'movie': 'entertainment', 'netflix': 'entertainment', 'game': 'entertainment',
    'spotify': 'entertainment', 'concert': 'entertainment',
    'electricity': 'utilities', 'water': 'utilities', 'internet': 'utilities',
    'wifi': 'utilities', 'phone bill': 'utilities', 'gas': 'utilities',
    'paycheck': 'salary', 'stipend': 'salary', 'wage': 'salary',
    'stock': 'investment', 'mutual fund': 'investment', 'sip': 'investment',
    'share': 'investment', 'equity': 'investment',
}


def fmt(amount: float) -> str:
    return f"₹{amount:,.2f}"


def get_period(q: str, now: datetime):
    """Detect time period from question. Returns (start, end, label)."""
    # Specific month name in question
    for month_name, month_num in MONTH_MAP.items():
        if month_name in q:
            year = now.year
            if month_num > now.month:
                year -= 1
            _, last_day = calendar.monthrange(year, month_num)
            return (
                datetime(year, month_num, 1),
                datetime(year, month_num, last_day, 23, 59, 59),
                datetime(year, month_num, 1).strftime('%B %Y')
            )

    if any(p in q for p in ['last month', 'previous month', 'prev month']):
        if now.month == 1:
            y, m = now.year - 1, 12
        else:
            y, m = now.year, now.month - 1
        _, last_day = calendar.monthrange(y, m)
        return (
            datetime(y, m, 1),
            datetime(y, m, last_day, 23, 59, 59),
            datetime(y, m, 1).strftime('%B %Y')
        )

    if any(p in q for p in ['this year', 'ytd', 'year to date']):
        return (datetime(now.year, 1, 1), now, f"this year ({now.year})")

    if any(p in q for p in ['all time', 'overall', 'total ever', 'till now', 'so far']):
        return (datetime(2000, 1, 1), now, 'all time')

    # Default: current month
    return (datetime(now.year, now.month, 1), now, 'this month')


def find_category(q: str, user_id: int, db: Session):
    """Find a matching Category row from the question text."""
    categories = db.query(models.Category).filter(
        models.Category.user_id == user_id
    ).all()

    # Direct name match (longest first to avoid partial collisions)
    cats_sorted = sorted(categories, key=lambda c: len(c.name), reverse=True)
    for cat in cats_sorted:
        if cat.name.lower() in q:
            return cat

    # Alias match
    for alias, target in CATEGORY_ALIASES.items():
        if alias in q:
            for cat in categories:
                if target in cat.name.lower():
                    return cat

    return None


# ── Main Q&A Engine ────────────────────────────────────────────────────────

def generate_response_local(
    question: str,
    user_id: int,
    db: Session,
    chat_history: list = None
) -> str:
    """
    Pure Python finance Q&A — answers computed from SQLite, no external API.
    """
    q = question.lower().strip()
    now = datetime.utcnow()
    period_start, period_end, period_label = get_period(q, now)
    is_avg = any(k in q for k in ['average', 'avg', 'per day', 'per week', 'mean'])

    # ── TOTAL BALANCE ──────────────────────────────────────────────────────
    if any(k in q for k in ['balance', 'how much do i have', 'total money', 'net worth',
                              'how much money', 'account balance']):
        total = db.query(func.sum(models.Account.balance)).filter(
            models.Account.user_id == user_id
        ).scalar() or 0
        accounts = db.query(models.Account).filter(
            models.Account.user_id == user_id
        ).all()
        lines = [f"Your total balance across all accounts is {fmt(total)}.\n"]
        if accounts:
            lines.append("Breakdown:")
            for a in accounts:
                lines.append(f"  • {a.name} ({a.account_type}): {fmt(a.balance)}")
        return "\n".join(lines)

    # ── SAVINGS / NET ──────────────────────────────────────────────────────
    if any(k in q for k in ['saving', 'saved', 'net saving', 'how much left',
                              'surplus', 'save this month', 'save last month']):
        income = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.user_id == user_id,
            models.Transaction.transaction_type == 'income',
            models.Transaction.date >= period_start,
            models.Transaction.date <= period_end
        ).scalar() or 0
        expense = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.user_id == user_id,
            models.Transaction.transaction_type == 'expense',
            models.Transaction.date >= period_start,
            models.Transaction.date <= period_end
        ).scalar() or 0
        net = income - expense
        rate = (net / income * 100) if income > 0 else 0
        verdict = (
            "Great job! 🎉" if rate >= 20
            else ("Good work 👍" if rate >= 10
            else "Consider reviewing your expenses. 💡")
        )
        return (
            f"Savings summary for {period_label}:\n"
            f"  • Income:        {fmt(income)}\n"
            f"  • Expenses:      {fmt(expense)}\n"
            f"  • Net savings:   {fmt(net)} ({rate:.1f}% savings rate)\n\n"
            f"{verdict}"
        )

    # ── INCOME ─────────────────────────────────────────────────────────────
    if any(k in q for k in ['income', 'earn', 'salary', 'revenue',
                              'how much i made', 'how much did i make', 'credit']):
        total = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.user_id == user_id,
            models.Transaction.transaction_type == 'income',
            models.Transaction.date >= period_start,
            models.Transaction.date <= period_end
        ).scalar() or 0
        count = db.query(func.count(models.Transaction.id)).filter(
            models.Transaction.user_id == user_id,
            models.Transaction.transaction_type == 'income',
            models.Transaction.date >= period_start,
            models.Transaction.date <= period_end
        ).scalar() or 0
        if count == 0:
            return f"No income transactions found for {period_label}."
        return (
            f"Your total income for {period_label} is {fmt(total)} "
            f"across {count} transaction{'s' if count != 1 else ''}."
        )

    # ── BUDGET STATUS ──────────────────────────────────────────────────────
    if any(k in q for k in ['budget', 'over budget', 'exceed', 'limit', 'overspend']):
        budgets = db.query(models.Budget).filter(
            models.Budget.user_id == user_id
        ).all()
        if not budgets:
            return "You haven't set any budgets yet. Visit the Budgets page to create one!"

        lines = [f"Budget status:\n"]
        exceeded = []
        for b in budgets:
            cat = db.query(models.Category).filter(
                models.Category.id == b.category_id
            ).first()
            spent = db.query(func.sum(models.Transaction.amount)).filter(
                models.Transaction.user_id == user_id,
                models.Transaction.category_id == b.category_id,
                models.Transaction.transaction_type == 'expense',
                models.Transaction.date >= b.start_date,
                models.Transaction.date <= b.end_date
            ).scalar() or 0
            pct = (spent / b.amount * 100) if b.amount > 0 else 0
            icon = "🔴" if pct >= 100 else ("🟡" if pct >= 80 else "🟢")
            status = "EXCEEDED" if pct >= 100 else ("WARNING" if pct >= 80 else "OK")
            if pct >= 100:
                exceeded.append(cat.name if cat else 'Unknown')
            lines.append(
                f"  {icon} {cat.name if cat else 'Unknown'}: "
                f"{fmt(spent)} / {fmt(b.amount)} ({pct:.1f}%) — {status}"
            )

        if exceeded:
            lines.append(f"\n⚠️ Budget exceeded in: {', '.join(exceeded)}")
        else:
            lines.append("\n✅ You're within all budgets!")
        return "\n".join(lines)

    # ── TOP SPENDING CATEGORIES ────────────────────────────────────────────
    if any(k in q for k in ['top', 'most spent', 'highest', 'where do i spend',
                              'breakdown', 'category breakdown', 'categories']):
        cats = db.query(models.Category).filter(
            models.Category.user_id == user_id,
            models.Category.category_type == 'expense'
        ).all()
        cat_totals = []
        for c in cats:
            total = db.query(func.sum(models.Transaction.amount)).filter(
                models.Transaction.user_id == user_id,
                models.Transaction.category_id == c.id,
                models.Transaction.transaction_type == 'expense',
                models.Transaction.date >= period_start,
                models.Transaction.date <= period_end
            ).scalar() or 0
            if total > 0:
                cat_totals.append((c.name, total))

        if not cat_totals:
            return f"No expense transactions found for {period_label}."

        cat_totals.sort(key=lambda x: x[1], reverse=True)
        grand = sum(v for _, v in cat_totals)
        lines = [f"Top spending categories for {period_label}:\n"]
        for i, (name, amt) in enumerate(cat_totals[:6], 1):
            pct = (amt / grand * 100) if grand > 0 else 0
            lines.append(f"  {i}. {name}: {fmt(amt)} ({pct:.1f}%)")
        lines.append(f"\nTotal expenses: {fmt(grand)}")
        return "\n".join(lines)

    # ── RECENT TRANSACTIONS ────────────────────────────────────────────────
    if any(k in q for k in ['recent', 'transaction', 'latest', 'last few',
                              'history', 'show my', 'list']):
        txns = db.query(models.Transaction).filter(
            models.Transaction.user_id == user_id
        ).order_by(models.Transaction.date.desc()).limit(10).all()

        if not txns:
            return "No transactions found."

        lines = [f"Your 10 most recent transactions:\n"]
        for t in txns:
            cat = db.query(models.Category).filter(
                models.Category.id == t.category_id
            ).first()
            sign = "+" if t.transaction_type == 'income' else "-"
            lines.append(
                f"  {t.date.strftime('%d %b %Y')}  {sign}{fmt(t.amount)}"
                f"  [{cat.name if cat else 'Uncategorized'}]"
                f"  {t.description or ''}"
            )
        return "\n".join(lines)

    # ── SPEND ON A SPECIFIC CATEGORY (with optional average) ──────────────
    cat = find_category(q, user_id, db)
    if cat:
        total = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.user_id == user_id,
            models.Transaction.category_id == cat.id,
            models.Transaction.transaction_type == 'expense',
            models.Transaction.date >= period_start,
            models.Transaction.date <= period_end
        ).scalar() or 0
        count = db.query(func.count(models.Transaction.id)).filter(
            models.Transaction.user_id == user_id,
            models.Transaction.category_id == cat.id,
            models.Transaction.transaction_type == 'expense',
            models.Transaction.date >= period_start,
            models.Transaction.date <= period_end
        ).scalar() or 0

        if count == 0:
            return f"No {cat.name} expenses found for {period_label}."

        if is_avg:
            avg_per_txn = total / count
            days = max((period_end - period_start).days, 1)
            avg_per_day = total / days
            return (
                f"Your {cat.name} spending for {period_label}:\n"
                f"  • Total:                  {fmt(total)}\n"
                f"  • Number of transactions: {count}\n"
                f"  • Average per transaction:{fmt(avg_per_txn)}\n"
                f"  • Average per day:        {fmt(avg_per_day)}"
            )

        return (
            f"You spent {fmt(total)} on {cat.name} in {period_label} "
            f"across {count} transaction{'s' if count != 1 else ''}."
        )

    # ── TOTAL SPEND (no specific category) ────────────────────────────────
    if any(k in q for k in ['spend', 'spent', 'expense', 'expenditure',
                              'cost', 'paid', 'pay', 'debit', 'outgoing']):
        total = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.user_id == user_id,
            models.Transaction.transaction_type == 'expense',
            models.Transaction.date >= period_start,
            models.Transaction.date <= period_end
        ).scalar() or 0
        count = db.query(func.count(models.Transaction.id)).filter(
            models.Transaction.user_id == user_id,
            models.Transaction.transaction_type == 'expense',
            models.Transaction.date >= period_start,
            models.Transaction.date <= period_end
        ).scalar() or 0

        if count == 0:
            return f"No expense transactions found for {period_label}."

        if is_avg:
            days = max((period_end - period_start).days, 1)
            avg_per_day = total / days
            return (
                f"Expense summary for {period_label}:\n"
                f"  • Total:        {fmt(total)}\n"
                f"  • Transactions: {count}\n"
                f"  • Avg per day:  {fmt(avg_per_day)}"
            )

        return (
            f"You spent {fmt(total)} in {period_label} "
            f"across {count} expense transaction{'s' if count != 1 else ''}."
        )

    # ── FALLBACK: full summary ─────────────────────────────────────────────
    income = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.user_id == user_id,
        models.Transaction.transaction_type == 'income',
        models.Transaction.date >= period_start,
        models.Transaction.date <= period_end
    ).scalar() or 0
    expense = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.user_id == user_id,
        models.Transaction.transaction_type == 'expense',
        models.Transaction.date >= period_start,
        models.Transaction.date <= period_end
    ).scalar() or 0

    return (
        f"Financial summary for {period_label}:\n"
        f"  • Income:   {fmt(income)}\n"
        f"  • Expenses: {fmt(expense)}\n"
        f"  • Net:      {fmt(income - expense)}\n\n"
        "Try asking:\n"
        "  • 'How much did I spend on food last month?'\n"
        "  • 'What is my total balance?'\n"
        "  • 'Am I over budget?'\n"
        "  • 'Show top spending categories'"
    )


# ── Entry point called by POST /chat in main.py ────────────────────────────

def ask_finance_bot(
    user_id: int,
    question: str,
    db: Session,
    gemini_api_key: str = None,   # kept for backward compatibility, not used
    chat_history: list = None
) -> str:
    """
    Entry point for the finance chatbot.
    Answers are computed locally from SQLite — no external API calls.
    """
    return generate_response_local(question, user_id, db, chat_history)
