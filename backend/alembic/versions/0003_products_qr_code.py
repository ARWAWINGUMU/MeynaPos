"""Add product QR code support.

Revision ID: 0003_products_qr_code
Revises: 0002_sales_disc
Create Date: 2026-07-14
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_products_qr_code"
down_revision = "0002_sales_disc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    product_columns = {column["name"] for column in inspector.get_columns("products")}
    if "qr_code" not in product_columns:
        op.add_column("products", sa.Column("qr_code", sa.String(length=255), nullable=True))
    op.create_index(op.f("ix_products_qr_code"), "products", ["qr_code"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_products_qr_code"), table_name="products")
    op.drop_column("products", "qr_code")
