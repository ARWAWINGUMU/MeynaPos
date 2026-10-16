from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.business_setting import BusinessSetting
from app.models.payment import PaymentMethod
from app.models.payment_option import PaymentOption
from app.repositories.payment_option_repository import PaymentOptionRepository
from app.schemas.payment_option import PaymentOptionCreate
from app.schemas.sale import PaymentCreate
from app.services.setting_service import SettingService
from app.utils.names import normalize_name

DEFAULT_PAYMENT_OPTIONS = (("CASH", "Efectivo", "CASH"), ("CARD", "Tarjeta", "CARD"),
                           ("TRANSFER", "Transferencia", "TRANSFER"), ("QR_BREB", "QR Bre-B", "TRANSFER"))


class PaymentOptionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.business_id = SettingService(db).get_or_create_settings().id
        self.options = PaymentOptionRepository(db, self.business_id)

    def list(self) -> list[PaymentOption]:
        # Serialize lazy defaults for a newly initialized business across workers.
        self.db.execute(select(BusinessSetting.id).where(BusinessSetting.id == self.business_id).with_for_update()).scalar_one()
        existing = list(self.db.scalars(select(PaymentOption).where(PaymentOption.business_id == self.business_id)).all())
        codes = {option.code for option in existing}
        names = {option.name_key for option in existing}
        for code, name, kind in DEFAULT_PAYMENT_OPTIONS:
            if code not in codes and normalize_name(name) not in names:
                self.db.add(PaymentOption(business_id=self.business_id, code=code, name=name,
                    name_key=normalize_name(name), kind=kind, is_active=True))
        self.db.commit()
        return self.options.list()

    def create(self, payload: PaymentOptionCreate) -> PaymentOption:
        self.list()
        if self.options.find_name(normalize_name(payload.name)) is not None:
            raise HTTPException(409, "A payment method with this name already exists")
        option = PaymentOption(business_id=self.business_id, code=str(uuid4()), name=payload.name,
            name_key=normalize_name(payload.name), kind=payload.kind.value, is_active=True)
        try:
            self.db.add(option)
            self.db.commit()
            self.db.refresh(option)
            return option
        except IntegrityError as error:
            self.db.rollback()
            raise HTTPException(409, "A payment method with this name already exists") from error

    def resolve(self, payment: PaymentCreate) -> tuple[PaymentMethod, int | None, str | None]:
        if payment.method_id is None:
            if payment.method is None:
                raise HTTPException(422, "Select a payment method")
            return payment.method, None, None
        option = self.options.get(payment.method_id)
        if option is None:
            raise HTTPException(422, "The payment method is unavailable for this business")
        kind = PaymentMethod(option.kind)
        if payment.method is not None and payment.method != kind:
            raise HTTPException(422, "Payment method category does not match its configuration")
        return kind, option.id, option.name
