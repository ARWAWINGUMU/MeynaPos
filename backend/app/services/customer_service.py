from __future__ import annotations

from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.customer import Customer
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.schemas.customer import CustomerCreate, CustomerSaleHistoryItem, CustomerSaleProduct, CustomerSummary, CustomerUpdate


class CustomerService:
    DEFAULT_DOCUMENT_NUMBER = "0000000000"

    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self, search: str | None = None) -> list[Customer]:
        statement = select(Customer).order_by(Customer.name)
        if search:
            term = f"%{search}%"
            statement = statement.where(
                or_(
                    Customer.name.ilike(term),
                    Customer.email.ilike(term),
                    Customer.phone.ilike(term),
                    Customer.document_number.ilike(term),
                )
            )
        return list(self.db.scalars(statement).all())

    def list_summary(self, search: str | None = None) -> list[CustomerSummary]:
        sales_summary = (
            select(
                Sale.customer_id.label("customer_id"),
                func.count(Sale.id).label("purchase_count"),
                func.coalesce(func.sum(Sale.total), 0).label("total_purchased"),
                func.max(Sale.created_at).label("last_purchase_at"),
            )
            .group_by(Sale.customer_id)
            .subquery()
        )
        statement = (
            select(
                Customer,
                func.coalesce(sales_summary.c.purchase_count, 0),
                func.coalesce(sales_summary.c.total_purchased, 0),
                sales_summary.c.last_purchase_at,
            )
            .outerjoin(sales_summary, sales_summary.c.customer_id == Customer.id)
            .order_by(Customer.name)
        )
        if search:
            term = f"%{search}%"
            statement = statement.where(
                or_(
                    Customer.name.ilike(term),
                    Customer.email.ilike(term),
                    Customer.phone.ilike(term),
                    Customer.document_number.ilike(term),
                )
            )
        rows = self.db.execute(statement).all()
        return [
            CustomerSummary(
                id=customer.id,
                name=customer.name,
                document_number=customer.document_number,
                phone=customer.phone,
                email=customer.email,
                address=customer.address,
                purchase_count=int(purchase_count),
                total_purchased=Decimal(total_purchased),
                last_purchase_at=last_purchase_at,
            )
            for customer, purchase_count, total_purchased, last_purchase_at in rows
        ]

    def history(self, customer_id: int) -> list[CustomerSaleHistoryItem]:
        if self.db.get(Customer, customer_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        statement = (
            select(Sale)
            .where(Sale.customer_id == customer_id)
            .options(
                selectinload(Sale.cashier),
                selectinload(Sale.payment),
                selectinload(Sale.details).selectinload(SaleDetail.product),
            )
            .order_by(Sale.created_at.desc())
        )
        sales = self.db.scalars(statement).all()
        return [
            CustomerSaleHistoryItem(
                id=sale.id,
                sale_number=sale.invoice_number,
                date=sale.created_at,
                cashier=sale.cashier.full_name if sale.cashier else "N/A",
                products=[
                    CustomerSaleProduct(
                        product_id=detail.product_id,
                        name=detail.product.name if detail.product else f"Product {detail.product_id}",
                        quantity=detail.quantity,
                        unit_price=detail.unit_price,
                        line_total=detail.line_total,
                    )
                    for detail in sale.details
                ],
                subtotal=sale.subtotal,
                tax=sale.tax_amount,
                discount=sale.discount_amount,
                total=sale.total,
                payment_method=sale.payment.method if sale.payment else None,
                status="PAGADA",
            )
            for sale in sales
        ]

    def get_default_customer(self) -> Customer:
        customer = self.db.scalars(select(Customer).where(Customer.document_number == self.DEFAULT_DOCUMENT_NUMBER)).first()
        if customer is not None:
            return customer
        customer = Customer(
            name="Cliente Predeterminado",
            document_number=self.DEFAULT_DOCUMENT_NUMBER,
            phone="N/A",
            email="N/A",
            address="N/A",
        )
        self.db.add(customer)
        self.db.commit()
        self.db.refresh(customer)
        return customer

    def create(self, payload: CustomerCreate) -> Customer:
        customer = Customer(**payload.model_dump())
        self.db.add(customer)
        self.db.commit()
        self.db.refresh(customer)
        return customer

    def update(self, customer_id: int, payload: CustomerUpdate) -> Customer:
        customer = self.db.get(Customer, customer_id)
        if customer is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        for field, value in payload.model_dump().items():
            setattr(customer, field, value)
        self.db.commit()
        self.db.refresh(customer)
        return customer
