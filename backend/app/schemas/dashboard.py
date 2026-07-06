from decimal import Decimal

from pydantic import BaseModel


class SalesSummaryPoint(BaseModel):
    date: str
    sales_count: int
    total_revenue: Decimal


class DashboardSummary(BaseModel):
    daily_sales_count: int
    products_in_stock: int
    low_stock_products: int
    total_clients: int
    monthly_revenue: Decimal
    sales_summary: list[SalesSummaryPoint]
