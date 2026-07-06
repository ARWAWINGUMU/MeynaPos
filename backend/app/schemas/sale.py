from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.payment import PaymentMethod


class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class PaymentCreate(BaseModel):
    method: PaymentMethod
    amount: Decimal = Field(gt=0)
    reference: str | None = None


class SaleCreate(BaseModel):
    customer_id: int = Field(gt=0)
    items: list[SaleItemCreate] = Field(min_length=1)
    payment: PaymentCreate


class SaleDetailRead(BaseModel):
    product_id: int
    quantity: int
    unit_price: Decimal
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class PaymentRead(BaseModel):
    method: PaymentMethod
    amount: Decimal
    reference: str | None

    model_config = ConfigDict(from_attributes=True)


class SaleRead(BaseModel):
    id: int
    invoice_number: str
    customer_id: int
    subtotal: Decimal
    tax_percentage: Decimal
    tax_amount: Decimal
    tax: Decimal
    total: Decimal
    created_at: datetime
    details: list[SaleDetailRead]
    payment: PaymentRead

    model_config = ConfigDict(from_attributes=True)
