"""Initial MeynaPOS schema.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-23
"""

from alembic import op
import sqlalchemy as sa


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("roles", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.Enum("ADMIN", "CASHIER", name="rolename"), nullable=False), sa.Column("description", sa.String(length=255)))
    op.create_index(op.f("ix_roles_id"), "roles", ["id"], unique=False)
    op.create_unique_constraint("uq_roles_name", "roles", ["name"])
    op.create_table("categories", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(length=120), nullable=False), sa.Column("description", sa.String(length=255)), sa.UniqueConstraint("name"))
    op.create_table("customers", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(length=160), nullable=False), sa.Column("document_number", sa.String(length=80), unique=True), sa.Column("email", sa.String(length=160)), sa.Column("phone", sa.String(length=40)))
    op.create_table("suppliers", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(length=160), nullable=False), sa.Column("email", sa.String(length=160)), sa.Column("phone", sa.String(length=40)), sa.Column("address", sa.String(length=255)))
    op.create_table("users", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("full_name", sa.String(length=120), nullable=False), sa.Column("email", sa.String(length=160), nullable=False), sa.Column("hashed_password", sa.String(length=255), nullable=False), sa.Column("is_active", sa.Boolean(), nullable=False), sa.Column("role_id", sa.Integer(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.ForeignKeyConstraint(["role_id"], ["roles.id"]), sa.UniqueConstraint("email"))
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)
    op.create_table("products", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(length=160), nullable=False), sa.Column("description", sa.String(length=255)), sa.Column("barcode", sa.String(length=80), unique=True), sa.Column("sku", sa.String(length=80), nullable=False, unique=True), sa.Column("price", sa.Numeric(12, 2), nullable=False), sa.Column("cost", sa.Numeric(12, 2), nullable=False), sa.Column("category_id", sa.Integer()), sa.Column("supplier_id", sa.Integer()), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.ForeignKeyConstraint(["category_id"], ["categories.id"]), sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"]))
    op.create_index(op.f("ix_products_id"), "products", ["id"], unique=False)
    op.create_index(op.f("ix_products_name"), "products", ["name"], unique=False)
    op.create_index(op.f("ix_products_barcode"), "products", ["barcode"], unique=False)
    op.create_index(op.f("ix_products_sku"), "products", ["sku"], unique=False)
    op.create_table("inventory", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("product_id", sa.Integer(), nullable=False, unique=True), sa.Column("quantity", sa.Integer(), nullable=False), sa.Column("minimum_stock", sa.Integer(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.ForeignKeyConstraint(["product_id"], ["products.id"]))
    op.create_table("sessions", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("token_jti", sa.String(length=120), nullable=False, unique=True), sa.Column("user_id", sa.Integer(), nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.ForeignKeyConstraint(["user_id"], ["users.id"]))
    op.create_index(op.f("ix_sessions_token_jti"), "sessions", ["token_jti"], unique=False)
    op.create_table("sales", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("invoice_number", sa.String(length=60), nullable=False, unique=True), sa.Column("cashier_id", sa.Integer(), nullable=False), sa.Column("customer_id", sa.Integer()), sa.Column("subtotal", sa.Numeric(12, 2), nullable=False), sa.Column("tax", sa.Numeric(12, 2), nullable=False), sa.Column("total", sa.Numeric(12, 2), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.ForeignKeyConstraint(["cashier_id"], ["users.id"]), sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]))
    op.create_index(op.f("ix_sales_created_at"), "sales", ["created_at"], unique=False)
    op.create_index(op.f("ix_sales_invoice_number"), "sales", ["invoice_number"], unique=False)
    op.create_table("payments", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("sale_id", sa.Integer(), nullable=False, unique=True), sa.Column("method", sa.Enum("CASH", "CARD", "TRANSFER", name="paymentmethod"), nullable=False), sa.Column("amount", sa.Numeric(12, 2), nullable=False), sa.Column("reference", sa.String(length=120)), sa.ForeignKeyConstraint(["sale_id"], ["sales.id"]))
    op.create_table("sale_details", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("sale_id", sa.Integer(), nullable=False), sa.Column("product_id", sa.Integer(), nullable=False), sa.Column("quantity", sa.Integer(), nullable=False), sa.Column("unit_price", sa.Numeric(12, 2), nullable=False), sa.Column("line_total", sa.Numeric(12, 2), nullable=False), sa.ForeignKeyConstraint(["product_id"], ["products.id"]), sa.ForeignKeyConstraint(["sale_id"], ["sales.id"]))


def downgrade() -> None:
    op.drop_table("sale_details")
    op.drop_table("payments")
    op.drop_index(op.f("ix_sales_invoice_number"), table_name="sales")
    op.drop_index(op.f("ix_sales_created_at"), table_name="sales")
    op.drop_table("sales")
    op.drop_index(op.f("ix_sessions_token_jti"), table_name="sessions")
    op.drop_table("sessions")
    op.drop_table("inventory")
    op.drop_index(op.f("ix_products_sku"), table_name="products")
    op.drop_index(op.f("ix_products_barcode"), table_name="products")
    op.drop_index(op.f("ix_products_name"), table_name="products")
    op.drop_index(op.f("ix_products_id"), table_name="products")
    op.drop_table("products")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_table("users")
    op.drop_table("suppliers")
    op.drop_table("customers")
    op.drop_table("categories")
    op.drop_index(op.f("ix_roles_id"), table_name="roles")
    op.drop_table("roles")
    sa.Enum(name="paymentmethod").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="rolename").drop(op.get_bind(), checkfirst=True)

