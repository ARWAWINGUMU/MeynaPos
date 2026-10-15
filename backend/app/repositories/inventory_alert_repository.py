from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from app.models.inventory_alert import InventoryAlert
from app.models.product import Product


class InventoryAlertRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_active_by_product(self, product_id: int) -> InventoryAlert | None:
        statement = (
            select(InventoryAlert)
            .options(joinedload(InventoryAlert.product).joinedload(Product.inventory))
            .where(InventoryAlert.product_id == product_id, InventoryAlert.active.is_(True))
            .order_by(InventoryAlert.updated_at.desc())
        )
        return self.db.scalars(statement).first()

    def list_active(self) -> list[InventoryAlert]:
        statement = (
            select(InventoryAlert)
            .join(InventoryAlert.product)
            .options(joinedload(InventoryAlert.product))
            .where(InventoryAlert.active.is_(True), Product.is_active.is_(True),
                   InventoryAlert.detected_at > datetime.now(timezone.utc) - timedelta(days=15))
            .order_by(InventoryAlert.read.asc(), InventoryAlert.updated_at.desc())
        )
        return list(self.db.scalars(statement).unique().all())

    def get(self, alert_id: int) -> InventoryAlert | None:
        statement = (
            select(InventoryAlert)
            .options(joinedload(InventoryAlert.product).joinedload(Product.inventory))
            .where(InventoryAlert.id == alert_id)
        )
        return self.db.scalars(statement).first()

    def add(self, alert: InventoryAlert) -> InventoryAlert:
        self.db.add(alert)
        return alert

    def delete_expired(self, cutoff: datetime) -> None:
        self.db.execute(delete(InventoryAlert).where(InventoryAlert.detected_at <= cutoff))
