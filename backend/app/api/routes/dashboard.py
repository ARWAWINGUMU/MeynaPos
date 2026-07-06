from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_roles
from app.models.role import RoleName
from app.models.user import User
from app.schemas.dashboard import DashboardSummary
from app.services.dashboard_service import DashboardService


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN, RoleName.CASHIER)),
) -> DashboardSummary:
    return DashboardService(db).summary()
