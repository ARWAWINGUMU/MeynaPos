from pydantic import BaseModel, Field, model_validator


class LoginRequest(BaseModel):
    username: str | None = Field(default=None, min_length=1)
    email: str | None = Field(default=None, min_length=1)
    password: str
    turnstile_token: str | None = None
    captchaToken: str | None = None

    @model_validator(mode="after")
    def validate_identifier(self) -> "LoginRequest":
        if not self.username and not self.email:
            raise ValueError("Username is required")
        return self

    @property
    def identifier(self) -> str:
        return self.username or self.email or ""

    @property
    def captcha_token(self) -> str | None:
        return self.captchaToken or self.turnstile_token


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str
