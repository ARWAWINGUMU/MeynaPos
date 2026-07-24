from fastapi import HTTPException, status
import logging

from app.models.category import Category
from app.repositories.category_repository import CategoryRepository
from app.schemas.auth import MessageResponse
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate


logger = logging.getLogger(__name__)


class CategoryService:
    def __init__(self, categories: CategoryRepository) -> None:
        self.categories = categories

    def list_categories(self, include_inactive: bool = False) -> list[CategoryRead]:
        return [self._to_read(category, product_count) for category, product_count in self.categories.list_with_product_counts(include_inactive)]

    def create_category(self, payload: CategoryCreate) -> CategoryRead:
        name = payload.name.strip()
        if self.categories.get_by_name(name) is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category already exists")
        return self._to_read(self.categories.add(Category(name=name, description=payload.description)))

    def update_category(self, category_id: int, payload: CategoryUpdate) -> CategoryRead:
        category = self.categories.get(category_id)
        if category is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
        data = payload.model_dump(exclude_unset=True)
        if "name" in data and data["name"] is not None:
            name = str(data["name"]).strip()
            existing = self.categories.get_by_name(name)
            if existing is not None and existing.id != category_id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category already exists")
            category.name = name
        if "description" in data:
            category.description = data["description"]
        if "is_active" in data and data["is_active"] is not None:
            category.is_active = bool(data["is_active"])
        saved = self.categories.save(category)
        logger.info("CATEGORY_UPDATED category_id=%s", category_id)
        return self._to_read(saved)

    def set_active(self, category_id: int, active: bool) -> CategoryRead:
        category = self.categories.get(category_id)
        if category is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
        category.is_active = active
        return self._to_read(self.categories.save(category))

    def delete_category(self, category_id: int) -> MessageResponse:
        category = self.categories.get(category_id)
        if category is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
        if self.categories.product_count(category_id) > 0:
            logger.info("CATEGORY_DELETE_REJECTED_HAS_PRODUCTS category_id=%s", category_id)
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "No se puede eliminar la categoría porque tiene productos asociados."})
        self.categories.delete(category)
        logger.info("CATEGORY_DELETED category_id=%s", category_id)
        return MessageResponse(message="Categoría eliminada correctamente.")

    def _to_read(self, category: Category, product_count: int | None = None) -> CategoryRead:
        return CategoryRead(
            id=category.id,
            name=category.name,
            description=category.description,
            is_active=category.is_active,
            product_count=self.categories.product_count(category.id) if product_count is None else product_count,
        )
