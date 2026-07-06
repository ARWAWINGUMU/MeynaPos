from datetime import datetime, timezone

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.core.security import create_access_token, verify_password
from app.repositories.user_repository import UserRepository
from app.schemas.auth import TokenResponse


class AuthService:
    MAX_FAILED_ATTEMPTS = 5
    TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA"

    def __init__(self, users: UserRepository) -> None:
        self.users = users

    def login(self, username: str, password: str, captcha_token: str | None = None) -> TokenResponse:
        self._validate_captcha(captcha_token)
        user = self.users.get_by_identifier(username)
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"message": "Usuario o contraseña incorrectos."})
        if user.locked:
            raise HTTPException(status_code=status.HTTP_423_LOCKED, detail=self._locked_detail())
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "La cuenta está inactiva."})
        if not verify_password(password, user.hashed_password):
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= self.MAX_FAILED_ATTEMPTS:
                user.locked = True
                user.locked_at = datetime.now(timezone.utc)
                self.users.db.commit()
                raise HTTPException(status_code=status.HTTP_423_LOCKED, detail=self._locked_detail())

            self.users.db.commit()
            attempts_remaining = max(0, self.MAX_FAILED_ATTEMPTS - user.failed_login_attempts)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"message": "Contraseña incorrecta.", "attempts_remaining": attempts_remaining},
            )

        user.failed_login_attempts = 0
        user.locked = False
        user.locked_at = None
        user.last_login_at = datetime.now(timezone.utc)
        self.users.db.commit()
        token = create_access_token(subject=user.email, role=user.role.name.value)
        return TokenResponse(access_token=token, role=user.role.name.value, full_name=user.full_name)

    @staticmethod
    def _locked_detail() -> dict[str, object]:
        return {
            "message": "La cuenta ha sido bloqueada. Contacte a un administrador para desbloquearla.",
            "locked": True,
            "attempts_remaining": 0,
        }

    @staticmethod
    def _validate_captcha(token: str | None) -> None:
        secret = get_settings().turnstile_secret_key
        if not secret:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"message": "La verificación de seguridad no está configurada."},
            )
        if not token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "Complete la verificación de seguridad."})
        if secret == AuthService.TURNSTILE_TEST_SECRET:
            return
        try:
            response = httpx.post(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                data={"secret": secret, "response": token},
                timeout=5,
            )
            verification = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"message": "No fue posible validar la verificación de seguridad."},
            ) from exc
        if not verification.get("success"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "No fue posible validar la verificación de seguridad."})
