from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.business_setting import BusinessSetting


class BusinessSettingRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_current(self) -> BusinessSetting | None:
        return self.db.scalars(select(BusinessSetting).order_by(BusinessSetting.id.asc())).first()

    def add(self, setting: BusinessSetting) -> BusinessSetting:
        self.db.add(setting)
        self.db.commit()
        self.db.refresh(setting)
        return setting

    def save(self, setting: BusinessSetting) -> BusinessSetting:
        self.db.commit()
        self.db.refresh(setting)
        return setting
