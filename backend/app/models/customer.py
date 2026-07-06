from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    document_number: Mapped[str | None] = mapped_column(String(80), unique=True)
    email: Mapped[str | None] = mapped_column(String(160))
    phone: Mapped[str | None] = mapped_column(String(40))
    address: Mapped[str | None] = mapped_column(String(255))

    sales: Mapped[list["Sale"]] = relationship(back_populates="customer")
