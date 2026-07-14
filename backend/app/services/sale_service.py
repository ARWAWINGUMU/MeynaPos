from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.payment import Payment
from app.models.sale import DiscountType, Sale
from app.models.sale_detail import SaleDetail
from app.repositories.product_repository import ProductRepository
from app.repositories.sale_repository import SaleRepository
from app.schemas.sale import SaleCreate
from app.services.setting_service import SettingService


class SaleService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.products = ProductRepository(db)
        self.sales = SaleRepository(db)

    def create_sale(self, payload: SaleCreate, cashier_id: int) -> Sale:
        subtotal = Decimal("0.00")
        details: list[SaleDetail] = []
        customer = self.db.get(Customer, payload.customer_id)
        if customer is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A valid customer is required to create a sale")

        for item in payload.items:
            product = self.products.get(item.product_id)
            if product is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {item.product_id} not found")
            if product.inventory is None or product.inventory.quantity < item.quantity:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Insufficient stock for {product.name}")
            line_total = product.price * item.quantity
            subtotal += line_total
            product.inventory.quantity -= item.quantity
            details.append(
                SaleDetail(
                    product_id=product.id,
                    quantity=item.quantity,
                    unit_price=product.price,
                    line_total=line_total,
                )
            )

        settings = SettingService(self.db).get_or_create_settings()
        tax_percentage = Decimal(settings.tax_percentage)
        tax_amount = self._money(subtotal * tax_percentage / Decimal("100"))
        discount_amount = self._calculate_discount(
            discount_type=payload.discount_type,
            discount_value=payload.discount_value,
            subtotal=subtotal,
            tax_amount=tax_amount,
        )
        discount_value = Decimal("0.00") if payload.discount_type == DiscountType.NONE else self._money(payload.discount_value)
        total = self._money(subtotal + tax_amount - discount_amount)
        if payload.payment.amount < total:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment amount is lower than sale total")

        sale = Sale(
            invoice_number=self._next_invoice_number(),
            cashier_id=cashier_id,
            customer_id=payload.customer_id,
            subtotal=subtotal,
            tax_percentage=tax_percentage,
            tax_amount=tax_amount,
            tax=tax_amount,
            discount_type=payload.discount_type,
            discount_value=discount_value,
            discount_amount=discount_amount,
            total=total,
            details=details,
            payment=Payment(
                method=payload.payment.method,
                amount=payload.payment.amount,
                reference=payload.payment.reference,
            ),
        )
        return self.sales.add(sale)

    def list_sales(self) -> list[Sale]:
        return self.sales.list()

    @staticmethod
    def _next_invoice_number() -> str:
        return f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"

    @staticmethod
    def _money(value: Decimal) -> Decimal:
        return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def _calculate_discount(
        self,
        *,
        discount_type: DiscountType,
        discount_value: Decimal,
        subtotal: Decimal,
        tax_amount: Decimal,
    ) -> Decimal:
        value = self._money(discount_value)
        taxable_total = self._money(subtotal + tax_amount)

        if discount_type == DiscountType.NONE:
            return Decimal("0.00")

        if discount_type == DiscountType.FIXED:
            if value <= 0:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Fixed discount must be greater than zero")
            if value > taxable_total:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Fixed discount cannot exceed sale total before discount")
            return value

        if discount_type == DiscountType.PERCENTAGE:
            if value <= 0 or value > Decimal("100.00"):
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Percentage discount must be greater than zero and less than or equal to 100")
            return self._money(taxable_total * value / Decimal("100"))

        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported discount type")
