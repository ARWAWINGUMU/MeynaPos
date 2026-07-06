from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_roles
from app.models.role import RoleName
from app.models.user import User
from app.schemas.setting import BusinessSettingsRead, BusinessSettingsUpdate
from app.services.setting_service import SettingService


router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=BusinessSettingsRead)
def get_settings(db: Session = Depends(get_db), _: User = Depends(require_roles(RoleName.ADMIN, RoleName.CASHIER))) -> BusinessSettingsRead:
    return SettingService(db).get_settings()


@router.put("", response_model=BusinessSettingsRead)
def update_settings(payload: BusinessSettingsUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleName.ADMIN))) -> BusinessSettingsRead:
    return SettingService(db).update_settings(payload)


@router.post("/logo", response_model=BusinessSettingsRead)
def upload_business_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> BusinessSettingsRead:
    return SettingService(db).upload_logo(file)
