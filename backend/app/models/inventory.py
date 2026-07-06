from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Inventory(Base):
    __tablename__ = "inventory"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), unique=True, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    minimum_stock: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    product: Mapped["Product"] = relationship(back_populates="inventory")

    @property
    def low_stock(self) -> bool:
        return self.quantity <= self.minimum_stock
