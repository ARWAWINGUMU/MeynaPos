from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_roles
from app.models.role import RoleName
from app.models.user import User
from app.schemas.purchase import PurchaseCreate, PurchaseRead
from app.services.purchase_service import PurchaseService


router = APIRouter(prefix="/purchases", tags=["Purchases"])


@router.get("", response_model=list[PurchaseRead])
def list_purchases(db: Session = Depends(get_db), _: User = Depends(require_roles(RoleName.ADMIN))) -> list[PurchaseRead]:
    return PurchaseService(db).list()


@router.post("", response_model=PurchaseRead, status_code=status.HTTP_201_CREATED)
def create_purchase(payload: PurchaseCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleName.ADMIN))) -> PurchaseRead:
    return PurchaseService(db).create(payload)

