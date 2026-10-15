"""Persist printer preferences on the business configuration."""

from alembic import op
import sqlalchemy as sa

revision = "0009_print_preferences"
down_revision = "0008_alert_retention"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("business_settings", sa.Column("print_preferences", sa.JSON(), nullable=False,
        server_default='{"format":"LETTER","margin":12}'))


def downgrade() -> None:
    op.drop_column("business_settings", "print_preferences")
