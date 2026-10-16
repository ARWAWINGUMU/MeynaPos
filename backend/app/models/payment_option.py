from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class PaymentOption(Base):
    __tablename__ = "payment_options"
    __table_args__ = (UniqueConstraint("business_id", "name_key", name="uq_payment_option_name"),
                      UniqueConstraint("business_id", "code", name="uq_payment_option_code"))

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business_settings.id"), index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    name_key: Mapped[str] = mapped_column(String(240), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
