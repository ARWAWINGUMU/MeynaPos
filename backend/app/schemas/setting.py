from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class BusinessSettingsRead(BaseModel):
    id: int
    business_name: str
    tax_id: str
    address: str
    phone: str
    email: str
    city: str
    currency: str
    tax_percentage: Decimal
    logo_url: str | None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BusinessSettingsUpdate(BaseModel):
    business_name: str | None = Field(default=None, min_length=1, max_length=160)
    tax_id: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=160)
    city: str | None = Field(default=None, max_length=120)
    currency: str | None = Field(default=None, min_length=1, max_length=10)
    tax_percentage: Decimal | None = Field(default=None, ge=0, le=100)
    logo_url: str | None = Field(default=None, max_length=255)


SettingsRead = BusinessSettingsRead
SettingsUpdate = BusinessSettingsUpdate
