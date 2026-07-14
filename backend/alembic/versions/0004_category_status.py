"""Add category active status.

Revision ID: 0004_category_status
Revises: 0003_products_qr_code
Create Date: 2026-07-14
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_category_status"
down_revision = "0003_products_qr_code"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("categories")}
    if "is_active" not in columns:
        op.add_column("categories", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
        op.alter_column("categories", "is_active", server_default=None)


def downgrade() -> None:
    op.drop_column("categories", "is_active")
