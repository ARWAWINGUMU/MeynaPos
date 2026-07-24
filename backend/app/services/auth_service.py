from datetime import datetime, timezone
import logging

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import ChangePasswordRequest, ChangeRequiredPasswordRequest, MessageResponse, TokenResponse
from app.utils.passwords import validate_password_policy


logger = logging.getLogger(__name__)


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

        now = datetime.now(timezone.utc)
        if user.must_change_password and self._temporary_password_expired(user, now):
            logger.info("TEMPORARY_PASSWORD_EXPIRED user_id=%s", user.id)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"message": "La contraseña temporal expiró. Solicite un nuevo restablecimiento al administrador.", "temporary_password_expired": True},
            )

        user.failed_login_attempts = 0
        user.locked = False
        user.locked_at = None
        user.last_login_at = now
        self.users.db.commit()
        token = create_access_token(
            subject=user.email,
            role=user.role.name.value,
            token_version=user.token_version,
            password_change_required=user.must_change_password,
        )
        return TokenResponse(
            access_token=token,
            role=user.role.name.value,
            full_name=user.full_name,
            user_id=user.id,
            must_change_password=user.must_change_password,
        )

    def change_required_password(self, user: User, payload: ChangeRequiredPasswordRequest) -> MessageResponse:
        if not user.must_change_password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "No hay cambio de contraseña pendiente."})
        if not verify_password(payload.current_password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "No fue posible actualizar la contraseña."})
        if payload.new_password != payload.confirm_password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "Las contraseñas no coinciden."})
        if verify_password(payload.new_password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "La nueva contraseña no puede ser igual a la temporal."})
        errors = validate_password_policy(payload.new_password)
        if errors:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": " ".join(errors)})

        user.hashed_password = hash_password(payload.new_password)
        user.must_change_password = False
        user.temporary_password_expires_at = None
        user.password_changed_at = datetime.now(timezone.utc)
        user.token_version += 1
        user.failed_login_attempts = 0
        user.locked = False
        user.locked_at = None
        self.users.db.commit()
        logger.info("USER_COMPLETED_REQUIRED_PASSWORD_CHANGE user_id=%s", user.id)
        return MessageResponse(message="Contraseña actualizada correctamente. Inicie sesión nuevamente.")

    def change_password(self, user: User, payload: ChangePasswordRequest) -> MessageResponse:
        if user.must_change_password:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "Debe completar el cambio obligatorio de contraseña."})
        if not verify_password(payload.current_password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "No fue posible actualizar la contraseña."})
        if payload.new_password != payload.confirm_password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "Las contraseñas no coinciden."})
        if verify_password(payload.new_password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "La nueva contraseña debe ser diferente."})
        errors = validate_password_policy(payload.new_password)
        if errors:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": " ".join(errors)})

        user.hashed_password = hash_password(payload.new_password)
        user.password_changed_at = datetime.now(timezone.utc)
        user.token_version += 1
        self.users.db.commit()
        logger.info("USER_CHANGED_PASSWORD user_id=%s", user.id)
        return MessageResponse(message="Contraseña actualizada correctamente. Inicie sesión nuevamente.")

    @staticmethod
    def _locked_detail() -> dict[str, object]:
        return {
            "message": "La cuenta ha sido bloqueada. Contacte a un administrador para desbloquearla.",
            "locked": True,
            "attempts_remaining": 0,
        }

    @staticmethod
    def _temporary_password_expired(user: User, now: datetime) -> bool:
        if user.temporary_password_expires_at is None:
            return False
        expires_at = user.temporary_password_expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        return expires_at <= now

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
