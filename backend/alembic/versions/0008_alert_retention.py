"""Preserve inventory condition independently of notification retention."""

from alembic import op
import sqlalchemy as sa

revision = "0008_alert_retention"
down_revision = "0007_inventory_alerts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("inventory", sa.Column("notification_status", sa.String(20), nullable=True))
    op.execute(sa.text(
        "UPDATE inventory SET notification_status = "
        "(SELECT status FROM inventory_alerts WHERE inventory_alerts.product_id = inventory.product_id "
        "AND inventory_alerts.active = true LIMIT 1)"
    ))


def downgrade() -> None:
    op.drop_column("inventory", "notification_status")
