from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_roles
from app.models.role import RoleName
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.user import AdminPasswordConfirmation, PasswordReset, UserCreate, UserRead, UserTemporaryPasswordResponse, UserUpdate
from app.services.user_service import UserService


router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserRead])
def list_users(
    search: str | None = None,
    role: RoleName | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> list[UserRead]:
    return UserService(db).list_users(search, role, status_filter)


@router.post("", response_model=UserTemporaryPasswordResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> UserTemporaryPasswordResponse:
    return UserService(db).create_user(payload)


@router.put("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleName.ADMIN)),
) -> UserRead:
    return UserService(db).update_user(user_id, payload, admin)


@router.patch("/{user_id}/activate", response_model=UserRead)
def activate_user(
    user_id: int,
    payload: AdminPasswordConfirmation,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleName.ADMIN)),
) -> UserRead:
    return UserService(db).reactivate_user(user_id, payload, admin)


@router.patch("/{user_id}/reactivate", response_model=UserRead)
def reactivate_user(
    user_id: int,
    payload: AdminPasswordConfirmation,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleName.ADMIN)),
) -> UserRead:
    return UserService(db).reactivate_user(user_id, payload, admin)


@router.patch("/{user_id}/deactivate", response_model=UserRead)
def deactivate_user(
    user_id: int,
    payload: AdminPasswordConfirmation,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleName.ADMIN)),
) -> UserRead:
    return UserService(db).deactivate_user(user_id, payload, admin)


@router.patch("/{user_id}/unlock", response_model=UserRead)
def unlock_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleName.ADMIN))) -> UserRead:
    return UserService(db).unlock_user(user_id, admin)


@router.patch("/{user_id}/reset-attempts", response_model=UserRead)
def reset_failed_attempts(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleName.ADMIN))) -> UserRead:
    return UserService(db).reset_failed_attempts(user_id, admin)


@router.patch("/{user_id}/password", response_model=UserTemporaryPasswordResponse)
def reset_password(
    user_id: int,
    payload: PasswordReset,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleName.ADMIN)),
) -> UserTemporaryPasswordResponse:
    return UserService(db).reset_password(user_id, payload, admin)


@router.delete("/{user_id}", response_model=MessageResponse)
def delete_user(
    user_id: int,
    payload: AdminPasswordConfirmation,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleName.ADMIN)),
) -> MessageResponse:
    return UserService(db).delete_user(user_id, payload, admin)
