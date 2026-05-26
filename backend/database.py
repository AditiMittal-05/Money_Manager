from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# This points to the SQLite database file in the data folder
DATABASE_URL = "sqlite:///../data/money.db"

# Create the engine — this is the connection to the database
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # needed for SQLite only
)

# SessionLocal is used to talk to the database (read/write)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base is the parent class all our database models will inherit from
Base = declarative_base()

# This function gives us a database session and closes it after use
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
