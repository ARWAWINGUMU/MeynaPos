from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.repositories.product_repository import ProductRepository
from app.schemas.product import ProductCreate, ProductUpdate
from app.utils.product_factory import ProductFactory


class ProductService:
    def __init__(self, products: ProductRepository) -> None:
        self.products = products

    def list_products(self, search: str | None = None, category_id: int | None = None, include_inactive: bool = False):
        return self.products.list(search, category_id, include_inactive)

    def create_product(self, payload: ProductCreate):
        product = ProductFactory.create_product(payload)
        return self.products.add(product)

    def update_product(self, product_id: int, payload: ProductUpdate):
        product = self.products.get(product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
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

    def deactivate_product(self, product_id: int):
        product = self.products.get(product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        product.is_active = False
        self.products.db.commit()
        self.products.db.refresh(product)
        return product

    def upload_image(self, product_id: int, file: UploadFile):
        product = self.products.get(product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        extension = Path(file.filename or "").suffix.lower() or ".png"
        if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image format")
        upload_dir = Path("static/uploads/products")
        upload_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid4().hex}{extension}"
        destination = upload_dir / filename
        with destination.open("wb") as buffer:
            buffer.write(file.file.read())
        product.image_url = f"/static/uploads/products/{filename}"
        self.products.db.commit()
        self.products.db.refresh(product)
        return product

    def find_by_barcode(self, barcode: str):
        product = self.products.get_by_barcode(barcode)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        return product
