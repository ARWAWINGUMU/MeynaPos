from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.business_setting import BusinessSetting
from app.repositories.business_setting_repository import BusinessSettingRepository
from app.schemas.setting import BusinessSettingsRead, BusinessSettingsUpdate


class SettingService:
    DEFAULTS = {
        "business_name": "MeynaPOS",
        "tax_id": "0000000000",
        "address": "N/A",
        "phone": "N/A",
        "email": "N/A",
        "city": "N/A",
        "currency": "USD",
        "tax_percentage": Decimal("0.00"),
        "logo_url": None,
    }

    def __init__(self, db: Session) -> None:
        self.db = db
        self.settings = BusinessSettingRepository(db)

    def get_settings(self) -> BusinessSettingsRead:
        return BusinessSettingsRead.model_validate(self.get_or_create_settings())

    def get_or_create_settings(self) -> BusinessSetting:
        setting = self.settings.get_current()
        if setting is not None:
            return setting
        return self.settings.add(BusinessSetting(**self.DEFAULTS))

    def update_settings(self, payload: BusinessSettingsUpdate) -> BusinessSettingsRead:
        setting = self.get_or_create_settings()
        data = payload.model_dump(exclude_unset=True)
        if "business_name" in data and not str(data["business_name"] or "").strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Business name is required")
        if "currency" in data and not str(data["currency"] or "").strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Currency is required")
        for field, value in data.items():
            if value is not None:
                setattr(setting, field, value)
        return BusinessSettingsRead.model_validate(self.settings.save(setting))

    def upload_logo(self, file: UploadFile) -> BusinessSettingsRead:
        setting = self.get_or_create_settings()
        extension = Path(file.filename or "").suffix.lower()
        if extension not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Logo must be an image file")
        upload_dir = Path("static/uploads/business")
        upload_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid4().hex}{extension}"
        destination = upload_dir / filename
        destination.write_bytes(file.file.read())
        setting.logo_url = f"/static/uploads/business/{filename}"
        return BusinessSettingsRead.model_validate(self.settings.save(setting))
