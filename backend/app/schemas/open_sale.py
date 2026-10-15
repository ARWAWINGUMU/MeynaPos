from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.sale import DiscountType
from app.schemas.product import ProductRead
from app.schemas.sale import PaymentCreate


class OpenSaleItemWrite(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=1_000_000)
    unit_price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class OpenSaleWrite(BaseModel):
    customer_id: int | None = Field(default=None, gt=0)
    items: list[OpenSaleItemWrite] = Field(default_factory=list, max_length=500)
    discount_type: DiscountType = DiscountType.NONE
    discount_value: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    notes: str = Field(default="", max_length=2000)
    status: Literal["DRAFT", "HELD"] = "DRAFT"

    @model_validator(mode="after")
    def validate_items(self) -> "OpenSaleWrite":
        identifiers = [item.product_id for item in self.items]
        if len(identifiers) != len(set(identifiers)):
            raise ValueError("Each product must appear once in an open sale")
        if self.status == "HELD" and not self.items:
            raise ValueError("An empty sale cannot be suspended")
        return self


class OpenSaleCreate(OpenSaleWrite):
    id: UUID = Field(default_factory=uuid4)


class OpenSaleUpdate(OpenSaleWrite):
    version: int = Field(ge=1)


class OpenSaleVersion(BaseModel):
    version: int = Field(ge=1)


class OpenSaleComplete(OpenSaleVersion):
    payment: PaymentCreate


class OpenSaleRename(OpenSaleVersion):
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("The sale name cannot be empty")
        return value


class OpenSaleIssue(BaseModel):
    code: str
    message: str
    product_id: int | None = None
    current_price: Decimal | None = None
    available_stock: int | None = None


class OpenSaleLineRead(BaseModel):
    original_product_id: int
    product_id: int | None
    product_name: str
    product_sku: str
    quantity: int
    unit_price: Decimal
    product: ProductRead | None

    model_config = ConfigDict(from_attributes=True)


class OpenSaleRead(BaseModel):
    id: str
    number: int
    name: str
    cashier_id: int
    cashier_name: str
    customer_id: int | None
    customer_name: str | None
    status: Literal["DRAFT", "HELD", "COMPLETED", "CANCELLED"]
    version: int
    currency: str
    tax_percentage: Decimal
    discount_type: DiscountType
    discount_value: Decimal
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal | None
    total: Decimal | None
    notes: str
    sale_id: int | None
    created_at: datetime
    updated_at: datetime
    lines: list[OpenSaleLineRead]
    issues: list[OpenSaleIssue]
