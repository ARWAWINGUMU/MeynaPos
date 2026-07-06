from collections.abc import Generator
from threading import Lock

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


class DatabaseManager:
    """Singleton responsible for SQLAlchemy engine and session factory lifecycle."""

    _instance: "DatabaseManager | None" = None
    _lock: Lock = Lock()

    def __new__(cls) -> "DatabaseManager":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self.database_url = get_settings().database_url
        self.engine = create_engine(self.database_url, pool_pre_ping=True)
        self.session_factory = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self._initialized = True

    def configure(self, database_url: str) -> None:
        self.database_url = database_url
        connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
        self.engine = create_engine(database_url, pool_pre_ping=True, connect_args=connect_args)
        self.session_factory = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)

    def create_all(self) -> None:
        Base.metadata.create_all(bind=self.engine)

    def drop_all(self) -> None:
        Base.metadata.drop_all(bind=self.engine)

    def session(self) -> Generator[Session, None, None]:
        db = self.session_factory()
        try:
            yield db
        finally:
            db.close()


database_manager = DatabaseManager()


def get_db() -> Generator[Session, None, None]:
    yield from database_manager.session()

