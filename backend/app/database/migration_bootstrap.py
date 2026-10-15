"""Supply the runtime-owned baseline required by historical migrations."""

from sqlalchemy import Column, DateTime, Integer, MetaData, Numeric, String, Table, func
from sqlalchemy.engine import Connection


def ensure_business_settings_baseline(connection: Connection) -> None:
    # Keep this pre-0009 definition frozen; later columns belong to Alembic.
    baseline = Table(
        "business_settings", MetaData(),
        Column("id", Integer, primary_key=True),
        Column("business_name", String(160), nullable=False),
        Column("tax_id", String(80), nullable=False),
        Column("address", String(255), nullable=False),
        Column("phone", String(40), nullable=False),
        Column("email", String(160), nullable=False),
        Column("city", String(120), nullable=False),
        Column("currency", String(10), nullable=False),
        Column("tax_percentage", Numeric(5, 2), nullable=False),
        Column("logo_url", String(255)),
        Column("updated_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
    baseline.create(connection, checkfirst=True)
