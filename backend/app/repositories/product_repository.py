from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.product import Product
from app.models.purchase_detail import PurchaseDetail
from app.models.sale_detail import SaleDetail


class ProductRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self, search: str | None = None, category_id: int | None = None, include_inactive: bool = False, status_filter: str | None = None) -> list[Product]:
        statement = select(Product).options(joinedload(Product.inventory)).order_by(Product.name)
        if status_filter == "active":
            statement = statement.where(Product.is_active.is_(True))
        elif status_filter == "inactive":
            statement = statement.where(Product.is_active.is_(False))
        elif status_filter == "all":
            pass
        elif include_inactive:
            pass
        else:
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

    def delete_without_commit(self, product: Product) -> None:
        self.db.delete(product)

    def sale_detail_count(self, product_id: int) -> int:
        return int(self.db.scalar(select(func.count(SaleDetail.id)).where(SaleDetail.product_id == product_id)) or 0)

    def purchase_detail_count(self, product_id: int) -> int:
        return int(self.db.scalar(select(func.count(PurchaseDetail.id)).where(PurchaseDetail.product_id == product_id)) or 0)

    def has_history(self, product_id: int) -> bool:
        return bool(self.sale_detail_count(product_id) or self.purchase_detail_count(product_id))
