from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.sale import Sale


class SaleRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, sale: Sale) -> Sale:
        self.db.add(sale)
        self.db.commit()
        self.db.refresh(sale)
        return sale

    def list(self) -> list[Sale]:
        statement = (
            select(Sale)
            .options(joinedload(Sale.details), joinedload(Sale.payment))
            .order_by(Sale.created_at.desc())
        )
        return list(self.db.scalars(statement).unique().all())

