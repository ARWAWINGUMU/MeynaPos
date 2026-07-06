from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PurchaseItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    unit_cost: Decimal = Field(gt=0)


class PurchaseCreate(BaseModel):
    supplier_name: str = Field(min_length=2, max_length=160)
    items: list[PurchaseItemCreate] = Field(min_length=1)


class PurchaseDetailRead(BaseModel):
    product_id: int
    quantity: int
    unit_cost: Decimal
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class PurchaseRead(BaseModel):
    id: int
    supplier_name: str
    total: Decimal
    details: list[PurchaseDetailRead]

    model_config = ConfigDict(from_attributes=True)

