from collections import OrderedDict
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.models.payment import Payment
from app.models.product import Product
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.repositories.report_repository import ReportRepository
from app.schemas.report import (
    DailySalesReport,
    InventoryReportItem,
    MonthlyRevenueReportItem,
    PaymentMethodReportItem,
    SalesReportItem,
    TopProductReportItem,
)


class ReportService:
    def __init__(self, reports: ReportRepository) -> None:
        self.reports = reports

    def daily_sales(self, target_date: date | None = None) -> DailySalesReport:
        day = target_date or date.today()
        transactions, subtotal, tax, discount, total = self.reports.sales_totals_for_day(day)
        return DailySalesReport(
            date=day.isoformat(),
            transactions=transactions,
            subtotal=subtotal,
            tax=tax,
            discount=discount,
            total=total,
        )

    def sales(self) -> list[SalesReportItem]:
        statement = (
            select(Sale)
            .options(joinedload(Sale.cashier), joinedload(Sale.customer), joinedload(Sale.payment))
            .order_by(Sale.created_at.desc())
        )
        sales = self.reports.db.scalars(statement).unique().all()
        return [
            SalesReportItem(
                sale_number=sale.invoice_number,
                date=sale.created_at.isoformat(),
                cashier=sale.cashier.full_name if sale.cashier else "N/A",
                customer=sale.customer.name if sale.customer else "N/A",
                subtotal=sale.subtotal,
                tax=sale.tax_amount if hasattr(sale, "tax_amount") else sale.tax,
                discount=sale.discount_amount,
                total=sale.total,
                payment_method=sale.payment.method.value if sale.payment else "N/A",
                status="PAGADA",
            )
            for sale in sales
        ]

    def inventory(self) -> list[InventoryReportItem]:
        items: list[InventoryReportItem] = []
        for stock in self.reports.inventory():
            status = "agotado" if stock.quantity <= 0 else "bajo stock" if stock.quantity <= stock.minimum_stock else "disponible"
            items.append(
                InventoryReportItem(
                    product_id=stock.product_id,
                    name=stock.product.name,
                    sku=stock.product.sku,
                    barcode=stock.product.barcode,
                    category=stock.product.category.name if stock.product.category else "Sin categoría",
                    quantity=stock.quantity,
                    minimum_stock=stock.minimum_stock,
                    low_stock=stock.quantity <= stock.minimum_stock,
                    status=status,
                )
            )
        return items

    def top_products(self) -> list[TopProductReportItem]:
        statement = (
            select(Product.id, Product.name, func.coalesce(func.sum(SaleDetail.quantity), 0), func.coalesce(func.sum(SaleDetail.line_total), 0))
            .join(SaleDetail, SaleDetail.product_id == Product.id)
            .join(Sale, Sale.id == SaleDetail.sale_id)
            .group_by(Product.id, Product.name)
            .order_by(func.sum(SaleDetail.quantity).desc())
            .limit(10)
        )
        return [
            TopProductReportItem(product_id=row[0], name=row[1], quantity_sold=int(row[2]), total=Decimal(row[3]))
            for row in self.reports.db.execute(statement).all()
        ]

    def sales_by_payment_method(self) -> list[PaymentMethodReportItem]:
        statement = (
            select(Payment.method, func.count(Payment.id), func.coalesce(func.sum(Sale.total), 0))
            .join(Sale, Sale.id == Payment.sale_id)
            .group_by(Payment.method)
        )
        return [
            PaymentMethodReportItem(method=row[0].value, transactions=int(row[1]), total=Decimal(row[2]))
            for row in self.reports.db.execute(statement).all()
        ]

    def monthly_revenue(self) -> list[MonthlyRevenueReportItem]:
        year_start = datetime(datetime.now(timezone.utc).year, 1, 1, tzinfo=timezone.utc)
        sales = self.reports.db.scalars(select(Sale).where(Sale.created_at >= year_start)).all()
        buckets: OrderedDict[str, dict[str, Decimal | int]] = OrderedDict()
        for month in range(1, 13):
            key = f"{year_start.year}-{month:02d}"
            buckets[key] = {"sales_count": 0, "total_revenue": Decimal("0.00")}
        for sale in sales:
            key = sale.created_at.strftime("%Y-%m")
            if key not in buckets:
                continue
            buckets[key]["sales_count"] = int(buckets[key]["sales_count"]) + 1
            buckets[key]["total_revenue"] = Decimal(buckets[key]["total_revenue"]) + sale.total
        return [
            MonthlyRevenueReportItem(month=month, sales_count=int(value["sales_count"]), total_revenue=Decimal(value["total_revenue"]))
            for month, value in buckets.items()
        ]
