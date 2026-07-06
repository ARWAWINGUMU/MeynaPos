from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "MeynaPOS"
    slogan: str = "Tecnología para crecer juntos"
    environment: str = Field(default="development", alias="ENVIRONMENT")
    api_prefix: str = "/api"
    database_url: str = Field(
        default="postgresql+psycopg://meynapos:meynapos@db:5432/meynapos",
        alias="DATABASE_URL",
    )
    secret_key: str = Field(default="change-this-secret-key", alias="SECRET_KEY")
    turnstile_secret_key: str | None = Field(default=None, alias="TURNSTILE_SECRET_KEY")
    recaptcha_secret_key: str | None = Field(default=None, alias="RECAPTCHA_SECRET_KEY")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    cors_origins: list[str] = Field(default=["http://localhost:5173", "http://127.0.0.1:5173"])

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
