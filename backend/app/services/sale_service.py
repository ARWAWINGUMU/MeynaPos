from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.inventory import Inventory
from app.models.payment import Payment
from app.models.sale import DiscountType, Sale
from app.models.sale_detail import SaleDetail
from app.repositories.product_repository import ProductRepository
from app.repositories.sale_repository import SaleRepository
from app.schemas.sale import SaleCreate
from app.services.inventory_alert_service import InventoryAlertService
from app.services.setting_service import SettingService
from app.services.payment_option_service import PaymentOptionService


class SaleService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.products = ProductRepository(db)
        self.sales = SaleRepository(db)

    def create_sale(self, payload: SaleCreate, cashier_id: int, *, commit: bool = True) -> Sale:
        try:
            return self._create_sale(payload, cashier_id, commit=commit)
        except Exception:
            self.db.rollback()
            raise

    def _create_sale(self, payload: SaleCreate, cashier_id: int, *, commit: bool) -> Sale:
        settings = SettingService(self.db).get_or_create_settings()
        payment_method, payment_method_id, payment_method_name = PaymentOptionService(self.db).resolve(payload.payment)
        subtotal = Decimal("0.00")
        details: list[SaleDetail] = []
        impacted_products = []
        customer = self.db.get(Customer, payload.customer_id)
        if customer is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A valid customer is required to create a sale")

        quantities: dict[int, int] = {}
        for item in payload.items:
            quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity
        for product_id, quantity in sorted(quantities.items()):
            product = self.products.get_for_update(product_id)
            if product is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {product_id} not found")
            if not product.is_active:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Product {product.name} is inactive")
            if product.tracks_inventory:
                if product.inventory is None or product.inventory.quantity < quantity:
                    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Insufficient stock for {product.name}")
                remaining = self.db.scalar(update(Inventory).where(Inventory.product_id == product.id, Inventory.quantity >= quantity)
                    .values(quantity=Inventory.quantity - quantity).returning(Inventory.quantity))
                if remaining is None:
                    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Insufficient stock for {product.name}")
                product.inventory.quantity = remaining
                impacted_products.append(product)
            line_total = product.price * quantity
            subtotal += line_total
            details.append(
                SaleDetail(
                    product_id=product.id,
                    product_name=product.name,
                    product_sku=product.sku,
                    product_barcode=product.barcode or product.qr_code,
                    quantity=quantity,
                    unit_price=product.price,
                    line_total=line_total,
                )
            )

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
                method=payment_method,
                method_id=payment_method_id,
                method_name=payment_method_name,
                amount=payload.payment.amount,
                reference=payload.payment.reference,
            ),
        )
        alert_service = InventoryAlertService(self.db)
        for product in impacted_products:
            alert_service.sync_product(product, commit=False)
        return self.sales.add(sale, commit=commit)

    def list_sales(self) -> list[Sale]:
        return self.sales.list()

    def get_sale(self, sale_id: int) -> Sale:
        sale = self.sales.get(sale_id)
        if sale is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
        return sale

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
