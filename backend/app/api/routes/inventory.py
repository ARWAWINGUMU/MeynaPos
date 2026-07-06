from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_roles
from app.models.role import RoleName
from app.models.user import User
from app.repositories.product_repository import ProductRepository
from app.schemas.product import ProductRead, ProductUpdate
from app.services.product_service import ProductService


router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("", response_model=list[ProductRead])
def list_inventory(search: str | None = None, category_id: int | None = None, low_stock: bool = False, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleName.ADMIN, RoleName.CASHIER))) -> list[ProductRead]:
    products = ProductService(ProductRepository(db)).list_products(search, category_id)
    if low_stock:
        return [product for product in products if product.inventory and product.inventory.low_stock]
    return products


@router.patch("/{product_id}", response_model=ProductRead)
def update_stock(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleName.ADMIN))) -> ProductRead:
    return ProductService(ProductRepository(db)).update_product(product_id, payload)

