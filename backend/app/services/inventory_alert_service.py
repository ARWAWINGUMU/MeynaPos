from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.inventory_alert import InventoryAlert, InventoryAlertStatus
from app.models.product import Product
from app.repositories.inventory_alert_repository import InventoryAlertRepository


class InventoryAlertService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.alerts = InventoryAlertRepository(db)

    def list_active(self) -> list[InventoryAlert]:
        return self.alerts.list_active()

    def purge_expired(self) -> None:
        self.alerts.delete_expired(datetime.now(timezone.utc) - timedelta(days=15))
        self.db.commit()

    def mark_as_read(self, alert_id: int, *, read: bool = True) -> InventoryAlert:
        self.purge_expired()
        alert = self.alerts.get(alert_id)
        if alert is None or not alert.active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory alert not found")
        alert.read = read
        self.db.commit()
        self.db.refresh(alert)
        return alert

    def sync_product(self, product: Product, *, commit: bool = True) -> InventoryAlert | None:
        active_alert = self.alerts.get_active_by_product(product.id)
        target_status = self._status_for_product(product)
        previous_status = product.inventory.notification_status if product.inventory else None
        if product.inventory:
            product.inventory.notification_status = target_status
        now = datetime.now(timezone.utc)

        if target_status is None:
            if active_alert is not None:
                active_alert.active = False
                active_alert.resolved_at = now
                active_alert.quantity = product.inventory.quantity if product.inventory else active_alert.quantity
                active_alert.minimum_stock = product.inventory.minimum_stock if product.inventory else active_alert.minimum_stock
                if commit:
                    self.db.commit()
            elif commit:
                self.db.commit()
            return None

        quantity = product.inventory.quantity
        minimum_stock = product.inventory.minimum_stock

        if active_alert is None:
            # Expiring a notification must not start another episode for unchanged stock.
            if previous_status == target_status:
                if commit:
                    self.db.commit()
                return None
            active_alert = InventoryAlert(
                product_id=product.id,
                status=target_status,
                quantity=quantity,
                minimum_stock=minimum_stock,
                active=True,
                read=False,
            )
            self.alerts.add(active_alert)
        else:
            if active_alert.status != target_status:
                active_alert.status = target_status
                active_alert.read = False
            active_alert.quantity = quantity
            active_alert.minimum_stock = minimum_stock

        if commit:
            self.db.commit()
            self.db.refresh(active_alert)
        return active_alert

    @staticmethod
    def _status_for_product(product: Product) -> InventoryAlertStatus | None:
        if not product.is_active or not product.tracks_inventory or product.inventory is None:
            return None
        if product.inventory.quantity <= 0:
            return InventoryAlertStatus.OUT_OF_STOCK
        if product.inventory.quantity <= product.inventory.minimum_stock:
            return InventoryAlertStatus.LOW_STOCK
        return None
