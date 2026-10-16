"""Business-scoped unique labels without changing transaction identifiers."""

from alembic import op
import sqlalchemy as sa

revision = "0014_open_sale_slots"
down_revision = "0013_catalog_services"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    business_id = connection.scalar(sa.text("SELECT id FROM business_settings ORDER BY id LIMIT 1"))
    rows = connection.execute(sa.text("SELECT id, name, status FROM open_sales ORDER BY created_at, id")).all()
    if rows and business_id is None:
        raise RuntimeError("Existing open sales require a business configuration before upgrading")
    occupied: dict[str, str] = {}
    for row in rows:
        key = " ".join(row.name.split()).casefold()
        if row.status in {"DRAFT", "HELD"}:
            if key in occupied:
                raise RuntimeError(f"Rename duplicate open sale labels before upgrading: {occupied[key]}, {row.id}")
            occupied[key] = row.id
    op.add_column("open_sales", sa.Column("business_id", sa.Integer(), nullable=True))
    op.add_column("open_sales", sa.Column("name_key", sa.String(240), nullable=True))
    for row in rows:
        connection.execute(sa.text("UPDATE open_sales SET business_id=:business, name_key=:key WHERE id=:id"),
            {"business": business_id, "key": " ".join(row.name.split()).casefold(), "id": row.id})
    op.alter_column("open_sales", "business_id", nullable=False)
    op.alter_column("open_sales", "name_key", nullable=False)
    op.create_foreign_key("fk_open_sale_business", "open_sales", "business_settings", ["business_id"], ["id"])
    op.create_index("ix_open_sales_business_id", "open_sales", ["business_id"])
    op.create_index("uq_open_sale_active_name", "open_sales", ["business_id", "name_key"], unique=True,
        postgresql_where=sa.text("status IN ('DRAFT', 'HELD')"))


def downgrade() -> None:
    op.drop_index("uq_open_sale_active_name", table_name="open_sales")
    op.drop_index("ix_open_sales_business_id", table_name="open_sales")
    op.drop_constraint("fk_open_sale_business", "open_sales", type_="foreignkey")
    op.drop_column("open_sales", "name_key")
    op.drop_column("open_sales", "business_id")
