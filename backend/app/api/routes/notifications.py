from hashlib import sha256

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_roles
from app.models.role import RoleName
from app.models.user import User
from app.schemas.notification import InventoryAlertRead
from app.services.inventory_alert_service import InventoryAlertService


router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/inventory-alerts", response_model=list[InventoryAlertRead])
def list_inventory_alerts(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> list[InventoryAlertRead] | Response:
    alerts = [InventoryAlertRead.model_validate(alert) for alert in InventoryAlertService(db).list_active()]
    digest = sha256("\n".join(alert.model_dump_json() for alert in alerts).encode()).hexdigest()
    etag = f'"{digest}"'
    headers = {"ETag": etag, "Cache-Control": "private, no-cache", "Vary": "Authorization"}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    response.headers.update(headers)
    return alerts


@router.patch("/inventory-alerts/{alert_id}/read", response_model=InventoryAlertRead)
def mark_inventory_alert_as_read(
    alert_id: int,
    read: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> InventoryAlertRead:
    return InventoryAlertService(db).mark_as_read(alert_id, read=read)
