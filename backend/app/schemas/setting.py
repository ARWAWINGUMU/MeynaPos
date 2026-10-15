from datetime import datetime
from decimal import Decimal

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PrintPreferences(BaseModel):
    format: Literal["THERMAL_58", "THERMAL_80", "LETTER", "A4"] = "LETTER"
    margin: float = Field(default=12, ge=0, le=30, allow_inf_nan=False)
    showLogo: bool = True
    showContact: bool = True
    showCustomer: bool = True
    showCashier: bool = True
    showFooter: Literal[True] = True

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="before")
    @classmethod
    def apply_format_margin(cls, value: object) -> object:
        if isinstance(value, dict) and "margin" not in value:
            defaults = {"THERMAL_58": 3, "THERMAL_80": 4, "LETTER": 12, "A4": 12}
            format_value = value.get("format")
            margin = defaults.get(format_value, 12) if isinstance(format_value, str) else 12
            return {**value, "margin": margin}
        return value

    @model_validator(mode="after")
    def validate_margin(self) -> "PrintPreferences":
        maximum = {"THERMAL_58": 8, "THERMAL_80": 12, "LETTER": 30, "A4": 30}[self.format]
        if self.margin > maximum:
            raise ValueError(f"Margin cannot exceed {maximum} mm for {self.format}")
        return self


class BusinessSettingsRead(BaseModel):
    id: int
    business_name: str
    tax_id: str
    address: str
    phone: str
    email: str
    city: str
    currency: Literal["COP", "USD"]
    tax_percentage: Decimal
    logo_url: str | None
    print_preferences: PrintPreferences = Field(default_factory=PrintPreferences)
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BusinessSettingsUpdate(BaseModel):
    business_name: str | None = Field(default=None, min_length=1, max_length=160)
    tax_id: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=160)
    city: str | None = Field(default=None, max_length=120)
    currency: Literal["COP", "USD"] | None = None
    tax_percentage: Decimal | None = Field(default=None, ge=0, le=100)
    logo_url: str | None = Field(default=None, max_length=255)
    print_preferences: PrintPreferences | None = None


SettingsRead = BusinessSettingsRead
SettingsUpdate = BusinessSettingsUpdate
