from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_roles
from app.models.role import RoleName
from app.models.user import User
from app.schemas.customer import CustomerCreate, CustomerRead, CustomerSaleHistoryItem, CustomerSummary, CustomerUpdate
from app.services.customer_service import CustomerService


router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("", response_model=list[CustomerRead])
def list_customers(search: str | None = None, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleName.ADMIN, RoleName.CASHIER))) -> list[CustomerRead]:
    return CustomerService(db).list(search)


@router.get("/summary", response_model=list[CustomerSummary])
def list_customer_summary(search: str | None = None, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleName.ADMIN, RoleName.CASHIER))) -> list[CustomerSummary]:
    return CustomerService(db).list_summary(search)


@router.get("/default", response_model=CustomerRead)
def get_default_customer(db: Session = Depends(get_db), _: User = Depends(require_roles(RoleName.ADMIN, RoleName.CASHIER))) -> CustomerRead:
    return CustomerService(db).get_default_customer()


@router.get("/{customer_id}/history", response_model=list[CustomerSaleHistoryItem])
def get_customer_history(customer_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleName.ADMIN, RoleName.CASHIER))) -> list[CustomerSaleHistoryItem]:
    return CustomerService(db).history(customer_id)


@router.post("", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleName.ADMIN, RoleName.CASHIER))) -> CustomerRead:
    return CustomerService(db).create(payload)


@router.put("/{customer_id}", response_model=CustomerRead)
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleName.ADMIN, RoleName.CASHIER))) -> CustomerRead:
    return CustomerService(db).update(customer_id, payload)
