from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.role import RoleName


class UserCreate(BaseModel):
    first_name: str = Field(min_length=2, max_length=80)
    last_name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=8)
    role: RoleName


class UserUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=2, max_length=80)
    last_name: str | None = Field(default=None, min_length=2, max_length=80)
    email: EmailStr | None = None
    username: str | None = Field(default=None, min_length=3, max_length=80)
    role: RoleName | None = None


class PasswordReset(BaseModel):
    password: str = Field(min_length=8)


class UserRead(BaseModel):
    id: int
    first_name: str | None
    last_name: str | None
    full_name: str
    email: str
    username: str | None
    role: RoleName
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None
    failed_login_attempts: int
    locked: bool
    locked_at: datetime | None

    model_config = ConfigDict(from_attributes=True)

