from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

# ── USERS TABLE ──────────────────────────────────────────────
# Stores login credentials and PIN for security
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    pin_hash = Column(String, nullable=True)
    google_id = Column(String, nullable=True, unique=True)
    created_at = Column(DateTime, default=func.now())

    # Profile fields
    full_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    country = Column(String, nullable=True, default="India")
    currency_pref = Column(String, nullable=True, default="INR")
    avatar_url = Column(String, nullable=True)
    last_login = Column(DateTime, nullable=True)
    email_notifications = Column(Boolean, default=True)
    budget_alerts = Column(Boolean, default=True)

    # relationships — lets us do user.accounts, user.transactions etc.
    accounts = relationship("Account", back_populates="user", cascade="all, delete")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete")
    categories = relationship("Category", back_populates="user", cascade="all, delete")
    budgets = relationship("Budget", back_populates="user", cascade="all, delete")
    recurring = relationship("RecurringPayment", back_populates="user", cascade="all, delete")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete")
    reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete")


# ── ACCOUNTS / WALLETS TABLE ──────────────────────────────────
# e.g. "Cash", "HDFC Savings", "GPay Wallet"
class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)               # e.g. "Cash", "SBI Account"
    account_type = Column(String, default="bank")       # bank / wallet / cash / credit
    balance = Column(Float, default=0.0)
    currency = Column(String, default="INR")
    color = Column(String, default="#4CAF50")           # display color
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account")


# ── CATEGORIES TABLE ──────────────────────────────────────────
# e.g. "Food", "Salary", "Rent"
class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)               # e.g. "Food & Dining"
    category_type = Column(String, nullable=False)      # "income" or "expense"
    icon = Column(String, default="💰")                 # emoji icon
    color = Column(String, default="#FF5722")

    user = relationship("User", back_populates="categories")
    transactions = relationship("Transaction", back_populates="category")
    budgets = relationship("Budget", back_populates="category")


# ── TRANSACTIONS TABLE ────────────────────────────────────────
# Every income/expense entry goes here
class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    amount = Column(Float, nullable=False)
    transaction_type = Column(String, nullable=False)   # "income" or "expense"
    description = Column(String, nullable=True)
    date = Column(DateTime, default=func.now())
    receipt_image = Column(String, nullable=True)       # file path to uploaded receipt
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="transactions")
    account = relationship("Account", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")


# ── BUDGETS TABLE ─────────────────────────────────────────────
# Set a spending limit per category per month
class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    amount = Column(Float, nullable=False)              # budget limit
    period = Column(String, default="monthly")         # monthly / weekly / yearly
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)

    user = relationship("User", back_populates="budgets")
    category = relationship("Category", back_populates="budgets")


# ── RECURRING PAYMENTS TABLE ──────────────────────────────────
# Auto-repeating transactions like rent, subscriptions
class RecurringPayment(Base):
    __tablename__ = "recurring_payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    amount = Column(Float, nullable=False)
    transaction_type = Column(String, nullable=False)   # income or expense
    description = Column(String, nullable=False)        # e.g. "Netflix subscription"
    frequency = Column(String, nullable=False)          # daily / weekly / monthly / yearly
    next_date = Column(DateTime, nullable=False)        # when it should run next
    is_active = Column(Boolean, default=True)

    user = relationship("User", back_populates="recurring")


# ── NOTIFICATIONS TABLE ───────────────────────────────────────
# Budget alerts, reminders, recurring payment notices
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(String, nullable=False)
    notification_type = Column(String, default="info")  # info / warning / alert
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="notifications")


# ── PASSWORD RESET TOKENS TABLE ───────────────────────────────
# Stores secure one-time tokens for password reset
# A token is valid for 30 minutes and can only be used once
class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # secrets.token_urlsafe(32) produces a 43-char cryptographically secure string
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)   # 30 minutes after creation
    is_used = Column(Boolean, default=False)        # one-time use only
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="reset_tokens")
