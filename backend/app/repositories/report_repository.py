from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, joinedload

from app.models.inventory import Inventory
from app.models.product import Product
from app.models.sale import Sale


class ReportRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def sales_totals_for_day(self, target_date: date) -> tuple[int, Decimal, Decimal, Decimal, Decimal]:
        start = datetime.combine(target_date, time.min, tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        statement: Select[tuple[int, Decimal, Decimal, Decimal, Decimal]] = select(
            func.count(Sale.id),
            func.coalesce(func.sum(Sale.subtotal), 0),
            func.coalesce(func.sum(Sale.tax), 0),
            func.coalesce(func.sum(Sale.discount_amount), 0),
            func.coalesce(func.sum(Sale.total), 0),
        ).where(Sale.created_at >= start, Sale.created_at < end)
        result = self.db.execute(statement).one()
        return int(result[0]), Decimal(result[1]), Decimal(result[2]), Decimal(result[3]), Decimal(result[4])

    def inventory(self) -> list[Inventory]:
        statement = select(Inventory).options(joinedload(Inventory.product).joinedload(Product.category)).order_by(Inventory.quantity)
        return list(self.db.scalars(statement).unique().all())
