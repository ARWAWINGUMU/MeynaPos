import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class OpenSaleStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    HELD = "HELD"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class OpenSale(Base):
    __tablename__ = "open_sales"
    __table_args__ = (
        CheckConstraint("version >= 1", name="ck_open_sale_version"),
        CheckConstraint("status IN ('DRAFT', 'HELD', 'COMPLETED', 'CANCELLED')", name="ck_open_sale_status"),
        CheckConstraint("status <> 'COMPLETED' OR sale_id IS NOT NULL", name="ck_open_sale_completed"),
        Index("uq_open_sale_active_name", "business_id", "name_key", unique=True,
              postgresql_where=text("status IN ('DRAFT', 'HELD')"), sqlite_where=text("status IN ('DRAFT', 'HELD')")),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    number: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    name_key: Mapped[str] = mapped_column(String(240), nullable=False)
    business_id: Mapped[int] = mapped_column(ForeignKey("business_settings.id"), nullable=False, index=True)
    cashier_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(16), default=OpenSaleStatus.DRAFT, nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False)
    tax_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    discount_type: Mapped[str] = mapped_column(String(16), default="NONE", nullable=False)
    discount_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    discount_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    total: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    sale_id: Mapped[int | None] = mapped_column(ForeignKey("sales.id"), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    cashier: Mapped["User"] = relationship()
    customer: Mapped["Customer | None"] = relationship()
    lines: Mapped[list["OpenSaleLine"]] = relationship(back_populates="open_sale", cascade="all, delete-orphan", order_by="OpenSaleLine.id")


class OpenSaleNumber(Base):
    """Database-assigned numbers remain unique across concurrent cashiers."""

    __tablename__ = "open_sale_numbers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)


class OpenSaleLine(Base):
    __tablename__ = "open_sale_lines"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_open_sale_line_quantity"),
        UniqueConstraint("open_sale_id", "original_product_id", name="uq_open_sale_product"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    open_sale_id: Mapped[str] = mapped_column(ForeignKey("open_sales.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))
    original_product_id: Mapped[int] = mapped_column(Integer, nullable=False)
    product_name: Mapped[str] = mapped_column(String(160), nullable=False)
    product_sku: Mapped[str] = mapped_column(String(80), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    open_sale: Mapped["OpenSale"] = relationship(back_populates="lines")
    product: Mapped["Product | None"] = relationship()
