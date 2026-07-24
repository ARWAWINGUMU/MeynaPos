from decimal import Decimal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class InventoryRead(BaseModel):
    quantity: int
    minimum_stock: int
    low_stock: bool

    model_config = ConfigDict(from_attributes=True)


class ProductBase(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str | None = None
    barcode: str | None = Field(default=None, max_length=80, validation_alias=AliasChoices("barcode", "codigo_barras"))
    qr_code: str | None = Field(default=None, max_length=255, validation_alias=AliasChoices("qr_code", "codigo_qr"))
    sku: str = Field(min_length=2, max_length=80)
    price: Decimal = Field(gt=0)
    cost: Decimal = Field(ge=0)
    category_id: int | None = None
    supplier_id: int | None = None
    image_url: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class ProductCreate(ProductBase):
    initial_stock: int = Field(default=0, ge=0)
    minimum_stock: int = Field(default=5, ge=0)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = None
    barcode: str | None = Field(default=None, max_length=80, validation_alias=AliasChoices("barcode", "codigo_barras"))
    qr_code: str | None = Field(default=None, max_length=255, validation_alias=AliasChoices("qr_code", "codigo_qr"))
    sku: str | None = Field(default=None, min_length=2, max_length=80)
    price: Decimal | None = Field(default=None, gt=0)
    cost: Decimal | None = Field(default=None, ge=0)
    category_id: int | None = None
    supplier_id: int | None = None
    image_url: str | None = None
    is_active: bool | None = None
    quantity: int | None = Field(default=None, ge=0)
    minimum_stock: int | None = Field(default=None, ge=0)

    model_config = ConfigDict(populate_by_name=True)


class ProductRead(ProductBase):
    id: int
    is_active: bool
    inventory: InventoryRead | None = None

    model_config = ConfigDict(from_attributes=True)


class ProductRemovalResponse(BaseModel):
    action: str
    product: ProductRead | None = None
    history_preserved: bool = True
