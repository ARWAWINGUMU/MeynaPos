"""Add temporary password flow fields.

Revision ID: 0005_temp_passwords
Revises: 0004_category_status
Create Date: 2026-07-23
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_temp_passwords"
down_revision = "0004_category_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "must_change_password" not in columns:
        op.add_column("users", sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.false()))
        op.alter_column("users", "must_change_password", server_default=None)
    if "temporary_password_expires_at" not in columns:
        op.add_column("users", sa.Column("temporary_password_expires_at", sa.DateTime(timezone=True), nullable=True))
    if "password_changed_at" not in columns:
        op.add_column("users", sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True))
    if "password_reset_by_id" not in columns:
        op.add_column("users", sa.Column("password_reset_by_id", sa.Integer(), nullable=True))
        op.create_foreign_key("fk_users_password_reset_by_id", "users", "users", ["password_reset_by_id"], ["id"])
    if "token_version" not in columns:
        op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))
        op.alter_column("users", "token_version", server_default=None)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "password_reset_by_id" in columns:
        op.drop_constraint("fk_users_password_reset_by_id", "users", type_="foreignkey")
        op.drop_column("users", "password_reset_by_id")
    if "token_version" in columns:
        op.drop_column("users", "token_version")
    if "password_changed_at" in columns:
        op.drop_column("users", "password_changed_at")
    if "temporary_password_expires_at" in columns:
        op.drop_column("users", "temporary_password_expires_at")
    if "must_change_password" in columns:
        op.drop_column("users", "must_change_password")
