from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id                   = Column(Integer, primary_key=True, index=True)
    username             = Column(String(100), unique=True, index=True, nullable=False)
    email                = Column(String(255), unique=True, index=True, nullable=False)
    password_hash        = Column(String(256), nullable=False)
    pin_hash             = Column(String(256), nullable=True)
    google_id            = Column(String(255), nullable=True, unique=True)
    created_at           = Column(DateTime, default=func.now())

    # Profile fields
    full_name            = Column(String(200), nullable=True)
    phone                = Column(String(20),  nullable=True)
    country              = Column(String(100), nullable=True, default="India")
    currency_pref        = Column(String(10),  nullable=True, default="INR")
    avatar_url           = Column(String(500), nullable=True)
    last_login           = Column(DateTime,    nullable=True)
    email_notifications  = Column(Boolean, default=True)
    budget_alerts        = Column(Boolean, default=True)

    accounts      = relationship("Account",           back_populates="user", cascade="all, delete")
    transactions  = relationship("Transaction",       back_populates="user", cascade="all, delete")
    categories    = relationship("Category",          back_populates="user", cascade="all, delete")
    budgets       = relationship("Budget",            back_populates="user", cascade="all, delete")
    recurring     = relationship("RecurringPayment",  back_populates="user", cascade="all, delete")
    notifications = relationship("Notification",      back_populates="user", cascade="all, delete")
    reset_tokens  = relationship("PasswordResetToken",back_populates="user", cascade="all, delete")
    chat_messages = relationship("ChatMessage",       back_populates="user", cascade="all, delete")


class Account(Base):
    __tablename__ = "accounts"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    name         = Column(String(200), nullable=False)
    account_type = Column(String(50),  default="bank")
    balance      = Column(Float, default=0.0)
    currency     = Column(String(10),  default="INR")
    color        = Column(String(20),  default="#4CAF50")
    created_at   = Column(DateTime,    default=func.now())

    user         = relationship("User",        back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account")


class Category(Base):
    __tablename__ = "categories"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    name          = Column(String(200), nullable=False)
    category_type = Column(String(20),  nullable=False)
    icon          = Column(String(20),  default="💰")
    color         = Column(String(20),  default="#FF5722")

    user         = relationship("User",        back_populates="categories")
    transactions = relationship("Transaction", back_populates="category")
    budgets      = relationship("Budget",      back_populates="category")


class Transaction(Base):
    __tablename__ = "transactions"

    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"),     nullable=False)
    account_id       = Column(Integer, ForeignKey("accounts.id"),  nullable=True)
    category_id      = Column(Integer, ForeignKey("categories.id"),nullable=True)
    amount           = Column(Float,      nullable=False)
    transaction_type = Column(String(20), nullable=False)
    description      = Column(String(500),nullable=True)
    date             = Column(DateTime,   default=func.now())
    receipt_image    = Column(String(500),nullable=True)
    created_at       = Column(DateTime,   default=func.now())

    user     = relationship("User",     back_populates="transactions")
    account  = relationship("Account",  back_populates="transactions")
    category = relationship("Category", back_populates="transactions")


class Budget(Base):
    __tablename__ = "budgets"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"),      nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    amount      = Column(Float,      nullable=False)
    period      = Column(String(20), default="monthly")
    start_date  = Column(DateTime,   nullable=False)
    end_date    = Column(DateTime,   nullable=False)

    user     = relationship("User",     back_populates="budgets")
    category = relationship("Category", back_populates="budgets")


class RecurringPayment(Base):
    __tablename__ = "recurring_payments"

    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"),     nullable=False)
    account_id       = Column(Integer, ForeignKey("accounts.id"),  nullable=True)
    category_id      = Column(Integer, ForeignKey("categories.id"),nullable=True)
    amount           = Column(Float,      nullable=False)
    transaction_type = Column(String(20), nullable=False)
    description      = Column(String(500),nullable=False)
    frequency        = Column(String(20), nullable=False)
    next_date        = Column(DateTime,   nullable=False)
    is_active        = Column(Boolean,    default=True)

    user = relationship("User", back_populates="recurring")


class Notification(Base):
    __tablename__ = "notifications"

    id                = Column(Integer, primary_key=True, index=True)
    user_id           = Column(Integer, ForeignKey("users.id"), nullable=False)
    message           = Column(String(1000), nullable=False)
    notification_type = Column(String(20),   default="info")
    is_read           = Column(Boolean,      default=False)
    created_at        = Column(DateTime,     default=func.now())

    user = relationship("User", back_populates="notifications")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id         = Column(Integer,  primary_key=True, index=True)
    user_id    = Column(Integer,  ForeignKey("users.id"), nullable=False)
    token      = Column(String(100), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used    = Column(Boolean,  default=False)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="reset_tokens")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    role       = Column(String(20), nullable=False)
    content    = Column(Text,       nullable=False)
    created_at = Column(DateTime,   default=func.now())

    user = relationship("User", back_populates="chat_messages")
