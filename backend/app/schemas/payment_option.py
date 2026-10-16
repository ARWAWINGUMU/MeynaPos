from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.payment import PaymentMethod


class PaymentOptionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    kind: PaymentMethod = PaymentMethod.TRANSFER

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Payment method name cannot be empty")
        return value


class PaymentOptionRead(BaseModel):
    id: int
    business_id: int
    code: str
    name: str
    kind: PaymentMethod
    is_active: bool
    model_config = ConfigDict(from_attributes=True)
