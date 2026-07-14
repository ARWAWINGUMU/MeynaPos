from decimal import Decimal

from app.models.inventory import Inventory
from app.models.product import Product
from app.schemas.product import ProductCreate


class ProductFactory:
    """Factory Pattern: centralizes Product aggregate creation."""

    @staticmethod
    def create_product(payload: ProductCreate) -> Product:
        product = Product(
            name=payload.name,
            description=payload.description,
            barcode=payload.barcode,
            qr_code=payload.qr_code,
            sku=payload.sku,
            price=Decimal(str(payload.price)),
            cost=Decimal(str(payload.cost)),
            category_id=payload.category_id,
            supplier_id=payload.supplier_id,
            image_url=payload.image_url,
        )
        product.inventory = Inventory(
            quantity=payload.initial_stock,
            minimum_stock=payload.minimum_stock,
        )
        return product
