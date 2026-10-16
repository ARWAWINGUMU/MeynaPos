from sqlalchemy import Select, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.open_sale import OpenSale, OpenSaleLine, OpenSaleStatus
from app.models.product import Product


class OpenSaleRepository:
    def __init__(self, db: Session, business_id: int) -> None:
        self.db = db
        self.business_id = business_id

    @staticmethod
    def _query() -> Select[tuple[OpenSale]]:
        return select(OpenSale).options(
            selectinload(OpenSale.lines).joinedload(OpenSaleLine.product).joinedload(Product.inventory),
            joinedload(OpenSale.customer), joinedload(OpenSale.cashier),
        )

    def get(self, identifier: str, *, lock: bool = False) -> OpenSale | None:
        query = self._query().where(OpenSale.id == identifier, OpenSale.business_id == self.business_id).execution_options(populate_existing=True)
        if lock:
            query = query.with_for_update(of=OpenSale)
        return self.db.scalars(query).first()

    def list_active(self, cashier_id: int | None = None) -> list[OpenSale]:
        query = self._query().where(OpenSale.business_id == self.business_id, OpenSale.status.in_([OpenSaleStatus.DRAFT, OpenSaleStatus.HELD]))
        if cashier_id is not None:
            query = query.where(OpenSale.cashier_id == cashier_id)
        return list(self.db.scalars(query.order_by(OpenSale.updated_at.desc(), OpenSale.id)).unique().all())
