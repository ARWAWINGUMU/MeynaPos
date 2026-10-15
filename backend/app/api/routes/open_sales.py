from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_roles
from app.models.role import RoleName
from app.models.user import User
from app.schemas.open_sale import OpenSaleComplete, OpenSaleCreate, OpenSaleRead, OpenSaleRename, OpenSaleUpdate, OpenSaleVersion
from app.schemas.sale import SaleRead
from app.services.open_sale_service import OpenSaleService

router = APIRouter(prefix="/open-sales", tags=["Open sales"])
authorized = require_roles(RoleName.ADMIN, RoleName.CASHIER)


@router.get("", response_model=list[OpenSaleRead])
def list_open_sales(db: Session = Depends(get_db), user: User = Depends(authorized)) -> list[OpenSaleRead]:
    return OpenSaleService(db).list_active(user)


@router.post("", response_model=OpenSaleRead, status_code=201)
def create_open_sale(payload: OpenSaleCreate, db: Session = Depends(get_db), user: User = Depends(authorized)) -> OpenSaleRead:
    return OpenSaleService(db).create(payload, user)


@router.get("/{identifier}", response_model=OpenSaleRead)
def get_open_sale(identifier: UUID, db: Session = Depends(get_db), user: User = Depends(authorized)) -> OpenSaleRead:
    return OpenSaleService(db).get(str(identifier), user)


@router.put("/{identifier}", response_model=OpenSaleRead)
def update_open_sale(identifier: UUID, payload: OpenSaleUpdate, db: Session = Depends(get_db), user: User = Depends(authorized)) -> OpenSaleRead:
    return OpenSaleService(db).update(str(identifier), payload, user)


@router.post("/{identifier}/cancel", response_model=OpenSaleRead)
def cancel_open_sale(identifier: UUID, payload: OpenSaleVersion, db: Session = Depends(get_db), user: User = Depends(authorized)) -> OpenSaleRead:
    return OpenSaleService(db).cancel(str(identifier), payload.version, user)


@router.patch("/{identifier}/name", response_model=OpenSaleRead)
def rename_open_sale(identifier: UUID, payload: OpenSaleRename, db: Session = Depends(get_db), user: User = Depends(authorized)) -> OpenSaleRead:
    return OpenSaleService(db).rename(str(identifier), payload.name, payload.version, user)


@router.post("/{identifier}/reprice", response_model=OpenSaleRead)
def reprice_open_sale(identifier: UUID, payload: OpenSaleVersion, db: Session = Depends(get_db), user: User = Depends(authorized)) -> OpenSaleRead:
    return OpenSaleService(db).reprice(str(identifier), payload.version, user)


@router.post("/{identifier}/complete", response_model=SaleRead)
def complete_open_sale(identifier: UUID, payload: OpenSaleComplete, db: Session = Depends(get_db), user: User = Depends(authorized)) -> SaleRead:
    return OpenSaleService(db).complete(str(identifier), payload, user)
