"""Rename the existing generic customer without replacing its identity."""

from alembic import op
import sqlalchemy as sa

revision = "0012_final_customer"
down_revision = "0011_open_sale_names"
branch_labels = None
depends_on = None


def upgrade() -> None:
    customers = sa.table("customers", sa.column("document_number"), sa.column("name"))
    op.get_bind().execute(customers.update().where(customers.c.document_number == "0000000000").values(name="Cliente final"))


def downgrade() -> None:
    customers = sa.table("customers", sa.column("document_number"), sa.column("name"))
    op.get_bind().execute(customers.update().where(customers.c.document_number == "0000000000", customers.c.name == "Cliente final").values(name="Cliente Predeterminado"))
