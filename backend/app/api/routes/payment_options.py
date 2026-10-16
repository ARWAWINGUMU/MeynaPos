from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_roles
from app.models.role import RoleName
from app.models.user import User
from app.schemas.payment_option import PaymentOptionCreate, PaymentOptionRead
from app.services.payment_option_service import PaymentOptionService

router = APIRouter(prefix="/payment-methods", tags=["Payment methods"])


@router.get("", response_model=list[PaymentOptionRead])
def list_payment_methods(db: Session = Depends(get_db), _: User = Depends(require_roles(RoleName.ADMIN, RoleName.CASHIER))) -> list[PaymentOptionRead]:
    return PaymentOptionService(db).list()


@router.post("", response_model=PaymentOptionRead, status_code=201)
def create_payment_method(payload: PaymentOptionCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleName.ADMIN))) -> PaymentOptionRead:
    return PaymentOptionService(db).create(payload)
