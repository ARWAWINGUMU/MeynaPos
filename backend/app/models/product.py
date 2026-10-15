from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (CheckConstraint("article_type IN ('PRODUCT', 'SERVICE')", name="ck_product_article_type"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    article_type: Mapped[str] = mapped_column(String(10), default="PRODUCT", server_default="PRODUCT", nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    barcode: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    qr_code: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    sku: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"))
    image_url: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    category: Mapped["Category | None"] = relationship(back_populates="products")
    supplier: Mapped["Supplier | None"] = relationship(back_populates="products")
    inventory: Mapped["Inventory | None"] = relationship(back_populates="product", uselist=False, cascade="all, delete-orphan")
    inventory_alerts: Mapped[list["InventoryAlert"]] = relationship(back_populates="product", cascade="all, delete-orphan")
    sale_details: Mapped[list["SaleDetail"]] = relationship(back_populates="product", passive_deletes=True)

    @property
    def tracks_inventory(self) -> bool:
        return self.article_type != "SERVICE"
