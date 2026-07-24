from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.role import RoleName


class UserCreate(BaseModel):
    first_name: str = Field(min_length=2, max_length=80)
    last_name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    username: str = Field(min_length=3, max_length=80)
    password: str | None = Field(default=None, min_length=8)
    role: RoleName

    model_config = ConfigDict(extra="forbid")


class UserUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=2, max_length=80)
    last_name: str | None = Field(default=None, min_length=2, max_length=80)
    email: EmailStr | None = None
    username: str | None = Field(default=None, min_length=3, max_length=80)
    role: RoleName | None = None

    model_config = ConfigDict(extra="forbid")


class PasswordReset(BaseModel):
    admin_password: str = Field(min_length=1)
    temporary_password: str | None = Field(default=None, min_length=8)


class AdminPasswordConfirmation(BaseModel):
    admin_password: str = Field(min_length=1)


class UserRead(BaseModel):
    id: int
    first_name: str | None
    last_name: str | None
    full_name: str
    email: str
    username: str | None
    role: RoleName
    is_active: bool
    is_superuser: bool
    created_at: datetime
    last_login_at: datetime | None
    failed_login_attempts: int
    locked: bool
    locked_at: datetime | None
    must_change_password: bool
    temporary_password_expires_at: datetime | None
    password_changed_at: datetime | None
    password_reset_by_id: int | None
    token_version: int
    can_be_deleted: bool = False

    model_config = ConfigDict(from_attributes=True)


class UserTemporaryPasswordResponse(UserRead):
    temporary_password: str
