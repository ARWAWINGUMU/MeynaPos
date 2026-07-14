from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.product import Product


class ProductRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self, search: str | None = None, category_id: int | None = None, include_inactive: bool = False) -> list[Product]:
        statement = select(Product).options(joinedload(Product.inventory)).order_by(Product.name)
        if not include_inactive:
            statement = statement.where(Product.is_active.is_(True))
        if search:
            term = f"%{search}%"
            statement = statement.where(
                or_(
                    Product.name.ilike(term),
                    Product.sku.ilike(term),
                    Product.barcode.ilike(term),
                    Product.qr_code.ilike(term),
                )
            )
        if category_id:
            statement = statement.where(Product.category_id == category_id)
        return list(self.db.scalars(statement).unique().all())

    def get(self, product_id: int) -> Product | None:
        statement = select(Product).options(joinedload(Product.inventory)).where(Product.id == product_id)
        return self.db.scalars(statement).first()

    def get_by_barcode(self, barcode: str) -> Product | None:
        statement = select(Product).options(joinedload(Product.inventory)).where(
            or_(Product.barcode == barcode, Product.qr_code == barcode),
            Product.is_active.is_(True),
        )
        return self.db.scalars(statement).first()

    def get_by_unique_code(self, code: str, exclude_product_id: int | None = None) -> Product | None:
        statement = select(Product).where(or_(Product.barcode == code, Product.qr_code == code, Product.sku == code))
        if exclude_product_id is not None:
            statement = statement.where(Product.id != exclude_product_id)
        return self.db.scalars(statement).first()

    def add(self, product: Product) -> Product:
        self.db.add(product)
        self.db.commit()
        self.db.refresh(product)
        return product

    def delete(self, product: Product) -> None:
        self.db.delete(product)
        self.db.commit()
