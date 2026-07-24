from functools import lru_cache
import json

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
    initial_admin_email: str | None = Field(default=None, alias="INITIAL_ADMIN_EMAIL")
    initial_admin_password: str | None = Field(default=None, alias="INITIAL_ADMIN_PASSWORD")
    initial_admin_name: str = Field(default="Administrador", alias="INITIAL_ADMIN_NAME")
    temp_password_expire_hours: int = Field(default=24, alias="TEMP_PASSWORD_EXPIRE_HOURS")
    default_business_name: str = Field(default="MeynaPOS", alias="BUSINESS_NAME")
    default_business_nit: str = Field(default="000000000-0", alias="BUSINESS_NIT")
    media_root: str = Field(default="/app/media", alias="MEDIA_ROOT")
    media_url_prefix: str = Field(default="/media", alias="MEDIA_URL_PREFIX")
    max_upload_size_bytes: int = Field(default=5 * 1024 * 1024, alias="MAX_UPLOAD_SIZE_BYTES")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    cors_origins: str = Field(default="http://localhost:5173,http://127.0.0.1:5173", alias="CORS_ORIGINS")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip().startswith("["):
            loaded = json.loads(self.cors_origins)
            if isinstance(loaded, list):
                return [str(origin).strip() for origin in loaded if str(origin).strip()]
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
