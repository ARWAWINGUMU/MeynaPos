from datetime import datetime
from decimal import Decimal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator

from app.models.payment import PaymentMethod
from app.models.sale import DiscountType


class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class PaymentCreate(BaseModel):
    method: PaymentMethod | None = None
    method_id: int | None = Field(default=None, gt=0)
    amount: Decimal = Field(ge=0)
    reference: str | None = None

    @model_validator(mode="after")
    def require_method(self) -> "PaymentCreate":
        if self.method is None and self.method_id is None:
            raise ValueError("Select a payment method")
        return self


class SaleCreate(BaseModel):
    customer_id: int = Field(gt=0)
    items: list[SaleItemCreate] = Field(min_length=1)
    payment: PaymentCreate
    discount_type: DiscountType = Field(
        default=DiscountType.NONE,
        validation_alias=AliasChoices("tipo_descuento", "discount_type"),
        serialization_alias="tipo_descuento",
    )
    discount_value: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        validation_alias=AliasChoices("valor_descuento", "discount_value"),
        serialization_alias="valor_descuento",
    )
    discount_amount: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        validation_alias=AliasChoices("monto_descuento", "discount_amount"),
        serialization_alias="monto_descuento",
    )

    model_config = ConfigDict(populate_by_name=True)


class SaleDetailRead(BaseModel):
    product_id: int | None
    product_name: str
    product_sku: str | None
    product_barcode: str | None
    quantity: int
    unit_price: Decimal
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class PaymentRead(BaseModel):
    method: PaymentMethod
    method_id: int | None = None
    method_name: str | None = None
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
    discount_type: DiscountType = Field(serialization_alias="tipo_descuento")
    discount_value: Decimal = Field(serialization_alias="valor_descuento")
    discount_amount: Decimal = Field(serialization_alias="monto_descuento")
    total: Decimal
    created_at: datetime
    details: list[SaleDetailRead]
    payment: PaymentRead

    model_config = ConfigDict(from_attributes=True)
