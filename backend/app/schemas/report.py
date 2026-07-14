from decimal import Decimal

from pydantic import BaseModel


class DailySalesReport(BaseModel):
    date: str
    transactions: int
    subtotal: Decimal
    tax: Decimal
    discount: Decimal
    total: Decimal


class SalesReportItem(BaseModel):
    sale_number: str
    date: str
    cashier: str
    customer: str
    subtotal: Decimal
    tax: Decimal
    discount: Decimal
    total: Decimal
    payment_method: str
    status: str


class InventoryReportItem(BaseModel):
    product_id: int
    name: str
    sku: str
    barcode: str | None
    category: str
    quantity: int
    minimum_stock: int
    low_stock: bool
    status: str


class TopProductReportItem(BaseModel):
    product_id: int
    name: str
    quantity_sold: int
    total: Decimal


class PaymentMethodReportItem(BaseModel):
    method: str
    transactions: int
    total: Decimal


class MonthlyRevenueReportItem(BaseModel):
    month: str
    sales_count: int
    total_revenue: Decimal
