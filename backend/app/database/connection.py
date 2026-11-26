"""Database connection and session management."""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase
from sqlalchemy.pool import StaticPool
from contextlib import contextmanager
from typing import Generator

from app.configuration.settings import settings


class Base(DeclarativeBase):
    """Base class for all database models."""
    pass


# Create engine with SQLite-specific configuration
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
    poolclass=StaticPool if "sqlite" in settings.database_url else None,
    echo=settings.database_echo,
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency for FastAPI to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """Context manager for database session outside of FastAPI dependencies."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_database() -> None:
    """Initialize database tables."""
    from app.models import zone, camera, detection_event, user  # noqa: F401
    Base.metadata.create_all(bind=engine)


def drop_database() -> None:
    """Drop all database tables (use with caution)."""
    Base.metadata.drop_all(bind=engine)