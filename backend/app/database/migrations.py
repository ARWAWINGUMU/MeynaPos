from sqlalchemy import inspect, text

from app.database.session import database_manager


def ensure_runtime_schema() -> None:
    inspector = inspect(database_manager.engine)
    if "users" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    statements: list[str] = []
    column_definitions = {
        "first_name": "VARCHAR(80)",
        "last_name": "VARCHAR(80)",
        "username": "VARCHAR(80)",
        "failed_login_attempts": "INTEGER NOT NULL DEFAULT 0",
        "locked": "BOOLEAN NOT NULL DEFAULT FALSE",
        "locked_at": "TIMESTAMP WITH TIME ZONE",
        "last_login_at": "TIMESTAMP WITH TIME ZONE",
    }

    for column_name, definition in column_definitions.items():
        if column_name not in existing_columns:
            statements.append(f"ALTER TABLE users ADD COLUMN {column_name} {definition}")

    with database_manager.engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        connection.execute(text("UPDATE users SET failed_login_attempts = 0 WHERE failed_login_attempts IS NULL"))
        connection.execute(text("UPDATE users SET locked = FALSE WHERE locked IS NULL"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"))

    _ensure_columns(
        "products",
        {
            "image_url": "VARCHAR(255)",
            "is_active": "BOOLEAN NOT NULL DEFAULT TRUE",
        },
    )
    _ensure_columns("customers", {"address": "VARCHAR(255)"})
    _ensure_columns(
        "sales",
        {
            "tax_percentage": "NUMERIC(5, 2) NOT NULL DEFAULT 0.00",
            "tax_amount": "NUMERIC(12, 2) NOT NULL DEFAULT 0.00",
        },
    )
    with database_manager.engine.begin() as connection:
        connection.execute(text("UPDATE sales SET tax_amount = tax WHERE tax_amount = 0 OR tax_amount IS NULL"))


def _ensure_columns(table_name: str, column_definitions: dict[str, str]) -> None:
    inspector = inspect(database_manager.engine)
    if table_name not in inspector.get_table_names():
        return
    existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
    with database_manager.engine.begin() as connection:
        for column_name, definition in column_definitions.items():
            if column_name not in existing_columns:
                connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"))
