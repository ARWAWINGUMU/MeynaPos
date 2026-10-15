"""Add inventory alerts.

Revision ID: 0007_inventory_alerts
Revises: 0006_superuser_snapshots
Create Date: 2026-10-13
"""

from alembic import op
import sqlalchemy as sa


revision = "0007_inventory_alerts"
down_revision = "0006_superuser_snapshots"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "inventory_alerts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("minimum_stock", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inventory_alerts_product_id", "inventory_alerts", ["product_id"])
    op.create_index("ix_inventory_alerts_active", "inventory_alerts", ["active"])
    op.create_index("ix_inventory_alerts_read", "inventory_alerts", ["read"])

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.create_index(
            "uq_inventory_alerts_active_product",
            "inventory_alerts",
            ["product_id"],
            unique=True,
            postgresql_where=sa.text("active = true"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.drop_index("uq_inventory_alerts_active_product", table_name="inventory_alerts")
    op.drop_index("ix_inventory_alerts_read", table_name="inventory_alerts")
    op.drop_index("ix_inventory_alerts_active", table_name="inventory_alerts")
    op.drop_index("ix_inventory_alerts_product_id", table_name="inventory_alerts")
    op.drop_table("inventory_alerts")
