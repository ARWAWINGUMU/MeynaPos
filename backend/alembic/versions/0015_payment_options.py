"""Persist business payment options and historical display-name snapshots."""

from alembic import op
import sqlalchemy as sa

revision = "0015_payment_options"
down_revision = "0014_open_sale_slots"
branch_labels = None
depends_on = None


def upgrade() -> None:
    options = op.create_table("payment_options",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("business_id", sa.Integer(), sa.ForeignKey("business_settings.id"), nullable=False),
        sa.Column("code", sa.String(40), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("name_key", sa.String(240), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("business_id", "name_key", name="uq_payment_option_name"),
        sa.UniqueConstraint("business_id", "code", name="uq_payment_option_code"))
    op.create_index("ix_payment_options_business_id", "payment_options", ["business_id"])
    op.add_column("payments", sa.Column("method_id", sa.Integer(), nullable=True))
    op.add_column("payments", sa.Column("method_name", sa.String(80), nullable=True))
    op.create_foreign_key("fk_payment_option", "payments", "payment_options", ["method_id"], ["id"])
    connection = op.get_bind()
    for business_id in connection.execute(sa.text("SELECT id FROM business_settings")).scalars():
        for code, name, kind in (("CASH", "Efectivo", "CASH"), ("CARD", "Tarjeta", "CARD"),
                                  ("TRANSFER", "Transferencia", "TRANSFER"), ("QR_BREB", "QR Bre-B", "TRANSFER")):
            connection.execute(options.insert().values(business_id=business_id, code=code, name=name,
                name_key=" ".join(name.split()).casefold(), kind=kind, is_active=True))


def downgrade() -> None:
    op.drop_constraint("fk_payment_option", "payments", type_="foreignkey")
    op.drop_column("payments", "method_name")
    op.drop_column("payments", "method_id")
    op.drop_table("payment_options")
