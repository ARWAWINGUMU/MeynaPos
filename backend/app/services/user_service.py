from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.role import Role, RoleName
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import PasswordReset, UserCreate, UserRead, UserUpdate


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)

    def list_users(self, search: str | None, role: RoleName | None, status_filter: str | None) -> list[UserRead]:
        return [self._to_read(user) for user in self.users.list(search, role, status_filter)]

    def create_user(self, payload: UserCreate) -> UserRead:
        role = self._get_role(payload.role)
        user = User(
            first_name=payload.first_name,
            last_name=payload.last_name,
            full_name=f"{payload.first_name} {payload.last_name}",
            email=payload.email,
            username=payload.username,
            hashed_password=hash_password(payload.password),
            role_id=role.id,
        )
        return self._to_read(self.users.add(user))

    def update_user(self, user_id: int, payload: UserUpdate) -> UserRead:
        user = self._get_user(user_id)
        data = payload.model_dump(exclude_unset=True)
        if "role" in data and data["role"] is not None:
            user.role_id = self._get_role(data.pop("role")).id
        for field, value in data.items():
            setattr(user, field, value)
        if user.first_name or user.last_name:
            user.full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
        self.db.commit()
        self.db.refresh(user)
        return self._to_read(user)

    def set_active(self, user_id: int, active: bool) -> UserRead:
        user = self._get_user(user_id)
        user.is_active = active
        self.db.commit()
        self.db.refresh(user)
        return self._to_read(user)

    def unlock_user(self, user_id: int) -> UserRead:
        user = self._get_user(user_id)
        user.locked = False
        user.locked_at = None
        user.failed_login_attempts = 0
        self.db.commit()
        self.db.refresh(user)
        return self._to_read(user)

    def reset_failed_attempts(self, user_id: int) -> UserRead:
        user = self._get_user(user_id)
        user.failed_login_attempts = 0
        self.db.commit()
        self.db.refresh(user)
        return self._to_read(user)

    def reset_password(self, user_id: int, payload: PasswordReset) -> UserRead:
        user = self._get_user(user_id)
        user.hashed_password = hash_password(payload.password)
        user.locked = False
        user.locked_at = None
        user.failed_login_attempts = 0
        self.db.commit()
        self.db.refresh(user)
        return self._to_read(user)

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
            created_at=user.created_at,
            last_login_at=user.last_login_at,
            failed_login_attempts=user.failed_login_attempts,
            locked=user.locked,
            locked_at=user.locked_at,
        )
