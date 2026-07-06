from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_number: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    cashier_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    tax_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    cashier: Mapped["User"] = relationship(back_populates="sales")
    customer: Mapped["Customer | None"] = relationship(back_populates="sales")
    details: Mapped[list["SaleDetail"]] = relationship(back_populates="sale", cascade="all, delete-orphan")
    payment: Mapped["Payment"] = relationship(back_populates="sale", uselist=False, cascade="all, delete-orphan")
