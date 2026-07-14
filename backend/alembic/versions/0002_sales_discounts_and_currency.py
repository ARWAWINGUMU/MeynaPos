"""Add sale discounts and COP currency default.

Revision ID: 0002_sales_discounts_and_currency
Revises: 0001_initial_schema
Create Date: 2026-07-14
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_sales_discounts_and_currency"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    sales_columns = {column["name"] for column in inspector.get_columns("sales")}
    discount_type = sa.Enum("NONE", "FIXED", "PERCENTAGE", name="discounttype")
    discount_type.create(op.get_bind(), checkfirst=True)

    if "tax_percentage" not in sales_columns:
        op.add_column("sales", sa.Column("tax_percentage", sa.Numeric(5, 2), nullable=False, server_default="0.00"))
    if "tax_amount" not in sales_columns:
        op.add_column("sales", sa.Column("tax_amount", sa.Numeric(12, 2), nullable=False, server_default="0.00"))
        op.execute("UPDATE sales SET tax_amount = tax WHERE tax_amount = 0 OR tax_amount IS NULL")
    if "discount_type" not in sales_columns:
        op.add_column("sales", sa.Column("discount_type", discount_type, nullable=False, server_default="NONE"))
    if "discount_value" not in sales_columns:
        op.add_column("sales", sa.Column("discount_value", sa.Numeric(12, 2), nullable=False, server_default="0.00"))
    if "discount_amount" not in sales_columns:
        op.add_column("sales", sa.Column("discount_amount", sa.Numeric(12, 2), nullable=False, server_default="0.00"))

    if "business_settings" in inspector.get_table_names():
        op.execute("UPDATE business_settings SET currency = 'COP' WHERE currency IS NULL OR currency = ''")

    for column_name in ("tax_percentage", "tax_amount", "discount_type", "discount_value", "discount_amount"):
        op.alter_column("sales", column_name, server_default=None)


def downgrade() -> None:
    op.drop_column("sales", "discount_amount")
    op.drop_column("sales", "discount_value")
    op.drop_column("sales", "discount_type")
    sa.Enum(name="discounttype").drop(op.get_bind(), checkfirst=True)
