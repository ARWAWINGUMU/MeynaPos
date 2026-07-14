from decimal import Decimal

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.business_setting import BusinessSetting
from app.repositories.business_setting_repository import BusinessSettingRepository
from app.schemas.setting import BusinessSettingsRead, BusinessSettingsUpdate
from app.services.file_storage_service import FileStorageService


class SettingService:
    SUPPORTED_CURRENCIES = {"COP", "USD"}
    DEFAULTS = {
        "business_name": "MeynaPOS",
        "tax_id": "0000000000",
        "address": "N/A",
        "phone": "N/A",
        "email": "N/A",
        "city": "N/A",
        "currency": "COP",
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
            if setting.currency not in self.SUPPORTED_CURRENCIES:
                setting.currency = "COP"
                return self.settings.save(setting)
            return setting
        return self.settings.add(BusinessSetting(**self.DEFAULTS))

    def update_settings(self, payload: BusinessSettingsUpdate) -> BusinessSettingsRead:
        setting = self.get_or_create_settings()
        data = payload.model_dump(exclude_unset=True)
        if "business_name" in data and not str(data["business_name"] or "").strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Business name is required")
        if "currency" in data:
            currency = str(data["currency"] or "").strip().upper()
            if currency not in self.SUPPORTED_CURRENCIES:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Currency must be COP or USD")
            data["currency"] = currency
        for field, value in data.items():
            if value is not None:
                setattr(setting, field, value)
        return BusinessSettingsRead.model_validate(self.settings.save(setting))

    def upload_logo(self, file: UploadFile) -> BusinessSettingsRead:
        setting = self.get_or_create_settings()
        setting.logo_url = FileStorageService().save_image(file, "business", setting.logo_url)
        return BusinessSettingsRead.model_validate(self.settings.save(setting))
