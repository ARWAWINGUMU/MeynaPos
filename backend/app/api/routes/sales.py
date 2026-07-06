from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_roles
from app.models.role import RoleName
from app.models.user import User
from app.schemas.sale import SaleCreate, SaleRead
from app.services.sale_service import SaleService


router = APIRouter(prefix="/sales", tags=["Sales"])


@router.post("", response_model=SaleRead, status_code=status.HTTP_201_CREATED)
def create_sale(
    payload: SaleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(RoleName.ADMIN, RoleName.CASHIER)),
) -> SaleRead:
    return SaleService(db).create_sale(payload, cashier_id=user.id)


@router.get("", response_model=list[SaleRead])
def list_sales(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN, RoleName.CASHIER)),
) -> list[SaleRead]:
    return SaleService(db).list_sales()

