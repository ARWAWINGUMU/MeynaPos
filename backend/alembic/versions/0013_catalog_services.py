"""Support services in the existing unified catalog."""

from alembic import op
import sqlalchemy as sa

revision = "0013_catalog_services"
down_revision = "0012_final_customer"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("article_type", sa.String(10), nullable=False, server_default="PRODUCT"))
    op.create_check_constraint("ck_product_article_type", "products", "article_type IN ('PRODUCT', 'SERVICE')")


def downgrade() -> None:
    op.drop_constraint("ck_product_article_type", "products", type_="check")
    op.drop_column("products", "article_type")
