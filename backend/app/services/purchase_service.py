from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.purchase import Purchase
from app.models.purchase_detail import PurchaseDetail
from app.repositories.product_repository import ProductRepository
from app.schemas.purchase import PurchaseCreate


class PurchaseService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.products = ProductRepository(db)

    def create(self, payload: PurchaseCreate) -> Purchase:
        total = Decimal("0.00")
        details: list[PurchaseDetail] = []
        for item in payload.items:
            product = self.products.get(item.product_id)
            if product is None or product.inventory is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {item.product_id} not found")
            line_total = item.unit_cost * item.quantity
            product.cost = item.unit_cost
            product.inventory.quantity += item.quantity
            total += line_total
            details.append(PurchaseDetail(product_id=item.product_id, quantity=item.quantity, unit_cost=item.unit_cost, line_total=line_total))
        purchase = Purchase(supplier_name=payload.supplier_name, total=total, details=details)
        self.db.add(purchase)
        self.db.commit()
        self.db.refresh(purchase)
        return purchase

    def list(self) -> list[Purchase]:
        statement = select(Purchase).options(joinedload(Purchase.details)).order_by(Purchase.created_at.desc())
        return list(self.db.scalars(statement).unique().all())

