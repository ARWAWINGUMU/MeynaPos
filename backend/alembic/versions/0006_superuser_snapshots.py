"""Add superuser and sale detail snapshots.

Revision ID: 0006_superuser_snapshots
Revises: 0005_temp_passwords
Create Date: 2026-07-23
"""

from alembic import op
import sqlalchemy as sa


revision = "0006_superuser_snapshots"
down_revision = "0005_temp_passwords"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "is_superuser" not in user_columns:
        op.add_column("users", sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.false()))
        op.alter_column("users", "is_superuser", server_default=None)

    sale_detail_columns = {column["name"] for column in inspector.get_columns("sale_details")}
    if "product_name" not in sale_detail_columns:
        op.add_column("sale_details", sa.Column("product_name", sa.String(length=160), nullable=False, server_default="Producto histórico"))
        op.alter_column("sale_details", "product_name", server_default=None)
    if "product_sku" not in sale_detail_columns:
        op.add_column("sale_details", sa.Column("product_sku", sa.String(length=80), nullable=True))
    if "product_barcode" not in sale_detail_columns:
        op.add_column("sale_details", sa.Column("product_barcode", sa.String(length=80), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE sale_details
            SET product_name = COALESCE((SELECT products.name FROM products WHERE products.id = sale_details.product_id), product_name),
                product_sku = (SELECT products.sku FROM products WHERE products.id = sale_details.product_id),
                product_barcode = (SELECT COALESCE(products.barcode, products.qr_code) FROM products WHERE products.id = sale_details.product_id)
            WHERE product_id IS NOT NULL
            """
        )
    )

    dialect_name = bind.dialect.name
    if dialect_name != "sqlite":
        foreign_keys = inspector.get_foreign_keys("sale_details")
        for foreign_key in foreign_keys:
            if foreign_key.get("referred_table") == "products" and foreign_key.get("constrained_columns") == ["product_id"]:
                op.drop_constraint(foreign_key["name"], "sale_details", type_="foreignkey")
                break
        op.alter_column("sale_details", "product_id", existing_type=sa.Integer(), nullable=True)
        op.create_foreign_key(
            "fk_sale_details_product_id_products",
            "sale_details",
            "products",
            ["product_id"],
            ["id"],
            ondelete="SET NULL",
        )
    else:
        with op.batch_alter_table("sale_details") as batch:
            batch.alter_column("product_id", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if bind.dialect.name != "sqlite":
        foreign_keys = inspector.get_foreign_keys("sale_details")
        for foreign_key in foreign_keys:
            if foreign_key.get("name") == "fk_sale_details_product_id_products":
                op.drop_constraint("fk_sale_details_product_id_products", "sale_details", type_="foreignkey")
                break
        op.create_foreign_key("sale_details_product_id_fkey", "sale_details", "products", ["product_id"], ["id"])

    sale_detail_columns = {column["name"] for column in inspector.get_columns("sale_details")}
    for column_name in ("product_barcode", "product_sku", "product_name"):
        if column_name in sale_detail_columns:
            op.drop_column("sale_details", column_name)

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "is_superuser" in user_columns:
        op.drop_column("users", "is_superuser")
