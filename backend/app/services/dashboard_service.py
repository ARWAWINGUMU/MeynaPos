from collections import OrderedDict
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.sale import Sale
from app.schemas.dashboard import DashboardSummary, SalesSummaryPoint


class DashboardService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def summary(self) -> DashboardSummary:
        today = datetime.now(timezone.utc).date()
        day_start = datetime.combine(today, time.min, tzinfo=timezone.utc)
        day_end = datetime.combine(today, time.max, tzinfo=timezone.utc)
        month_start = datetime(today.year, today.month, 1, tzinfo=timezone.utc)

        daily_sales_count = int(
            self.db.scalar(select(func.count(Sale.id)).where(Sale.created_at >= day_start, Sale.created_at <= day_end)) or 0
        )
        products_in_stock = int(
            self.db.scalar(
                select(func.count(Product.id))
                .join(Inventory, Inventory.product_id == Product.id)
                .where(Product.is_active.is_(True), Inventory.quantity > 0)
            )
            or 0
        )
        low_stock_products = int(
            self.db.scalar(
                select(func.count(Product.id))
                .join(Inventory, Inventory.product_id == Product.id)
                .where(Product.is_active.is_(True), Inventory.quantity <= Inventory.minimum_stock)
            )
            or 0
        )
        total_clients = int(self.db.scalar(select(func.count(Customer.id))) or 0)
        monthly_revenue = Decimal(
            self.db.scalar(select(func.coalesce(func.sum(Sale.total), 0)).where(Sale.created_at >= month_start)) or 0
        )

        return DashboardSummary(
            daily_sales_count=daily_sales_count,
            products_in_stock=products_in_stock,
            low_stock_products=low_stock_products,
            total_clients=total_clients,
            monthly_revenue=monthly_revenue,
            sales_summary=self._sales_summary(today),
        )

    def _sales_summary(self, today) -> list[SalesSummaryPoint]:
        start_date = today - timedelta(days=6)
        start_datetime = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
        sales = self.db.scalars(select(Sale).where(Sale.created_at >= start_datetime)).all()
        buckets: OrderedDict[str, dict[str, Decimal | int]] = OrderedDict()
        for offset in range(7):
            key = (start_date + timedelta(days=offset)).isoformat()
            buckets[key] = {"sales_count": 0, "total_revenue": Decimal("0.00")}

        for sale in sales:
            key = sale.created_at.date().isoformat()
            if key not in buckets:
                continue
            buckets[key]["sales_count"] = int(buckets[key]["sales_count"]) + 1
            buckets[key]["total_revenue"] = Decimal(buckets[key]["total_revenue"]) + sale.total

        return [
            SalesSummaryPoint(date=key, sales_count=int(value["sales_count"]), total_revenue=Decimal(value["total_revenue"]))
            for key, value in buckets.items()
        ]
