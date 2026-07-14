from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from decimal import Decimal

from app.models.payment import PaymentMethod


class CustomerBase(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=160)
    document_number: str | None = Field(default=None, max_length=80)


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(CustomerBase):
    pass


class CustomerRead(CustomerBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class CustomerSummary(CustomerRead):
    purchase_count: int
    total_purchased: Decimal
    last_purchase_at: datetime | None


class CustomerSaleProduct(BaseModel):
    product_id: int
    name: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class CustomerSaleHistoryItem(BaseModel):
    id: int
    sale_number: str
    date: datetime
    cashier: str
    products: list[CustomerSaleProduct]
    subtotal: Decimal
    tax: Decimal
    discount: Decimal
    total: Decimal
    payment_method: PaymentMethod | None
    status: str
