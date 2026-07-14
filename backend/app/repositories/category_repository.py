from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.category import Category


class CategoryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self, include_inactive: bool = False) -> list[Category]:
        statement = select(Category).order_by(Category.name)
        if not include_inactive:
            statement = statement.where(Category.is_active.is_(True))
        return list(self.db.scalars(statement).all())

    def get(self, category_id: int) -> Category | None:
        return self.db.get(Category, category_id)

    def get_by_name(self, name: str) -> Category | None:
        return self.db.scalars(select(Category).where(func.lower(Category.name) == name.lower())).first()

    def product_count(self, category_id: int) -> int:
        from app.models.product import Product

        return int(self.db.scalar(select(func.count(Product.id)).where(Product.category_id == category_id)) or 0)

    def add(self, category: Category) -> Category:
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return category

    def save(self, category: Category) -> Category:
        self.db.commit()
        self.db.refresh(category)
        return category
