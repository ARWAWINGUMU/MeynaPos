from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str | None] = mapped_column(String(160))
    phone: Mapped[str | None] = mapped_column(String(40))
    address: Mapped[str | None] = mapped_column(String(255))

    products: Mapped[list["Product"]] = relationship(back_populates="supplier")

