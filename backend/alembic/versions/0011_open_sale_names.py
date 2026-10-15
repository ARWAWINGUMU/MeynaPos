"""Persist open-sale labels and allocate collision-free default numbers."""

from alembic import op
import sqlalchemy as sa

revision = "0011_open_sale_names"
down_revision = "0010_open_sales"
branch_labels = None
depends_on = None


def upgrade() -> None:
    numbers = op.create_table("open_sale_numbers", sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True))
    op.add_column("open_sales", sa.Column("number", sa.Integer(), nullable=True))
    op.add_column("open_sales", sa.Column("name", sa.String(80), nullable=True))
    connection = op.get_bind()
    sales = sa.table("open_sales", sa.column("id"), sa.column("number"), sa.column("name"))
    identifiers = connection.execute(sa.text("SELECT id FROM open_sales ORDER BY created_at, id")).scalars().all()
    for identifier in identifiers:
        number = connection.execute(numbers.insert().values().returning(numbers.c.id)).scalar_one()
        connection.execute(sales.update().where(sales.c.id == identifier).values(number=number, name=f"Venta {number}"))
    op.alter_column("open_sales", "number", nullable=False)
    op.alter_column("open_sales", "name", nullable=False)
    op.create_unique_constraint("uq_open_sale_number", "open_sales", ["number"])


def downgrade() -> None:
    op.drop_constraint("uq_open_sale_number", "open_sales", type_="unique")
    op.drop_column("open_sales", "name")
    op.drop_column("open_sales", "number")
    op.drop_table("open_sale_numbers")
