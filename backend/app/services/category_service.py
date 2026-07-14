from fastapi import HTTPException, status

from app.models.category import Category
from app.repositories.category_repository import CategoryRepository
from app.schemas.category import CategoryCreate, CategoryUpdate


class CategoryService:
    def __init__(self, categories: CategoryRepository) -> None:
        self.categories = categories

    def list_categories(self, include_inactive: bool = False) -> list[Category]:
        return self.categories.list(include_inactive)

    def create_category(self, payload: CategoryCreate) -> Category:
        name = payload.name.strip()
        if self.categories.get_by_name(name) is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category already exists")
        return self.categories.add(Category(name=name, description=payload.description))

    def update_category(self, category_id: int, payload: CategoryUpdate) -> Category:
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
        return self.categories.save(category)

    def set_active(self, category_id: int, active: bool) -> Category:
        category = self.categories.get(category_id)
        if category is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
        category.is_active = active
        return self.categories.save(category)
