"""Exercise real Alembic upgrades without touching the application's schema."""

import os
from pathlib import Path
import subprocess
import sys
from uuid import uuid4

import pytest
from sqlalchemy import MetaData, Table, create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.schema import CreateSchema, DropSchema

pytestmark = pytest.mark.skipif(not os.getenv("OPEN_SALES_POSTGRES_URL"), reason="An explicit PostgreSQL test connection is required")


@pytest.mark.parametrize("previous_revision", [None, "0010_open_sales"])
def test_alembic_fresh_and_existing_installations(previous_revision: str | None) -> None:
    url = os.environ["OPEN_SALES_POSTGRES_URL"]
    namespace = f"test_migrations_{uuid4().hex}"
    control = create_engine(url)
    with control.begin() as connection:
        connection.execute(CreateSchema(namespace))
    scoped_url = make_url(url).update_query_dict({"options": f"-csearch_path={namespace}"})
    engine = create_engine(scoped_url)
    environment = {**os.environ, "DATABASE_URL": scoped_url.render_as_string(hide_password=False)}

    def upgrade(revision: str) -> None:
        result = subprocess.run([sys.executable, "-m", "alembic", "upgrade", revision],
            cwd=Path(__file__).resolve().parents[2], env=environment, capture_output=True, text=True, timeout=90)
        assert result.returncode == 0, result.stderr

    try:
        customer_id = None
        if previous_revision:
            upgrade(previous_revision)
            metadata = MetaData()
            with engine.begin() as connection:
                customers = Table("customers", metadata, autoload_with=connection)
                customer_id = connection.execute(customers.insert().values(name="Cliente Predeterminado", document_number="0000000000").returning(customers.c.id)).scalar_one()
                roles = Table("roles", metadata, autoload_with=connection)
                role_id = connection.execute(roles.insert().values(name="ADMIN").returning(roles.c.id)).scalar_one()
                users = Table("users", metadata, autoload_with=connection)
                user_id = connection.execute(users.insert().values(full_name="Migration Test", email="migration@example.test",
                    hashed_password="not-an-authentication-credential", role_id=role_id, is_active=True, is_superuser=False,
                    must_change_password=False, token_version=0).returning(users.c.id)).scalar_one()
                sales = Table("open_sales", metadata, autoload_with=connection)
                for _ in range(3):
                    connection.execute(sales.insert().values(id=str(uuid4()), cashier_id=user_id, customer_id=customer_id,
                        status="DRAFT", version=1, currency="COP", tax_percentage=0, discount_type="NONE", discount_value=0,
                        subtotal=0, tax_amount=0, discount_amount=0, total=0, notes="Preserve this draft"))
                products = Table("products", metadata, autoload_with=connection)
                connection.execute(products.insert().values(name="Existing product", sku="EXISTING", price=10, cost=0))
        upgrade("head")
        upgrade("head")
        prepared = subprocess.run([sys.executable, "-m", "app.database.prepare_database"],
            cwd=Path(__file__).resolve().parents[2], env={**environment,
                "INITIAL_ADMIN_EMAIL": "migration-admin@example.test", "INITIAL_ADMIN_NAME": "Migration Admin",
                "INITIAL_ADMIN_PASSWORD": f"{uuid4().hex}Aa1!"}, capture_output=True, text=True, timeout=90)
        assert prepared.returncode == 0, prepared.stderr
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "0013_catalog_services"
            if customer_id is not None:
                row = connection.execute(text("SELECT id, name FROM customers WHERE document_number = '0000000000'")).one()
                assert row == (customer_id, "Cliente final")
                rows = connection.execute(text("SELECT number, name, notes FROM open_sales")).all()
                assert len(rows) == len({row.number for row in rows}) == 3
                assert all(row.name == f"Venta {row.number}" and row.notes == "Preserve this draft" for row in rows)
                assert connection.scalar(text("SELECT article_type FROM products WHERE sku = 'EXISTING'")) == "PRODUCT"
    finally:
        engine.dispose()
        with control.begin() as connection:
            connection.execute(DropSchema(namespace, cascade=True))
        control.dispose()
