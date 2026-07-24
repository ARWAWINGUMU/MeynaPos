from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_roles
from app.models.role import RoleName
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.repositories.category_repository import CategoryRepository
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate
from app.services.category_service import CategoryService


router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=list[CategoryRead])
def list_categories(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN, RoleName.CASHIER)),
) -> list[CategoryRead]:
    return CategoryService(CategoryRepository(db)).list_categories(include_inactive)


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> CategoryRead:
    return CategoryService(CategoryRepository(db)).create_category(payload)


@router.put("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> CategoryRead:
    return CategoryService(CategoryRepository(db)).update_category(category_id, payload)


@router.patch("/{category_id}/activate", response_model=CategoryRead)
def activate_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> CategoryRead:
    return CategoryService(CategoryRepository(db)).set_active(category_id, True)


@router.patch("/{category_id}/deactivate", response_model=CategoryRead)
def deactivate_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> CategoryRead:
    return CategoryService(CategoryRepository(db)).set_active(category_id, False)


@router.delete("/{category_id}", response_model=MessageResponse)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> MessageResponse:
    return CategoryService(CategoryRepository(db)).delete_category(category_id)
