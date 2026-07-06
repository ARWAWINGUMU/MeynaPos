from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class BusinessSetting(Base):
    __tablename__ = "business_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_name: Mapped[str] = mapped_column(String(160), nullable=False)
    tax_id: Mapped[str] = mapped_column(String(80), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(40), nullable=False)
    email: Mapped[str] = mapped_column(String(160), nullable=False)
    city: Mapped[str] = mapped_column(String(120), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False)
    tax_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(255))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
