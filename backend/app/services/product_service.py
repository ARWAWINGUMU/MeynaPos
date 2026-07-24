import logging

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import update

from app.repositories.product_repository import ProductRepository
from app.models.category import Category
from app.models.role import RoleName
from app.models.sale_detail import SaleDetail
from app.models.user import User
from app.core.security import verify_password
from app.schemas.product import ProductCreate, ProductRemovalResponse, ProductUpdate
from app.services.file_storage_service import FileStorageService
from app.utils.product_factory import ProductFactory


logger = logging.getLogger(__name__)


class ProductService:
    def __init__(self, products: ProductRepository) -> None:
        self.products = products

    def list_products(self, search: str | None = None, category_id: int | None = None, include_inactive: bool = False, status_filter: str | None = None):
        return self.products.list(search, category_id, include_inactive, status_filter)

    def create_product(self, payload: ProductCreate):
        self._normalize_codes(payload)
        self._ensure_unique_codes(sku=payload.sku, barcode=payload.barcode, qr_code=payload.qr_code)
        self._ensure_active_category(payload.category_id)
        product = ProductFactory.create_product(payload)
        return self.products.add(product)

    def update_product(self, product_id: int, payload: ProductUpdate):
        product = self.products.get(product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        self._normalize_codes(payload)
        next_values = payload.model_dump(exclude_unset=True)
        self._ensure_unique_codes(
            sku=next_values.get("sku"),
            barcode=next_values.get("barcode"),
            qr_code=next_values.get("qr_code"),
            exclude_product_id=product_id,
        )
        self._ensure_active_category(next_values.get("category_id"))
        for field, value in payload.model_dump(exclude_unset=True).items():
            if field == "quantity" and product.inventory:
                product.inventory.quantity = value
            elif field == "minimum_stock" and product.inventory:
                product.inventory.minimum_stock = value
            elif hasattr(product, field):
                setattr(product, field, value)
        self.products.db.commit()
        self.products.db.refresh(product)
        return product

    def deactivate_product(self, product_id: int, admin_password: str | None = None, admin: User | None = None):
        if admin is not None and admin_password is not None:
            self._validate_admin_reauthentication(admin, admin_password)
        product = self.products.get(product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        product.is_active = False
        self.products.db.commit()
        self.products.db.refresh(product)
        if admin is not None:
            logger.info("PRODUCT_DEACTIVATED admin_id=%s product_id=%s", admin.id, product_id)
        return product

    def remove_product(self, product_id: int, admin_password: str, admin: User) -> ProductRemovalResponse:
        self._validate_admin_reauthentication(admin, admin_password)
        product = self.products.get(product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        if self.products.has_history(product_id):
            product = self.deactivate_product(product_id, admin_password, admin)
            return ProductRemovalResponse(action="deactivated", product=product, history_preserved=True)

        image_url = product.image_url
        self.products.delete(product)
        FileStorageService().delete_by_url(image_url)
        logger.info("PRODUCT_DELETED admin_id=%s product_id=%s", admin.id, product_id)
        return ProductRemovalResponse(action="deleted", product=None, history_preserved=True)

    def permanently_delete_product(self, product_id: int, admin_password: str, admin: User) -> ProductRemovalResponse:
        self._validate_admin_reauthentication(admin, admin_password)
        product = self.products.get(product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        if self.products.purchase_detail_count(product_id) > 0:
            logger.info("PRODUCT_PERMANENT_DELETE_REJECTED_PURCHASES admin_id=%s product_id=%s", admin.id, product_id)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "No se puede eliminar permanentemente porque existen compras asociadas sin snapshot histórico. Desactive el producto como alternativa.",
                    "relation": "purchase_details",
                },
            )

        image_url = product.image_url
        self.products.db.execute(update(SaleDetail).where(SaleDetail.product_id == product_id).values(product_id=None))
        self.products.delete_without_commit(product)
        self.products.db.commit()
        FileStorageService().delete_by_url(image_url)
        logger.info("PRODUCT_PERMANENTLY_DELETED admin_id=%s product_id=%s history_preserved=true", admin.id, product_id)
        return ProductRemovalResponse(action="permanently_deleted", product=None, history_preserved=True)

    def reactivate_product(self, product_id: int):
        product = self.products.get(product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        product.is_active = True
        self.products.db.commit()
        self.products.db.refresh(product)
        logger.info("PRODUCT_REACTIVATED product_id=%s", product_id)
        return product

    def upload_image(self, product_id: int, file: UploadFile):
        product = self.products.get(product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        product.image_url = FileStorageService().save_image(file, "products", product.image_url)
        self.products.db.commit()
        self.products.db.refresh(product)
        return product

    def find_by_barcode(self, barcode: str):
        product = self.products.get_by_barcode(barcode)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        return product

    @staticmethod
    def _validate_admin_reauthentication(admin: User, admin_password: str) -> None:
        if not admin.is_active or admin.locked or admin.role.name != RoleName.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "No fue posible completar la operación."})
        if not verify_password(admin_password, admin.hashed_password):
            logger.info("PRODUCT_REMOVAL_REAUTH_FAILED admin_id=%s", admin.id)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "No fue posible completar la operación."})

    @staticmethod
    def _normalize_codes(payload: ProductCreate | ProductUpdate) -> None:
        for field in ("barcode", "qr_code", "sku"):
            value = getattr(payload, field, None)
            if isinstance(value, str):
                normalized = value.strip()
                setattr(payload, field, normalized or None)

    def _ensure_unique_codes(
        self,
        *,
        sku: str | None = None,
        barcode: str | None = None,
        qr_code: str | None = None,
        exclude_product_id: int | None = None,
    ) -> None:
        checks = (
            (sku, "SKU already exists"),
            (barcode, "Barcode already exists"),
            (qr_code, "QR code already exists"),
        )
        for code, message in checks:
            if not code:
                continue
            existing = self.products.get_by_unique_code(code, exclude_product_id)
            if existing is not None:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)

    def _ensure_active_category(self, category_id: int | None) -> None:
        if not category_id:
            return
        category = self.products.db.get(Category, category_id)
        if category is None or not category.is_active:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Category is not available")
