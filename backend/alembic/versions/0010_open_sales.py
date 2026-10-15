"""Persist open sales independently of completed financial transactions."""

from alembic import op
import sqlalchemy as sa

revision = "0010_open_sales"
down_revision = "0009_print_preferences"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("open_sales",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("cashier_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id", ondelete="SET NULL")),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False),
        sa.Column("tax_percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("discount_type", sa.String(16), nullable=False),
        sa.Column("discount_value", sa.Numeric(12, 2), nullable=False),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False),
        sa.Column("tax_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("discount_amount", sa.Numeric(12, 2)),
        sa.Column("total", sa.Numeric(12, 2)),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("sale_id", sa.Integer(), sa.ForeignKey("sales.id"), unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("cancelled_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("version >= 1", name="ck_open_sale_version"),
        sa.CheckConstraint("status IN ('DRAFT', 'HELD', 'COMPLETED', 'CANCELLED')", name="ck_open_sale_status"),
        sa.CheckConstraint("status <> 'COMPLETED' OR sale_id IS NOT NULL", name="ck_open_sale_completed"),
    )
    op.create_index("ix_open_sales_cashier_id", "open_sales", ["cashier_id"])
    op.create_index("ix_open_sales_status", "open_sales", ["status"])
    op.create_table("open_sale_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("open_sale_id", sa.String(36), sa.ForeignKey("open_sales.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="SET NULL")),
        sa.Column("original_product_id", sa.Integer(), nullable=False),
        sa.Column("product_name", sa.String(160), nullable=False),
        sa.Column("product_sku", sa.String(80), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_open_sale_line_quantity"),
        sa.UniqueConstraint("open_sale_id", "original_product_id", name="uq_open_sale_product"),
    )
    op.create_index("ix_open_sale_lines_open_sale_id", "open_sale_lines", ["open_sale_id"])


def downgrade() -> None:
    op.drop_table("open_sale_lines")
    op.drop_table("open_sales")
