from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate


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
