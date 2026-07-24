from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import get_current_user, require_password_changed
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import ChangePasswordRequest, ChangeRequiredPasswordRequest, LoginRequest, MessageResponse, TokenResponse
from app.services.auth_service import AuthService


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return AuthService(UserRepository(db)).login(payload.identifier, payload.password, payload.captcha_token)


@router.post("/change-required-password", response_model=MessageResponse)
def change_required_password(
    payload: ChangeRequiredPasswordRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageResponse:
    return AuthService(UserRepository(db)).change_required_password(user, payload)


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_password_changed),
) -> MessageResponse:
    return AuthService(UserRepository(db)).change_password(user, payload)
