from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
