from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_roles
from app.models.role import RoleName
from app.models.user import User
from app.repositories.product_repository import ProductRepository
from app.schemas.product import ProductCreate, ProductRead, ProductUpdate
from app.services.product_service import ProductService


router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=list[ProductRead])
def list_products(
    search: str | None = None,
    category_id: int | None = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN, RoleName.CASHIER)),
) -> list[ProductRead]:
    return ProductService(ProductRepository(db)).list_products(search, category_id, include_inactive)


@router.get("/barcode/{barcode:path}", response_model=ProductRead)
def get_by_barcode(
    barcode: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN, RoleName.CASHIER)),
) -> ProductRead:
    return ProductService(ProductRepository(db)).find_by_barcode(barcode)


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> ProductRead:
    return ProductService(ProductRepository(db)).create_product(payload)


@router.put("/{product_id}", response_model=ProductRead)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> ProductRead:
    return ProductService(ProductRepository(db)).update_product(product_id, payload)


@router.delete("/{product_id}", response_model=ProductRead)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> ProductRead:
    return ProductService(ProductRepository(db)).deactivate_product(product_id)


@router.post("/{product_id}/image", response_model=ProductRead)
def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> ProductRead:
    return ProductService(ProductRepository(db)).upload_image(product_id, file)
