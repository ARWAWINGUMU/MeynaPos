from datetime import datetime, timedelta, timezone
import logging

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password, verify_password
from app.models.role import Role, RoleName
from app.models.sale import Sale
from app.models.session import Session as UserSession
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import MessageResponse
from app.schemas.user import AdminPasswordConfirmation, PasswordReset, UserCreate, UserRead, UserTemporaryPasswordResponse, UserUpdate
from app.utils.passwords import generate_temporary_password, validate_password_policy


logger = logging.getLogger(__name__)


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)

    def list_users(self, search: str | None, role: RoleName | None, status_filter: str | None) -> list[UserRead]:
        return [self._to_read(user) for user in self.users.list(search, role, status_filter)]

    def create_user(self, payload: UserCreate) -> UserTemporaryPasswordResponse:
        if self.users.get_by_email(payload.email) is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "El correo ya está registrado."})
        if self.users.get_by_username(payload.username) is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "El nombre de usuario ya existe."})
        role = self._get_role(payload.role)
        temporary_password = self._resolve_temporary_password(payload.password)
        user = User(
            first_name=payload.first_name,
            last_name=payload.last_name,
            full_name=f"{payload.first_name} {payload.last_name}",
            email=payload.email,
            username=payload.username,
            hashed_password=hash_password(temporary_password),
            must_change_password=True,
            temporary_password_expires_at=self._temporary_password_expiration(),
            password_changed_at=None,
            token_version=0,
            is_superuser=False,
            role_id=role.id,
        )
        created_user = self.users.add(user)
        logger.info("ADMIN_CREATED_USER user_id=%s role=%s", created_user.id, payload.role.value)
        return self._to_temporary_password_response(created_user, temporary_password)

    def update_user(self, user_id: int, payload: UserUpdate, admin: User) -> UserRead:
        user = self._get_user(user_id)
        self._ensure_can_manage_user(admin, user, "editar")
        data = payload.model_dump(exclude_unset=True)
        if "email" in data and data["email"] and data["email"] != user.email and self.users.get_by_email(data["email"]) is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "El correo ya está registrado."})
        if "username" in data and data["username"] and data["username"] != user.username and self.users.get_by_username(data["username"]) is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "El nombre de usuario ya existe."})
        if "role" in data and data["role"] is not None:
            if user.is_superuser:
                if data["role"] == user.role.name:
                    data.pop("role")
                else:
                    logger.info("SUPERUSER_MODIFICATION_REJECTED admin_id=%s target_user_id=%s", admin.id, user.id)
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "No se puede cambiar el rol del superadministrador."})
            elif user.id == admin.id and data["role"] != RoleName.ADMIN:
                logger.info("ADMIN_ATTEMPTED_SELF_ROLE_CHANGE admin_id=%s", admin.id)
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "No puede quitarse su propio rol de administrador."})
            if "role" in data:
                user.role_id = self._get_role(data.pop("role")).id
        for field, value in data.items():
            setattr(user, field, value)
        if user.first_name or user.last_name:
            user.full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
        self.db.commit()
        self.db.refresh(user)
        logger.info("ADMIN_EDITED_USER admin_id=%s target_user_id=%s", admin.id, user.id)
        return self._to_read(user)

    def set_active(self, user_id: int, active: bool) -> UserRead:
        user = self._get_user(user_id)
        user.is_active = active
        self.db.commit()
        self.db.refresh(user)
        return self._to_read(user)

    def deactivate_user(self, user_id: int, payload: AdminPasswordConfirmation, admin: User) -> UserRead:
        self._validate_admin_reauthentication(admin, payload.admin_password, "desactivar el usuario")
        user = self._get_user(user_id)
        self._ensure_can_manage_user(admin, user, "desactivar")
        if user.is_superuser:
            logger.info("SUPERUSER_DEACTIVATION_REJECTED admin_id=%s target_user_id=%s", admin.id, user.id)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "No se puede desactivar el superadministrador."})
        if user.id == admin.id:
            logger.info("ADMIN_ATTEMPTED_SELF_DEACTIVATION admin_id=%s", admin.id)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "No puede desactivarse a sí mismo."})
        if user.role.name == RoleName.ADMIN:
            self._ensure_another_active_admin(user.id)
            logger.info("ADMIN_DEACTIVATED_ADMIN admin_id=%s target_user_id=%s", admin.id, user.id)
        else:
            logger.info("ADMIN_DEACTIVATED_USER admin_id=%s target_user_id=%s", admin.id, user.id)

        user.is_active = False
        user.token_version += 1
        self.db.commit()
        self.db.refresh(user)
        return self._to_read(user)

    def reactivate_user(self, user_id: int, payload: AdminPasswordConfirmation, admin: User) -> UserRead:
        self._validate_admin_reauthentication(admin, payload.admin_password, "reactivar el usuario")
        user = self._get_user(user_id)
        self._ensure_can_manage_user(admin, user, "reactivar")
        user.is_active = True
        user.token_version += 1
        self.db.commit()
        self.db.refresh(user)
        logger.info("ADMIN_REACTIVATED_USER admin_id=%s target_user_id=%s", admin.id, user.id)
        return self._to_read(user)

    def delete_user(self, user_id: int, payload: AdminPasswordConfirmation, admin: User) -> MessageResponse:
        self._validate_admin_reauthentication(admin, payload.admin_password, "eliminar el usuario")
        user = self._get_user(user_id)
        self._ensure_can_manage_user(admin, user, "eliminar")
        if user.is_superuser:
            logger.info("SUPERUSER_MODIFICATION_REJECTED admin_id=%s target_user_id=%s", admin.id, user.id)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "No se puede eliminar el superadministrador."})
        if user.id == admin.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "No puede eliminarse a sí mismo."})
        if user.role.name == RoleName.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "No se permite eliminar físicamente administradores."})
        if self._has_sales_history(user.id):
            logger.info("USER_DELETION_REJECTED_HAS_HISTORY admin_id=%s target_user_id=%s", admin.id, user.id)
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "El usuario no puede eliminarse porque tiene historial. Desactívelo para conservar sus relaciones."})

        self.db.execute(update(User).where(User.password_reset_by_id == user.id).values(password_reset_by_id=None))
        self.db.query(UserSession).filter(UserSession.user_id == user.id).delete(synchronize_session=False)
        self.db.delete(user)
        self.db.commit()
        logger.info("USER_PERMANENTLY_DELETED admin_id=%s target_user_id=%s", admin.id, user.id)
        return MessageResponse(message="Usuario eliminado definitivamente.")

    def unlock_user(self, user_id: int, admin: User) -> UserRead:
        user = self._get_user(user_id)
        self._ensure_can_manage_user(admin, user, "desbloquear")
        user.locked = False
        user.locked_at = None
        user.failed_login_attempts = 0
        self.db.commit()
        self.db.refresh(user)
        return self._to_read(user)

    def reset_failed_attempts(self, user_id: int, admin: User) -> UserRead:
        user = self._get_user(user_id)
        self._ensure_can_manage_user(admin, user, "reiniciar intentos")
        user.failed_login_attempts = 0
        self.db.commit()
        self.db.refresh(user)
        return self._to_read(user)

    def reset_password(self, user_id: int, payload: PasswordReset, admin: User) -> UserTemporaryPasswordResponse:
        self._validate_admin_reauthentication(admin, payload.admin_password, "restablecer la contraseña")
        user = self._get_user(user_id)
        if user.is_superuser and user.id != admin.id:
            logger.info("SUPERUSER_PASSWORD_RESET_REJECTED admin_id=%s target_user_id=%s", admin.id, user.id)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "No se puede restablecer la contraseña del superadministrador."})
        temporary_password = self._resolve_temporary_password(payload.temporary_password)
        user.hashed_password = hash_password(temporary_password)
        user.must_change_password = True
        user.temporary_password_expires_at = self._temporary_password_expiration()
        user.password_changed_at = None
        user.password_reset_by_id = admin.id
        user.token_version += 1
        user.locked = False
        user.locked_at = None
        user.failed_login_attempts = 0
        self.db.commit()
        self.db.refresh(user)
        logger.info("ADMIN_RESET_USER_PASSWORD admin_id=%s target_user_id=%s", admin.id, user.id)
        return self._to_temporary_password_response(user, temporary_password)

    @staticmethod
    def _resolve_temporary_password(password: str | None) -> str:
        temporary_password = password or generate_temporary_password()
        errors = validate_password_policy(temporary_password)
        if errors:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": " ".join(errors)})
        return temporary_password

    @staticmethod
    def _temporary_password_expiration() -> datetime:
        return datetime.now(timezone.utc) + timedelta(hours=get_settings().temp_password_expire_hours)

    def _validate_admin_reauthentication(self, admin: User, admin_password: str, action: str) -> None:
        if not admin.is_active or admin.locked or admin.role.name != RoleName.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": f"No fue posible {action}."})
        if not verify_password(admin_password, admin.hashed_password):
            logger.info("PASSWORD_RESET_ADMIN_REAUTH_FAILED admin_id=%s action=%s", admin.id, action)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": f"No fue posible {action}."})

    def _ensure_another_active_admin(self, target_admin_id: int) -> None:
        active_admin_ids = self.db.scalars(
            select(User.id)
            .join(User.role)
            .where(Role.name == RoleName.ADMIN, User.is_active.is_(True), User.locked.is_(False), User.id != target_admin_id)
            .with_for_update()
        ).all()
        if not active_admin_ids:
            logger.info("ADMIN_ATTEMPTED_LAST_ADMIN_DEACTIVATION target_user_id=%s", target_admin_id)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "No puede desactivarse al último administrador activo del sistema."})

    @staticmethod
    def _ensure_can_manage_user(admin: User, user: User, action: str) -> None:
        if user.is_superuser and user.id != admin.id:
            logger.info("SUPERUSER_MODIFICATION_REJECTED admin_id=%s target_user_id=%s action=%s", admin.id, user.id, action)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "No puede modificar al superadministrador."})

    def _has_sales_history(self, user_id: int) -> bool:
        return bool(self.db.scalar(select(func.count(Sale.id)).where(Sale.cashier_id == user_id)))

    def _get_user(self, user_id: int) -> User:
        user = self.users.get(user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    def _get_role(self, role_name: RoleName) -> Role:
        role = self.db.scalars(select(Role).where(Role.name == role_name)).first()
        if role is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role not found")
        return role

    @staticmethod
    def _to_read(user: User) -> UserRead:
        return UserRead(
            id=user.id,
            first_name=user.first_name,
            last_name=user.last_name,
            full_name=user.full_name,
            email=user.email,
            username=user.username,
            role=user.role.name,
            is_active=user.is_active,
            is_superuser=user.is_superuser,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
            failed_login_attempts=user.failed_login_attempts,
            locked=user.locked,
            locked_at=user.locked_at,
            must_change_password=user.must_change_password,
            temporary_password_expires_at=user.temporary_password_expires_at,
            password_changed_at=user.password_changed_at,
            password_reset_by_id=user.password_reset_by_id,
            token_version=user.token_version,
            can_be_deleted=user.role.name != RoleName.ADMIN and not bool(user.sales),
        )

    @classmethod
    def _to_temporary_password_response(cls, user: User, temporary_password: str) -> UserTemporaryPasswordResponse:
        data = cls._to_read(user).model_dump()
        return UserTemporaryPasswordResponse(**data, temporary_password=temporary_password)
