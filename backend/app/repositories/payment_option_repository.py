from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.payment_option import PaymentOption


class PaymentOptionRepository:
    def __init__(self, db: Session, business_id: int) -> None:
        self.db = db
        self.business_id = business_id

    def list(self) -> list[PaymentOption]:
        return list(self.db.scalars(select(PaymentOption).where(PaymentOption.business_id == self.business_id,
            PaymentOption.is_active.is_(True)).order_by(PaymentOption.id)).all())

    def get(self, identifier: int) -> PaymentOption | None:
        return self.db.scalars(select(PaymentOption).where(PaymentOption.id == identifier,
            PaymentOption.business_id == self.business_id, PaymentOption.is_active.is_(True))).first()

    def find_name(self, name_key: str) -> PaymentOption | None:
        return self.db.scalars(select(PaymentOption).where(PaymentOption.business_id == self.business_id,
            PaymentOption.name_key == name_key)).first()
