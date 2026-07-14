from __future__ import annotations

import time

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError

from app import models  # noqa: F401
from app.database.migrations import ensure_runtime_schema
from app.database.seed import seed_initial_data
from app.database.session import database_manager


def wait_for_database(max_attempts: int = 30, delay_seconds: int = 2) -> None:
    for attempt in range(1, max_attempts + 1):
        try:
            with database_manager.engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return
        except OperationalError:
            if attempt == max_attempts:
                raise
            time.sleep(delay_seconds)


def prepare_database() -> None:
    wait_for_database()
    inspector = inspect(database_manager.engine)
    tables = set(inspector.get_table_names())
    alembic_config = Config("alembic.ini")

    if tables and "alembic_version" not in tables:
        database_manager.create_all()
        ensure_runtime_schema()
        with database_manager.session_factory() as db:
            seed_initial_data(db)
        command.stamp(alembic_config, "head")
        return

    command.upgrade(alembic_config, "head")
    database_manager.create_all()
    ensure_runtime_schema()
    with database_manager.session_factory() as db:
        seed_initial_data(db)


if __name__ == "__main__":
    prepare_database()
