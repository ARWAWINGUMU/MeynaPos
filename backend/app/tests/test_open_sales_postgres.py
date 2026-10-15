"""Run with OPEN_SALES_POSTGRES_URL set; every test owns an isolated schema."""

import os
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.schema import CreateSchema, DropSchema

from app.core.security import hash_password
from app.database.session import Base
from app.models.business_setting import BusinessSetting
from app.models.customer import Customer
from app.models.inventory import Inventory
from app.models.open_sale import OpenSale
from app.models.payment import Payment
from app.models.product import Product
from app.models.role import Role, RoleName
from app.models.sale import Sale
from app.models.user import User
from app.schemas.open_sale import OpenSaleComplete, OpenSaleCreate, OpenSaleUpdate
from app.schemas.sale import SaleCreate
from app.services.open_sale_service import OpenSaleService
from app.services.sale_service import SaleService

pytestmark = pytest.mark.skipif(not os.getenv("OPEN_SALES_POSTGRES_URL"), reason="An explicit PostgreSQL test connection is required")


@pytest.fixture()
def postgres_workspace():
    url = os.environ["OPEN_SALES_POSTGRES_URL"]
    namespace = f"test_open_sales_{uuid4().hex}"
    control = create_engine(url)
    with control.begin() as connection:
        connection.execute(CreateSchema(namespace))
    engine = create_engine(url, connect_args={"options": f"-csearch_path={namespace} -clock_timeout=10000 -cstatement_timeout=30000"})
    factory = sessionmaker(bind=engine, autoflush=False)
    try:
        Base.metadata.create_all(engine)
        with factory() as db:
            role = Role(name=RoleName.ADMIN)
            user = User(full_name="Concurrency Admin", email="concurrency@example.com", hashed_password=hash_password("Test1234!"), role=role)
            item = Product(name="Concurrent Product", sku="PG-OPEN", price=Decimal("10.00"), cost=Decimal("5.00"),
                inventory=Inventory(quantity=5, minimum_stock=1))
            db.add_all([user, item, Customer(name="Default", document_number="0000000000"),
                BusinessSetting(business_name="Test", tax_id="", address="", city="", phone="", email="", currency="COP", tax_percentage=0)])
            db.commit()
            identifiers = (user.id, item.id)
        yield factory, identifiers
    finally:
        engine.dispose()
        with control.begin() as connection:
            connection.execute(DropSchema(namespace, cascade=True))
        control.dispose()


def create_held(factory: sessionmaker[Session], ids: tuple[int, int], quantity: int = 3):
    with factory() as db:
        user = db.get(User, ids[0])
        return OpenSaleService(db).create(OpenSaleCreate(status="HELD", notes="Survives service restart",
            items=[{"product_id": ids[1], "quantity": quantity, "unit_price": "10.00"}]), user)


def test_parallel_creation_assigns_unique_default_numbers(postgres_workspace) -> None:
    factory, ids = postgres_workspace
    barrier = Barrier(4)

    def create() -> tuple[int, str]:
        with factory() as db:
            user = db.get(User, ids[0])
            barrier.wait(timeout=15)
            saved = OpenSaleService(db).create(OpenSaleCreate(), user)
            return saved.number, saved.name

    with ThreadPoolExecutor(max_workers=4) as workers:
        results = list(workers.map(lambda _: create(), range(4)))
    assert len({number for number, _ in results}) == 4
    assert all(name == f"Venta {number}" for number, name in results)


def checkout(factory: sessionmaker[Session], ids: tuple[int, int], saved, barrier: Barrier):
    with factory() as db:
        user = db.get(User, ids[0])
        barrier.wait(timeout=15)
        try:
            result = OpenSaleService(db).complete(saved.id, OpenSaleComplete(version=saved.version,
                payment={"method": "CASH", "amount": "100.00"}), user)
            return result.id
        except HTTPException as error:
            return error.status_code * -1


def test_parallel_checkout_of_same_draft_creates_one_sale(postgres_workspace) -> None:
    factory, ids = postgres_workspace
    saved = create_held(factory, ids)
    barrier = Barrier(2)
    with ThreadPoolExecutor(max_workers=2) as workers:
        results = list(workers.map(lambda _: checkout(factory, ids, saved, barrier), range(2)))
    assert results[0] == results[1] and results[0] > 0
    with factory() as db:
        assert db.scalar(select(func.count(Sale.id))) == 1
        assert db.scalar(select(func.count(Payment.id))) == 1
        assert db.scalar(select(Inventory.quantity)) == 2


def test_parallel_sales_cannot_consume_the_same_stock(postgres_workspace) -> None:
    factory, ids = postgres_workspace
    first = create_held(factory, ids)
    second = create_held(factory, ids)
    barrier = Barrier(2)
    with ThreadPoolExecutor(max_workers=2) as workers:
        futures = [workers.submit(checkout, factory, ids, item, barrier) for item in (first, second)]
        results = [future.result(timeout=30) for future in futures]
    assert sum(result > 0 for result in results) == 1 and -409 in results
    with factory() as db:
        assert db.scalar(select(Inventory.quantity)) == 2
        assert db.scalar(select(func.count(Sale.id))) == 1


def test_parallel_edits_reject_a_stale_version(postgres_workspace) -> None:
    factory, ids = postgres_workspace
    saved = create_held(factory, ids)
    barrier = Barrier(2)

    def edit(quantity: int) -> int:
        with factory() as db:
            user = db.get(User, ids[0])
            barrier.wait(timeout=15)
            try:
                return OpenSaleService(db).update(saved.id, OpenSaleUpdate(version=saved.version,
                    items=[{"product_id": ids[1], "quantity": quantity, "unit_price": "10.00"}]), user).version
            except HTTPException as error:
                return -error.status_code

    with ThreadPoolExecutor(max_workers=2) as workers:
        results = list(workers.map(edit, (1, 2)))
    assert sorted(results) == [-409, saved.version + 1]
    with factory() as db:
        assert db.get(OpenSale, saved.id).version == saved.version + 1
        assert db.scalar(select(Inventory.quantity)) == 5


def test_held_sale_survives_connection_pool_and_service_restart(postgres_workspace) -> None:
    factory, ids = postgres_workspace
    saved = create_held(factory, ids)
    factory.kw["bind"].dispose()
    with factory() as db:
        recovered = OpenSaleService(db).get(saved.id, db.get(User, ids[0]))
        assert recovered.notes == "Survives service restart"
        assert recovered.lines[0].quantity == 3 and recovered.total == Decimal("30.00")
        assert db.scalar(select(Inventory.quantity)) == 5


def test_direct_and_held_checkout_share_atomic_stock_validation(postgres_workspace) -> None:
    factory, ids = postgres_workspace
    saved = create_held(factory, ids)
    barrier = Barrier(2)

    def direct_checkout() -> int:
        with factory() as db:
            user = db.get(User, ids[0])
            customer_id = db.scalar(select(Customer.id))
            barrier.wait(timeout=15)
            try:
                return SaleService(db).create_sale(SaleCreate(customer_id=customer_id,
                    items=[{"product_id": ids[1], "quantity": 4}], payment={"method": "CASH", "amount": "40.00"}), user.id).id
            except HTTPException as error:
                return -error.status_code

    with ThreadPoolExecutor(max_workers=2) as workers:
        pending = [workers.submit(checkout, factory, ids, saved, barrier), workers.submit(direct_checkout)]
        results = [future.result(timeout=30) for future in pending]
    assert sum(result > 0 for result in results) == 1 and -409 in results
    with factory() as db:
        assert db.scalar(select(Inventory.quantity)) in (1, 2)
        assert db.scalar(select(func.count(Payment.id))) == 1
