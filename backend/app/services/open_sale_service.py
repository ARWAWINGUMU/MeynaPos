from collections.abc import Generator
from contextlib import contextmanager
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.business_setting import BusinessSetting
from app.models.customer import Customer
from app.models.open_sale import OpenSale, OpenSaleLine, OpenSaleNumber, OpenSaleStatus
from app.models.product import Product
from app.models.role import RoleName
from app.models.sale import DiscountType, Sale
from app.models.user import User
from app.repositories.open_sale_repository import OpenSaleRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.sale_repository import SaleRepository
from app.schemas.open_sale import OpenSaleComplete, OpenSaleCreate, OpenSaleIssue, OpenSaleRead, OpenSaleUpdate, OpenSaleWrite
from app.schemas.sale import SaleCreate, SaleItemCreate
from app.services.sale_service import SaleService
from app.services.setting_service import SettingService
from app.utils.names import next_sale_name, normalize_name


class OpenSaleService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.business_id = SettingService(db).get_or_create_settings().id
        self.repository = OpenSaleRepository(db, self.business_id)
        self.products = ProductRepository(db)
        self.sales = SaleService(db)

    @contextmanager
    def _transaction(self) -> Generator[None, None, None]:
        try:
            yield
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

    def _authorized(self, identifier: str, user: User, *, lock: bool = False) -> OpenSale:
        draft = self.repository.get(identifier, lock=lock)
        if draft is None:
            raise HTTPException(404, "Open sale not found")
        if user.role.name != RoleName.ADMIN and draft.cashier_id != user.id:
            raise HTTPException(403, "You cannot access another cashier's open sale")
        return draft

    @staticmethod
    def _editable(draft: OpenSale, version: int) -> None:
        if draft.status not in {OpenSaleStatus.DRAFT, OpenSaleStatus.HELD}:
            raise HTTPException(409, detail={"code": "SALE_CLOSED", "message": "This open sale is already closed"})
        if draft.version != version:
            raise HTTPException(409, detail={"code": "VERSION_CONFLICT", "message": "The open sale was changed in another window", "current_version": draft.version})

    def list_active(self, user: User) -> list[OpenSaleRead]:
        settings = SettingService(self.db).get_or_create_settings()
        owner_id = None if user.role.name == RoleName.ADMIN else user.id
        return [self._read(draft, settings) for draft in self.repository.list_active(owner_id)]

    def get(self, identifier: str, user: User) -> OpenSaleRead:
        settings = SettingService(self.db).get_or_create_settings()
        return self._read(self._authorized(identifier, user), settings)

    def create(self, payload: OpenSaleCreate, user: User) -> OpenSaleRead:
        settings = SettingService(self.db).get_or_create_settings()
        identifier = str(payload.id)
        existing = self.repository.get(identifier)
        if existing is not None:
            if existing.cashier_id != user.id:
                raise HTTPException(403, "Open sale identifier belongs to another cashier")
            return self._read(existing, settings)
        try:
            with self._transaction():
                self._lock_names()
                existing = self.repository.get(identifier)
                if existing is not None:
                    if existing.cashier_id != user.id:
                        raise HTTPException(403, "Open sale identifier belongs to another cashier")
                    return self._read(existing, settings)
                name = next_sale_name(self._occupied_names())
                number = OpenSaleNumber()
                self.db.add(number)
                self.db.flush()
                draft = OpenSale(id=identifier, cashier=user, currency=settings.currency,
                    tax_percentage=settings.tax_percentage, version=1, number=number.id,
                    business_id=self.business_id, name=name, name_key=normalize_name(name))
                self.db.add(draft)
                self._write(draft, payload)
                self.db.flush()
                return self._read(draft, settings)
        except IntegrityError as error:
            existing = self.repository.get(identifier)
            if existing is not None and existing.cashier_id == user.id:
                return self._read(existing, settings)
            raise HTTPException(409, "The open sale identifier or name is unavailable; retry creation") from error

    def update(self, identifier: str, payload: OpenSaleUpdate, user: User) -> OpenSaleRead:
        settings = SettingService(self.db).get_or_create_settings()
        with self._transaction():
            draft = self._authorized(identifier, user, lock=True)
            self._editable(draft, payload.version)
            self._write(draft, payload)
            self._touch(draft)
            return self._read(draft, settings)

    def rename(self, identifier: str, name: str, version: int, user: User) -> OpenSaleRead:
        settings = SettingService(self.db).get_or_create_settings()
        with self._transaction():
            self._lock_names()
            draft = self._authorized(identifier, user, lock=True)
            self._editable(draft, version)
            name = " ".join(name.split())
            if normalize_name(name) in {normalize_name(value) for value in self._occupied_names(exclude_id=identifier)}:
                raise HTTPException(409, detail={"code": "NAME_CONFLICT", "message": "Another open sale already uses this name"})
            draft.name = name
            draft.name_key = normalize_name(name)
            self._touch(draft)
            return self._read(draft, settings)

    def _lock_names(self) -> None:
        self.db.execute(select(BusinessSetting.id).where(BusinessSetting.id == self.business_id).with_for_update()).scalar_one()

    def _occupied_names(self, exclude_id: str | None = None) -> list[str]:
        query = select(OpenSale.name).where(OpenSale.business_id == self.business_id,
            OpenSale.status.in_([OpenSaleStatus.DRAFT, OpenSaleStatus.HELD]))
        if exclude_id is not None:
            query = query.where(OpenSale.id != exclude_id)
        return list(self.db.scalars(query).all())

    def cancel(self, identifier: str, version: int, user: User) -> OpenSaleRead:
        settings = SettingService(self.db).get_or_create_settings()
        with self._transaction():
            draft = self._authorized(identifier, user, lock=True)
            if draft.status == OpenSaleStatus.CANCELLED:
                return self._read(draft, settings)
            self._editable(draft, version)
            draft.status = OpenSaleStatus.CANCELLED
            draft.cancelled_at = datetime.now(timezone.utc)
            self._touch(draft)
            return self._read(draft, settings)

    def reprice(self, identifier: str, version: int, user: User) -> OpenSaleRead:
        settings = SettingService(self.db).get_or_create_settings()
        with self._transaction():
            draft = self._authorized(identifier, user, lock=True)
            self._editable(draft, version)
            for line in sorted(draft.lines, key=lambda entry: entry.original_product_id):
                product = self.products.get_for_update(line.original_product_id)
                if product is not None:
                    line.product = product
                    line.product_name = product.name
                    line.product_sku = product.sku
                    line.unit_price = product.price
            draft.currency = settings.currency
            draft.tax_percentage = settings.tax_percentage
            self._calculate(draft)
            self._touch(draft)
            return self._read(draft, settings)

    def complete(self, identifier: str, payload: OpenSaleComplete, user: User) -> Sale:
        settings = SettingService(self.db).get_or_create_settings()
        with self._transaction():
            draft = self._authorized(identifier, user, lock=True)
            # The locked draft identifier is the checkout idempotency key.
            if draft.status == OpenSaleStatus.COMPLETED and draft.sale_id is not None:
                sale = SaleRepository(self.db).get(draft.sale_id)
                if sale is None:
                    raise HTTPException(409, "The completed sale is unavailable")
                return sale
            self._editable(draft, payload.version)
            locked_products = {line.original_product_id: self.products.get_for_update(line.original_product_id)
                for line in sorted(draft.lines, key=lambda entry: entry.original_product_id)}
            issues = self._issues(draft, settings, locked_products)
            if issues:
                raise HTTPException(409, detail={"code": "OPEN_SALE_CHANGED", "message": "Review the open sale before payment",
                    "issues": [issue.model_dump(mode="json") for issue in issues]})
            sale = self.sales.create_sale(SaleCreate(customer_id=draft.customer_id,
                items=[SaleItemCreate(product_id=line.original_product_id, quantity=line.quantity) for line in draft.lines],
                payment=payload.payment, discount_type=DiscountType(draft.discount_type), discount_value=draft.discount_value),
                cashier_id=user.id, commit=False)
            draft.status = OpenSaleStatus.COMPLETED
            draft.sale_id = sale.id
            draft.completed_at = datetime.now(timezone.utc)
            self._touch(draft)
            return sale

    def _write(self, draft: OpenSale, payload: OpenSaleWrite) -> None:
        customer = self.db.get(Customer, payload.customer_id) if payload.customer_id else self.db.scalars(
            select(Customer).where(Customer.document_number == "0000000000")).first()
        if customer is None:
            raise HTTPException(422, "A valid customer is required")
        draft.customer = customer
        draft.status = payload.status
        draft.notes = payload.notes
        draft.discount_type = payload.discount_type
        draft.discount_value = payload.discount_value
        existing = {line.original_product_id: line for line in draft.lines}
        lines: list[OpenSaleLine] = []
        for item in payload.items:
            previous = existing.get(item.product_id)
            product = self.products.get(item.product_id)
            if previous is None:
                if product is None or not product.is_active:
                    raise HTTPException(409, "Only active products can be added to an open sale")
                if item.unit_price != product.price:
                    raise HTTPException(409, detail={"code": "PRICE_CHANGED", "message": "Refresh the product price before adding it"})
                previous = OpenSaleLine(original_product_id=product.id, product=product,
                    product_name=product.name, product_sku=product.sku, unit_price=product.price)
            elif item.unit_price != previous.unit_price:
                raise HTTPException(409, "Use the explicit price update action to change saved prices")
            previous.quantity = item.quantity
            lines.append(previous)
        draft.lines = lines
        self._calculate(draft)

    def _calculate(self, draft: OpenSale) -> None:
        draft.subtotal = self.sales._money(sum((line.unit_price * line.quantity for line in draft.lines), Decimal("0.00")))
        draft.tax_amount = self.sales._money(draft.subtotal * draft.tax_percentage / Decimal("100"))
        try:
            draft.discount_amount = self.sales._calculate_discount(discount_type=DiscountType(draft.discount_type),
                discount_value=draft.discount_value, subtotal=draft.subtotal, tax_amount=draft.tax_amount)
            draft.total = self.sales._money(draft.subtotal + draft.tax_amount - draft.discount_amount)
        except HTTPException:
            # Incomplete discounts can be saved, but never charged.
            draft.discount_amount = None
            draft.total = None

    def _touch(self, draft: OpenSale) -> None:
        draft.version += 1
        draft.updated_at = datetime.now(timezone.utc)
        self.db.flush()

    def _issues(self, draft: OpenSale, settings: BusinessSetting, products: dict[int, Product | None] | None = None) -> list[OpenSaleIssue]:
        issues: list[OpenSaleIssue] = []
        if not draft.lines:
            issues.append(OpenSaleIssue(code="EMPTY", message="Add products before payment"))
        if draft.customer is None:
            issues.append(OpenSaleIssue(code="CUSTOMER_MISSING", message="Select a valid customer"))
        if draft.currency != settings.currency:
            issues.append(OpenSaleIssue(code="CURRENCY_CHANGED", message="The business currency changed"))
        if draft.tax_percentage != settings.tax_percentage:
            issues.append(OpenSaleIssue(code="TAX_CHANGED", message="The tax rate changed"))
        if draft.total is None:
            issues.append(OpenSaleIssue(code="INVALID_DISCOUNT", message="Review the discount"))
        for line in draft.lines:
            product = products.get(line.original_product_id) if products is not None else line.product
            common = {"product_id": line.original_product_id}
            if product is None:
                issues.append(OpenSaleIssue(code="PRODUCT_MISSING", message=f"{line.product_name} is no longer available", **common))
                continue
            if not product.is_active:
                issues.append(OpenSaleIssue(code="PRODUCT_INACTIVE", message=f"{line.product_name} is inactive", **common))
            available = product.inventory.quantity if product.inventory else 0
            if product.tracks_inventory and available < line.quantity:
                issues.append(OpenSaleIssue(code="INSUFFICIENT_STOCK", message=f"Insufficient stock for {line.product_name}", available_stock=available, **common))
            if product.price != line.unit_price:
                issues.append(OpenSaleIssue(code="PRICE_CHANGED", message=f"The price of {line.product_name} changed", current_price=product.price, **common))
        return issues

    def _read(self, draft: OpenSale, settings: BusinessSetting) -> OpenSaleRead:
        return OpenSaleRead(id=draft.id, number=draft.number, name=draft.name, cashier_id=draft.cashier_id, cashier_name=draft.cashier.full_name,
            customer_id=draft.customer_id, customer_name=draft.customer.name if draft.customer else None,
            status=draft.status, version=draft.version, currency=draft.currency, tax_percentage=draft.tax_percentage,
            discount_type=draft.discount_type, discount_value=draft.discount_value, subtotal=draft.subtotal,
            tax_amount=draft.tax_amount, discount_amount=draft.discount_amount, total=draft.total, notes=draft.notes,
            sale_id=draft.sale_id, created_at=draft.created_at, updated_at=draft.updated_at,
            lines=draft.lines, issues=self._issues(draft, settings)
                if draft.status in {OpenSaleStatus.DRAFT, OpenSaleStatus.HELD} else [])
