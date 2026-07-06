import enum
from decimal import Decimal

from sqlalchemy import Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    CARD = "CARD"
    TRANSFER = "TRANSFER"


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"), unique=True, nullable=False)
    method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(120))

    sale: Mapped["Sale"] = relationship(back_populates="payment")

