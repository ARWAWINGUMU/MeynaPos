from pydantic import BaseModel, ConfigDict, Field


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
