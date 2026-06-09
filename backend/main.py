from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, text
from datetime import datetime, timedelta
from typing import Optional
import os, shutil, secrets, math

# Google OAuth — verifies the token sent from the frontend
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

# Your Google Client ID (only the client_id value, not the full JSON)
GOOGLE_CLIENT_ID = "495333564636-4gegah5dbg0b4hoovct7ai6d4rfceg5n.apps.googleusercontent.com"

from database import engine, get_db, Base, SessionLocal
import models

# ── DEFAULT ACCOUNTS every new user gets ─────────────────────
DEFAULT_ACCOUNTS = [
    {"name": "Cash",         "account_type": "cash",   "color": "#4CAF50"},
    {"name": "Paytm",        "account_type": "wallet", "color": "#002970"},
    {"name": "Bank Account", "account_type": "bank",   "color": "#2196F3"},
    {"name": "Credit Card",  "account_type": "credit", "color": "#9C27B0"},
]

def seed_default_accounts(user_id: int, db: Session):
    """Insert any missing default accounts for a user (skips ones that already exist)."""
    existing = {a.name for a in db.query(models.Account).filter(
        models.Account.user_id == user_id
    ).all()}
    for acc in DEFAULT_ACCOUNTS:
        if acc["name"] not in existing:
            db.add(models.Account(
                user_id=user_id,
                name=acc["name"],
                account_type=acc["account_type"],
                balance=0.0,
                color=acc["color"]
            ))
    db.commit()
from auth import (
    hash_password, verify_password,
    create_access_token, get_current_user
)
from email_utils import send_otp_email
import random

# Create all database tables if they don't exist yet
Base.metadata.create_all(bind=engine)

# Create the FastAPI app
app = FastAPI(title="Money Manager API")

@app.on_event("startup")
def on_startup():
    """Run migrations and seed defaults on every backend start."""
    # ── Add new profile columns to existing databases (safe — ignores if already exist)
    with engine.connect() as conn:
        for sql in [
            "ALTER TABLE users ADD COLUMN full_name TEXT",
            "ALTER TABLE users ADD COLUMN phone TEXT",
            "ALTER TABLE users ADD COLUMN country TEXT DEFAULT 'India'",
            "ALTER TABLE users ADD COLUMN currency_pref TEXT DEFAULT 'INR'",
            "ALTER TABLE users ADD COLUMN avatar_url TEXT",
            "ALTER TABLE users ADD COLUMN last_login DATETIME",
            "ALTER TABLE users ADD COLUMN email_notifications BOOLEAN DEFAULT 1",
            "ALTER TABLE users ADD COLUMN budget_alerts BOOLEAN DEFAULT 1",
        ]:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # column already exists

    # ── Seed default accounts for all users
    db = SessionLocal()
    try:
        for user in db.query(models.User).all():
            seed_default_accounts(user.id, db)
    finally:
        db.close()

# CORS — allows the frontend (different port) to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # in production, set to your actual domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads folder if it doesn't exist
os.makedirs("../data/uploads", exist_ok=True)

# Serve uploaded avatar images as static files
app.mount("/uploads", StaticFiles(directory="../data/uploads"), name="uploads")


# ════════════════════════════════════════════════════════════
# AUTH ROUTES
# ════════════════════════════════════════════════════════════

@app.post("/register")
def register(
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """Create a new user account"""
    # Check if email or username already exists
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(models.User).filter(models.User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = models.User(
        username=username,
        email=email,
        password_hash=hash_password(password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create default categories for new user
    default_categories = [
        {"name": "Salary", "type": "income", "icon": "💼", "color": "#4CAF50"},
        {"name": "Freelance", "type": "income", "icon": "💻", "color": "#2196F3"},
        {"name": "Investment", "type": "income", "icon": "📈", "color": "#9C27B0"},
        {"name": "Food & Dining", "type": "expense", "icon": "🍕", "color": "#FF5722"},
        {"name": "Transport", "type": "expense", "icon": "🚗", "color": "#FF9800"},
        {"name": "Shopping", "type": "expense", "icon": "🛍️", "color": "#E91E63"},
        {"name": "Bills & Utilities", "type": "expense", "icon": "💡", "color": "#607D8B"},
        {"name": "Health", "type": "expense", "icon": "🏥", "color": "#F44336"},
        {"name": "Entertainment", "type": "expense", "icon": "🎬", "color": "#3F51B5"},
        {"name": "Rent", "type": "expense", "icon": "🏠", "color": "#795548"},
    ]
    for cat in default_categories:
        db.add(models.Category(
            user_id=user.id,
            name=cat["name"],
            category_type=cat["type"],
            icon=cat["icon"],
            color=cat["color"]
        ))

    # Create default accounts (Cash, Paytm, Bank Account, Credit Card)
    seed_default_accounts(user.id, db)
    db.commit()

    token = create_access_token({"user_id": user.id})
    return {"access_token": token, "token_type": "bearer", "username": user.username}


@app.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login with username/email + password, returns JWT token"""
    # Allow login with email OR username
    user = (
        db.query(models.User)
        .filter(
            (models.User.email == form_data.username) |
            (models.User.username == form_data.username)
        ).first()
    )
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    token = create_access_token({"user_id": user.id})
    return {"access_token": token, "token_type": "bearer", "username": user.username}


# ════════════════════════════════════════════════════════════
# GOOGLE OAUTH ROUTE
# ════════════════════════════════════════════════════════════

@app.post("/auth/google")
def google_auth(
    credential: str = Form(...),   # the ID token sent from the React frontend
    db: Session = Depends(get_db)
):
    """
    Called when the user clicks 'Sign in with Google'.
    1. Verifies the Google ID token is genuine
    2. Extracts email + name from the token
    3. If user exists → log them in
    4. If new user → create account with default categories + cash wallet
    5. Returns our app's own JWT token
    """
    # ── Step 1: Verify the token with Google ──
    try:
        idinfo = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
    except Exception as e:
        # Catch ALL exceptions (ValueError, TransportError, etc.)
        # so they become proper HTTP 400 responses with CORS headers
        raise HTTPException(status_code=400, detail=f"Google token verification failed: {str(e)}")

    # ── Step 2: Extract user info from the verified token ──
    google_id = idinfo["sub"]          # unique Google user ID (never changes)
    email     = idinfo["email"]
    full_name = idinfo.get("name", "")

    # Turn "John Smith" → "john_smith" as a base username
    base_username = full_name.lower().replace(" ", "_") if full_name else email.split("@")[0]
    # Remove any characters that aren't letters, digits, or underscores
    base_username = "".join(c for c in base_username if c.isalnum() or c == "_")
    if not base_username:
        base_username = "user"

    # ── Step 3: Check if this user already exists in our database ──
    user = db.query(models.User).filter(
        (models.User.google_id == google_id) |
        (models.User.email == email)
    ).first()

    if user:
        # Existing user — link their Google ID if not already linked
        if not user.google_id:
            user.google_id = google_id
            db.commit()
    else:
        # ── Step 4: Brand new user — create their account ──

        # Make sure username is unique (append numbers if needed)
        username = base_username
        counter = 1
        while db.query(models.User).filter(models.User.username == username).first():
            username = f"{base_username}{counter}"
            counter += 1

        user = models.User(
            username=username,
            email=email,
            password_hash=hash_password(secrets.token_hex(16)),  # random unusable password
            google_id=google_id
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create the same 10 default categories every new user gets
        default_categories = [
            {"name": "Salary",         "type": "income",  "icon": "💼", "color": "#4CAF50"},
            {"name": "Freelance",      "type": "income",  "icon": "💻", "color": "#2196F3"},
            {"name": "Investment",     "type": "income",  "icon": "📈", "color": "#9C27B0"},
            {"name": "Food & Dining",  "type": "expense", "icon": "🍕", "color": "#FF5722"},
            {"name": "Transport",      "type": "expense", "icon": "🚗", "color": "#FF9800"},
            {"name": "Shopping",       "type": "expense", "icon": "🛍️", "color": "#E91E63"},
            {"name": "Bills & Utilities","type":"expense","icon": "💡", "color": "#607D8B"},
            {"name": "Health",         "type": "expense", "icon": "🏥", "color": "#F44336"},
            {"name": "Entertainment",  "type": "expense", "icon": "🎬", "color": "#3F51B5"},
            {"name": "Rent",           "type": "expense", "icon": "🏠", "color": "#795548"},
        ]
        for cat in default_categories:
            db.add(models.Category(
                user_id=user.id,
                name=cat["name"],
                category_type=cat["type"],
                icon=cat["icon"],
                color=cat["color"]
            ))

        # Create default accounts (Cash, Paytm, Bank Account, Credit Card)
        seed_default_accounts(user.id, db)

    # ── Step 5: Return our own JWT token (same as normal login) ──
    token = create_access_token({"user_id": user.id})
    return {"access_token": token, "token_type": "bearer", "username": user.username}


@app.get("/me")
def get_profile(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "has_pin": current_user.pin_hash is not None
    }


# ════════════════════════════════════════════════════════════
# PROFILE ROUTES
# ════════════════════════════════════════════════════════════

@app.get("/profile/stats")
def get_profile_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Full profile data + stats + financial summary + health score + achievements"""
    # ── Account statistics
    total_txns = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id
    ).count()
    active_budgets = db.query(models.Budget).filter(
        models.Budget.user_id == current_user.id
    ).count()
    categories_count = db.query(models.Category).filter(
        models.Category.user_id == current_user.id
    ).count()
    recurring_count = db.query(models.RecurringPayment).filter(
        models.RecurringPayment.user_id == current_user.id,
        models.RecurringPayment.is_active == True
    ).count()
    days_using = max(1, (datetime.utcnow() - current_user.created_at).days + 1)

    # ── Financial summary (all time)
    total_income = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.transaction_type == "income"
    ).scalar() or 0
    total_expense = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.transaction_type == "expense"
    ).scalar() or 0
    total_savings = total_income - total_expense
    savings_rate = (total_savings / total_income * 100) if total_income > 0 else 0

    # ── Health score calculation (0–100)
    score = 0
    if savings_rate >= 30:   score += 30
    elif savings_rate >= 20: score += 20
    elif savings_rate >= 10: score += 10
    elif savings_rate > 0:   score += 5

    if active_budgets > 0:
        score += 15
        now = datetime.utcnow()
        exceeded = 0
        for b in db.query(models.Budget).filter(
            models.Budget.user_id == current_user.id,
            models.Budget.end_date >= now
        ).all():
            spent = db.query(func.sum(models.Transaction.amount)).filter(
                models.Transaction.user_id == current_user.id,
                models.Transaction.category_id == b.category_id,
                models.Transaction.transaction_type == "expense",
                models.Transaction.date >= b.start_date,
                models.Transaction.date <= b.end_date
            ).scalar() or 0
            if spent > b.amount:
                exceeded += 1
        if exceeded == 0:
            score += 15

    month_start = datetime(datetime.utcnow().year, datetime.utcnow().month, 1)
    income_this_month = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.transaction_type == "income",
        models.Transaction.date >= month_start
    ).scalar() or 0
    if income_this_month > 0: score += 20
    if days_using >= 30:       score += 10
    if current_user.pin_hash:  score += 10
    score = min(100, score)

    if score >= 80:   health_status = "Excellent"
    elif score >= 60: health_status = "Good"
    elif score >= 40: health_status = "Fair"
    else:             health_status = "Needs Work"

    # ── Achievements
    def badge(icon, label, earned): return {"icon": icon, "label": label, "earned": earned}
    achievements = [
        badge("🏆", "First Transaction",  total_txns >= 1),
        badge("💯", "100 Transactions",   total_txns >= 100),
        badge("📊", "Budget Master",      active_budgets >= 1),
        badge("💎", "Saved ₹50,000",      total_savings >= 50000),
        badge("🔥", "30-Day Streak",      days_using >= 30),
        badge("🔁", "Recurring Setup",    recurring_count >= 1),
    ]

    last_login_str = "Just now"
    if getattr(current_user, "last_login", None):
        last_login_str = current_user.last_login.strftime("%d %b %Y %H:%M")

    return {
        "id": current_user.id,
        "username": current_user.username,
        "full_name": getattr(current_user, "full_name", None) or "",
        "email": current_user.email,
        "phone": getattr(current_user, "phone", None) or "",
        "country": getattr(current_user, "country", None) or "India",
        "currency_pref": getattr(current_user, "currency_pref", None) or "INR",
        "avatar_url": getattr(current_user, "avatar_url", None),
        "has_pin": current_user.pin_hash is not None,
        "google_linked": current_user.google_id is not None,
        "joined_date": current_user.created_at.strftime("%d %b %Y"),
        "last_login": last_login_str,
        "email_notifications": getattr(current_user, "email_notifications", True),
        "budget_alerts": getattr(current_user, "budget_alerts", True),
        "stats": {
            "total_transactions": total_txns,
            "active_budgets": active_budgets,
            "categories_count": categories_count,
            "recurring_count": recurring_count,
            "days_using": days_using,
        },
        "financial": {
            "total_income":  round(total_income, 2),
            "total_expense": round(total_expense, 2),
            "total_savings": round(total_savings, 2),
            "savings_rate":  round(savings_rate, 1),
        },
        "health": {"score": score, "status": health_status},
        "achievements": achievements,
    }


@app.put("/profile/update")
def update_profile_info(
    full_name: str = Form(""),
    phone: str = Form(""),
    country: str = Form("India"),
    currency_pref: str = Form("INR"),
    email_notifications: str = Form("true"),
    budget_alerts: str = Form("true"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    current_user.full_name = full_name
    current_user.phone = phone
    current_user.country = country
    current_user.currency_pref = currency_pref
    current_user.email_notifications = email_notifications.lower() == "true"
    current_user.budget_alerts = budget_alerts.lower() == "true"
    db.commit()
    return {"message": "Profile updated"}


@app.post("/profile/avatar")
async def upload_avatar(
    avatar: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ext = (avatar.filename or "").split(".")[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "gif", "webp"):
        raise HTTPException(status_code=400, detail="Unsupported file type. Use jpg, png, or webp.")
    # Remove old avatar file
    old = getattr(current_user, "avatar_url", None)
    if old:
        old_path = f"../data/uploads/{old}"
        if os.path.exists(old_path):
            os.remove(old_path)
    filename = f"avatar_{current_user.id}_{int(datetime.utcnow().timestamp())}.{ext}"
    filepath = f"../data/uploads/{filename}"
    with open(filepath, "wb") as f:
        shutil.copyfileobj(avatar.file, f)
    current_user.avatar_url = filename
    db.commit()
    return {"avatar_url": filename, "message": "Avatar uploaded"}


@app.delete("/profile/avatar")
def delete_avatar(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    old = getattr(current_user, "avatar_url", None)
    if old:
        old_path = f"../data/uploads/{old}"
        if os.path.exists(old_path):
            os.remove(old_path)
    current_user.avatar_url = None
    db.commit()
    return {"message": "Avatar deleted"}


@app.post("/profile/change-password")
def change_password(
    current_password: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not verify_password(current_password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    current_user.password_hash = hash_password(new_password)
    db.commit()
    return {"message": "Password changed successfully"}


# ════════════════════════════════════════════════════════════
# PIN / SECURITY ROUTES
# ════════════════════════════════════════════════════════════

@app.post("/pin/set")
def set_pin(
    pin: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Set a 4-digit PIN for app lock"""
    if len(pin) != 4 or not pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be exactly 4 digits")
    current_user.pin_hash = hash_password(pin)
    db.commit()
    return {"message": "PIN set successfully"}


@app.post("/pin/verify")
def verify_pin(
    pin: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Verify PIN when unlocking the app"""
    if not current_user.pin_hash:
        raise HTTPException(status_code=400, detail="No PIN set")
    if not verify_password(pin, current_user.pin_hash):
        raise HTTPException(status_code=401, detail="Incorrect PIN")
    return {"message": "PIN verified"}


# ════════════════════════════════════════════════════════════
# FORGOT PASSWORD / RESET PASSWORD  (OTP-based)
# ════════════════════════════════════════════════════════════

@app.post("/forgot-password")
def forgot_password(
    email: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Step 1 — user enters their email.
    Generates a 6-digit OTP, stores it in DB with 10-min expiry,
    and emails it to the user (also printed to backend console).

    Always returns success — never reveals if email is registered.
    """
    user = db.query(models.User).filter(models.User.email == email).first()

    if user:
        # Remove any old unused OTPs for this user first
        db.query(models.PasswordResetToken).filter(
            models.PasswordResetToken.user_id == user.id,
            models.PasswordResetToken.is_used == False
        ).delete()
        db.commit()

        # Generate a 6-digit OTP e.g. "472819"
        otp = str(random.randint(100000, 999999))

        # Save in DB — expires in 10 minutes
        record = models.PasswordResetToken(
            user_id=user.id,
            token=otp,
            expires_at=datetime.utcnow() + timedelta(minutes=10)
        )
        db.add(record)
        db.commit()

        # Send OTP email (also prints to console)
        send_otp_email(user.email, otp, user.username)

    return {"message": "If that email is registered, an OTP has been sent to it."}


@app.post("/reset-password")
def reset_password(
    email: str = Form(...),
    otp: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Step 2 — user enters the OTP they received + their new password.
    Validates: OTP matches, not used, not expired.
    Then hashes and saves the new password, marks OTP as used.
    """
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    # Find user by email first
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="No account found with that email.")

    # Find the OTP record
    record = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.user_id == user.id,
        models.PasswordResetToken.token == otp.strip(),
        models.PasswordResetToken.is_used == False
    ).first()

    if not record:
        raise HTTPException(status_code=400, detail="Invalid OTP. Please check and try again.")

    if datetime.utcnow() > record.expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    # All good — update password and mark OTP as used
    user.password_hash = hash_password(new_password)
    record.is_used = True
    db.commit()

    return {"message": "Password reset successfully! You can now log in with your new password."}


# ════════════════════════════════════════════════════════════
# DASHBOARD ROUTE
# ════════════════════════════════════════════════════════════

@app.get("/dashboard")
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Returns all summary data needed for the dashboard"""
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)

    # Total income this month
    income = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.transaction_type == "income",
        models.Transaction.date >= month_start
    ).scalar() or 0

    # Total expense this month
    expense = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.transaction_type == "expense",
        models.Transaction.date >= month_start
    ).scalar() or 0

    # Total balance across all accounts
    total_balance = db.query(func.sum(models.Account.balance)).filter(
        models.Account.user_id == current_user.id
    ).scalar() or 0

    # Last 5 transactions
    recent = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id
    ).order_by(models.Transaction.date.desc()).limit(5).all()

    recent_list = []
    for t in recent:
        cat = db.query(models.Category).filter(models.Category.id == t.category_id).first()
        recent_list.append({
            "id": t.id,
            "amount": t.amount,
            "type": t.transaction_type,
            "description": t.description,
            "date": t.date.strftime("%d %b %Y"),
            "category": cat.name if cat else "Uncategorized",
            "icon": cat.icon if cat else "💰"
        })

    # Unread notifications count
    notif_count = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False
    ).count()

    return {
        "income_this_month": round(income, 2),
        "expense_this_month": round(expense, 2),
        "balance_this_month": round(income - expense, 2),
        "total_balance": round(total_balance, 2),
        "recent_transactions": recent_list,
        "unread_notifications": notif_count
    }


# ════════════════════════════════════════════════════════════
# ACCOUNTS / WALLETS ROUTES
# ════════════════════════════════════════════════════════════

@app.get("/accounts")
def get_accounts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    accounts = db.query(models.Account).filter(
        models.Account.user_id == current_user.id
    ).all()
    return [{"id": a.id, "name": a.name, "type": a.account_type,
             "balance": a.balance, "currency": a.currency, "color": a.color}
            for a in accounts]


@app.post("/accounts")
def create_account(
    name: str = Form(...),
    account_type: str = Form("bank"),
    balance: float = Form(0.0),
    currency: str = Form("INR"),
    color: str = Form("#4CAF50"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    account = models.Account(
        user_id=current_user.id,
        name=name, account_type=account_type,
        balance=balance, currency=currency, color=color
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return {"id": account.id, "name": account.name, "balance": account.balance}


@app.put("/accounts/{account_id}")
def update_account(
    account_id: int,
    name: str = Form(...),
    account_type: str = Form("bank"),
    color: str = Form("#4CAF50"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    account = db.query(models.Account).filter(
        models.Account.id == account_id,
        models.Account.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    account.name = name
    account.account_type = account_type
    account.color = color
    db.commit()
    return {"message": "Account updated"}


@app.delete("/accounts/{account_id}")
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    account = db.query(models.Account).filter(
        models.Account.id == account_id,
        models.Account.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(account)
    db.commit()
    return {"message": "Account deleted"}


# ════════════════════════════════════════════════════════════
# CATEGORIES ROUTES
# ════════════════════════════════════════════════════════════

@app.get("/categories")
def get_categories(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    cats = db.query(models.Category).filter(
        models.Category.user_id == current_user.id
    ).all()
    return [{"id": c.id, "name": c.name, "type": c.category_type,
             "icon": c.icon, "color": c.color} for c in cats]


@app.post("/categories")
def create_category(
    name: str = Form(...),
    category_type: str = Form(...),
    icon: str = Form("💰"),
    color: str = Form("#4CAF50"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    cat = models.Category(
        user_id=current_user.id,
        name=name, category_type=category_type,
        icon=icon, color=color
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return {"id": cat.id, "name": cat.name}


@app.delete("/categories/{cat_id}")
def delete_category(
    cat_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    cat = db.query(models.Category).filter(
        models.Category.id == cat_id,
        models.Category.user_id == current_user.id
    ).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)
    db.commit()
    return {"message": "Deleted"}


# ════════════════════════════════════════════════════════════
# TRANSACTIONS ROUTES
# ════════════════════════════════════════════════════════════

@app.get("/transactions")
def get_transactions(
    skip: int = 0,
    limit: int = 50,
    transaction_type: Optional[str] = None,
    category_id: Optional[int] = None,
    account_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get transactions with optional filters"""
    query = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id
    )
    if transaction_type:
        query = query.filter(models.Transaction.transaction_type == transaction_type)
    if category_id:
        query = query.filter(models.Transaction.category_id == category_id)
    if account_id:
        query = query.filter(models.Transaction.account_id == account_id)

    transactions = query.order_by(models.Transaction.date.desc()).offset(skip).limit(limit).all()

    result = []
    for t in transactions:
        cat = db.query(models.Category).filter(models.Category.id == t.category_id).first()
        acc = db.query(models.Account).filter(models.Account.id == t.account_id).first()
        result.append({
            "id": t.id,
            "amount": t.amount,
            "type": t.transaction_type,
            "description": t.description or "",
            "date": t.date.strftime("%Y-%m-%d"),
            "category": cat.name if cat else "Uncategorized",
            "category_icon": cat.icon if cat else "💰",
            "category_color": cat.color if cat else "#999",
            "account": acc.name if acc else "Unknown",
            "receipt_image": t.receipt_image
        })
    return result


@app.post("/transactions")
async def create_transaction(
    amount: float = Form(...),
    transaction_type: str = Form(...),
    description: str = Form(""),
    date: str = Form(...),
    category_id: int = Form(...),
    account_id: int = Form(...),
    receipt: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Add a new transaction, optionally with receipt image"""
    receipt_path = None
    if receipt and receipt.filename:
        # Save the uploaded receipt image
        ext = receipt.filename.split(".")[-1]
        filename = f"receipt_{current_user.id}_{datetime.utcnow().timestamp()}.{ext}"
        filepath = f"../data/uploads/{filename}"
        with open(filepath, "wb") as f:
            shutil.copyfileobj(receipt.file, f)
        receipt_path = filename

    transaction = models.Transaction(
        user_id=current_user.id,
        account_id=account_id,
        category_id=category_id,
        amount=amount,
        transaction_type=transaction_type,
        description=description,
        date=datetime.strptime(date, "%Y-%m-%d"),
        receipt_image=receipt_path
    )
    db.add(transaction)

    # Update account balance
    account = db.query(models.Account).filter(
        models.Account.id == account_id,
        models.Account.user_id == current_user.id
    ).first()
    if account:
        if transaction_type == "income":
            account.balance += amount
        else:
            account.balance -= amount

    db.commit()
    db.refresh(transaction)

    # Check if any budget is exceeded and create a notification
    _check_budget_alerts(current_user.id, category_id, db)

    return {"id": transaction.id, "message": "Transaction added"}


@app.delete("/transactions/{txn_id}")
def delete_transaction(
    txn_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    txn = db.query(models.Transaction).filter(
        models.Transaction.id == txn_id,
        models.Transaction.user_id == current_user.id
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Reverse the balance change
    account = db.query(models.Account).filter(models.Account.id == txn.account_id).first()
    if account:
        if txn.transaction_type == "income":
            account.balance -= txn.amount
        else:
            account.balance += txn.amount

    db.delete(txn)
    db.commit()
    return {"message": "Transaction deleted"}


# ════════════════════════════════════════════════════════════
# BUDGETS ROUTES
# ════════════════════════════════════════════════════════════

@app.get("/budgets")
def get_budgets(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    now = datetime.utcnow()
    budgets = db.query(models.Budget).filter(
        models.Budget.user_id == current_user.id
    ).all()

    result = []
    for b in budgets:
        cat = db.query(models.Category).filter(models.Category.id == b.category_id).first()
        # How much spent in this budget's period
        spent = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.user_id == current_user.id,
            models.Transaction.category_id == b.category_id,
            models.Transaction.transaction_type == "expense",
            models.Transaction.date >= b.start_date,
            models.Transaction.date <= b.end_date
        ).scalar() or 0

        result.append({
            "id": b.id,
            "category": cat.name if cat else "Unknown",
            "category_icon": cat.icon if cat else "💰",
            "category_color": cat.color if cat else "#999",
            "budget_amount": b.amount,
            "spent": round(spent, 2),
            "remaining": round(b.amount - spent, 2),
            "percentage": round((spent / b.amount) * 100, 1) if b.amount > 0 else 0,
            "period": b.period,
            "start_date": b.start_date.strftime("%Y-%m-%d"),
            "end_date": b.end_date.strftime("%Y-%m-%d")
        })
    return result


@app.post("/budgets")
def create_budget(
    category_id: int = Form(...),
    amount: float = Form(...),
    period: str = Form("monthly"),
    start_date: str = Form(...),
    end_date: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    budget = models.Budget(
        user_id=current_user.id,
        category_id=category_id,
        amount=amount,
        period=period,
        start_date=datetime.strptime(start_date, "%Y-%m-%d"),
        end_date=datetime.strptime(end_date, "%Y-%m-%d")
    )
    db.add(budget)
    db.commit()
    return {"message": "Budget created"}


@app.delete("/budgets/{budget_id}")
def delete_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    budget = db.query(models.Budget).filter(
        models.Budget.id == budget_id,
        models.Budget.user_id == current_user.id
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(budget)
    db.commit()
    return {"message": "Budget deleted"}


# ════════════════════════════════════════════════════════════
# ANALYTICS ROUTES
# ════════════════════════════════════════════════════════════

@app.get("/analytics/monthly")
def get_monthly_analytics(
    year: int = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Returns monthly income vs expense for a year (for bar/line chart)"""
    if not year:
        year = datetime.utcnow().year

    monthly_data = []
    month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

    for month in range(1, 13):
        income = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.user_id == current_user.id,
            models.Transaction.transaction_type == "income",
            extract("year", models.Transaction.date) == year,
            extract("month", models.Transaction.date) == month
        ).scalar() or 0

        expense = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.user_id == current_user.id,
            models.Transaction.transaction_type == "expense",
            extract("year", models.Transaction.date) == year,
            extract("month", models.Transaction.date) == month
        ).scalar() or 0

        monthly_data.append({
            "month": month_names[month - 1],
            "income": round(income, 2),
            "expense": round(expense, 2)
        })

    return monthly_data


@app.get("/analytics/category-breakdown")
def get_category_breakdown(
    transaction_type: str = "expense",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Returns spending by category (for pie/doughnut chart)"""
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)

    cats = db.query(models.Category).filter(
        models.Category.user_id == current_user.id,
        models.Category.category_type == transaction_type
    ).all()

    result = []
    for cat in cats:
        total = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.user_id == current_user.id,
            models.Transaction.category_id == cat.id,
            models.Transaction.transaction_type == transaction_type,
            models.Transaction.date >= month_start
        ).scalar() or 0

        if total > 0:
            result.append({
                "category": cat.name,
                "icon": cat.icon,
                "color": cat.color,
                "amount": round(total, 2)
            })

    return sorted(result, key=lambda x: x["amount"], reverse=True)


# ════════════════════════════════════════════════════════════
# RECURRING PAYMENTS ROUTES
# ════════════════════════════════════════════════════════════

@app.get("/recurring")
def get_recurring(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    items = db.query(models.RecurringPayment).filter(
        models.RecurringPayment.user_id == current_user.id
    ).all()
    return [{
        "id": r.id,
        "description": r.description,
        "amount": r.amount,
        "type": r.transaction_type,
        "frequency": r.frequency,
        "next_date": r.next_date.strftime("%Y-%m-%d"),
        "is_active": r.is_active
    } for r in items]


@app.post("/recurring")
def create_recurring(
    description: str = Form(...),
    amount: float = Form(...),
    transaction_type: str = Form(...),
    frequency: str = Form(...),
    next_date: str = Form(...),
    account_id: int = Form(...),
    category_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    r = models.RecurringPayment(
        user_id=current_user.id,
        account_id=account_id,
        category_id=category_id,
        description=description,
        amount=amount,
        transaction_type=transaction_type,
        frequency=frequency,
        next_date=datetime.strptime(next_date, "%Y-%m-%d")
    )
    db.add(r)
    db.commit()
    return {"message": "Recurring payment added"}


@app.post("/recurring/{r_id}/toggle")
def toggle_recurring(
    r_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    r = db.query(models.RecurringPayment).filter(
        models.RecurringPayment.id == r_id,
        models.RecurringPayment.user_id == current_user.id
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    r.is_active = not r.is_active
    db.commit()
    return {"is_active": r.is_active}


@app.delete("/recurring/{r_id}")
def delete_recurring(
    r_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    r = db.query(models.RecurringPayment).filter(
        models.RecurringPayment.id == r_id,
        models.RecurringPayment.user_id == current_user.id
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(r)
    db.commit()
    return {"message": "Deleted"}


# ════════════════════════════════════════════════════════════
# NOTIFICATIONS ROUTES
# ════════════════════════════════════════════════════════════

@app.get("/notifications")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    notes = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id
    ).order_by(models.Notification.created_at.desc()).limit(20).all()
    return [{
        "id": n.id,
        "message": n.message,
        "type": n.notification_type,
        "is_read": n.is_read,
        "created_at": n.created_at.strftime("%d %b %Y %H:%M")
    } for n in notes]


@app.post("/notifications/{n_id}/read")
def mark_read(
    n_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    n = db.query(models.Notification).filter(
        models.Notification.id == n_id,
        models.Notification.user_id == current_user.id
    ).first()
    if n:
        n.is_read = True
        db.commit()
    return {"message": "Marked as read"}


@app.post("/notifications/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "All marked as read"}


# ════════════════════════════════════════════════════════════
# REPORTS ROUTES
# ════════════════════════════════════════════════════════════

@app.get("/reports/summary")
def get_report_summary(
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Detailed report between two dates"""
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")

    transactions = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.date >= start,
        models.Transaction.date <= end
    ).order_by(models.Transaction.date.desc()).all()

    total_income = sum(t.amount for t in transactions if t.transaction_type == "income")
    total_expense = sum(t.amount for t in transactions if t.transaction_type == "expense")

    txn_list = []
    for t in transactions:
        cat = db.query(models.Category).filter(models.Category.id == t.category_id).first()
        txn_list.append({
            "date": t.date.strftime("%d %b %Y"),
            "description": t.description or "",
            "category": cat.name if cat else "Uncategorized",
            "type": t.transaction_type,
            "amount": t.amount
        })

    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_income": round(total_income, 2),
        "total_expense": round(total_expense, 2),
        "net": round(total_income - total_expense, 2),
        "transaction_count": len(transactions),
        "transactions": txn_list
    }


# ════════════════════════════════════════════════════════════
# BACKUP / EXPORT ROUTES
# ════════════════════════════════════════════════════════════

@app.get("/export/json")
def export_json(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Export all user data as JSON for backup"""
    transactions = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id
    ).all()
    accounts = db.query(models.Account).filter(
        models.Account.user_id == current_user.id
    ).all()
    categories = db.query(models.Category).filter(
        models.Category.user_id == current_user.id
    ).all()

    return {
        "exported_at": datetime.utcnow().isoformat(),
        "user": current_user.username,
        "accounts": [{"name": a.name, "balance": a.balance, "type": a.account_type} for a in accounts],
        "categories": [{"name": c.name, "type": c.category_type, "icon": c.icon} for c in categories],
        "transactions": [{
            "amount": t.amount,
            "type": t.transaction_type,
            "description": t.description,
            "date": t.date.isoformat(),
        } for t in transactions]
    }


# ════════════════════════════════════════════════════════════
# HELPER — budget alert checker (called after each transaction)
# ════════════════════════════════════════════════════════════

def _check_budget_alerts(user_id: int, category_id: int, db: Session):
    """Creates a notification if spending exceeds 80% or 100% of budget"""
    now = datetime.utcnow()
    budget = db.query(models.Budget).filter(
        models.Budget.user_id == user_id,
        models.Budget.category_id == category_id,
        models.Budget.start_date <= now,
        models.Budget.end_date >= now
    ).first()

    if not budget:
        return

    spent = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.user_id == user_id,
        models.Transaction.category_id == category_id,
        models.Transaction.transaction_type == "expense",
        models.Transaction.date >= budget.start_date,
        models.Transaction.date <= budget.end_date
    ).scalar() or 0

    cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    cat_name = cat.name if cat else "category"
    pct = (spent / budget.amount) * 100 if budget.amount > 0 else 0

    if pct >= 100:
        msg = f"⚠️ Budget exceeded for {cat_name}! Spent ₹{spent:.0f} of ₹{budget.amount:.0f}"
        notif_type = "alert"
    elif pct >= 80:
        msg = f"🔔 You've used {pct:.0f}% of your {cat_name} budget (₹{spent:.0f}/₹{budget.amount:.0f})"
        notif_type = "warning"
    else:
        return

    # Avoid duplicate notifications
    existing = db.query(models.Notification).filter(
        models.Notification.user_id == user_id,
        models.Notification.message == msg
    ).first()
    if not existing:
        db.add(models.Notification(user_id=user_id, message=msg, notification_type=notif_type))
        db.commit()
