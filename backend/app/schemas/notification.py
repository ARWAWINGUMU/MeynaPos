from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.inventory_alert import InventoryAlertStatus


class InventoryAlertRead(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: int
    minimum_stock: int
    status: InventoryAlertStatus
    active: bool
    read: bool
    detected_at: datetime
    updated_at: datetime
    resolved_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
