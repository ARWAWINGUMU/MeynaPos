from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.customer import Customer
from app.models.payment import Payment, PaymentMethod
from app.models.product import Product
from app.models.role import Role, RoleName
from app.models.sale import DiscountType, Sale
from app.models.sale_detail import SaleDetail
from app.models.user import User


def _product_payload(name: str, sku: str, barcode: str, category_id: int | None = None) -> dict[str, object]:
    return {
        "name": name,
        "description": "Test product",
        "barcode": barcode,
        "sku": sku,
        "price": "10.00",
        "cost": "5.00",
        "category_id": category_id,
        "initial_stock": 5,
        "minimum_stock": 1,
    }


def _create_cashier(db: Session) -> User:
    role = db.scalars(select(Role).where(Role.name == RoleName.CASHIER)).one()
    user = User(
        full_name="Cashier UX",
        first_name="Cashier",
        last_name="UX",
        email="cashier.ux@example.com",
        username="cashier_ux",
        hashed_password=hash_password("Cashier123!"),
        role_id=role.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": email, "password": password, "captchaToken": "test-token"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _create_sale(db: Session, cashier_id: int, product_id: int, invoice: str, created_at: datetime) -> Sale:
    customer = db.scalars(select(Customer).where(Customer.document_number == "0000000000")).one()
    sale = Sale(
        invoice_number=invoice,
        cashier_id=cashier_id,
        customer_id=customer.id,
        subtotal=Decimal("10.00"),
        tax_percentage=Decimal("0.00"),
        tax_amount=Decimal("0.00"),
        tax=Decimal("0.00"),
        discount_type=DiscountType.NONE,
        discount_value=Decimal("0.00"),
        discount_amount=Decimal("0.00"),
        total=Decimal("10.00"),
        created_at=created_at,
        details=[SaleDetail(product_id=product_id, quantity=1, unit_price=Decimal("10.00"), line_total=Decimal("10.00"))],
        payment=Payment(method=PaymentMethod.CASH, amount=Decimal("10.00")),
    )
    db.add(sale)
    db.commit()
    db.refresh(sale)
    return sale


def test_remove_product_without_history_deletes_physically(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    created = client.post("/api/products", json=_product_payload("No History", "NO-HIST", "NO-HIST-001"), headers=auth_headers).json()

    response = client.post(f"/api/products/{created['id']}/remove", json={"admin_password": "Admin123!"}, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["action"] == "deleted"
    assert db_session.get(Product, created["id"]) is None


def test_remove_product_with_sales_deactivates_and_preserves_history(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    created = client.post("/api/products", json=_product_payload("With History", "WITH-HIST", "WITH-HIST-001"), headers=auth_headers).json()
    admin = db_session.scalars(select(User).where(User.email == "admin@example.com")).one()
    _create_sale(db_session, admin.id, created["id"], "INV-PROD-HIST", datetime.now(timezone.utc))

    response = client.post(f"/api/products/{created['id']}/remove", json={"admin_password": "Admin123!"}, headers=auth_headers)
    active_list = client.get("/api/products", headers=auth_headers)
    inactive_list = client.get("/api/products", params={"status_filter": "inactive"}, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["action"] == "deactivated"
    assert db_session.get(Product, created["id"]) is not None
    assert all(product["id"] != created["id"] for product in active_list.json())
    assert any(product["id"] == created["id"] for product in inactive_list.json())
    assert db_session.scalars(select(SaleDetail).where(SaleDetail.product_id == created["id"])).first() is not None


def test_reactivate_product_returns_to_active_list(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    created = client.post("/api/products", json=_product_payload("Reactivate Product", "REACT-PROD", "REACT-001"), headers=auth_headers).json()
    admin = db_session.scalars(select(User).where(User.email == "admin@example.com")).one()
    _create_sale(db_session, admin.id, created["id"], "INV-REACTIVATE", datetime.now(timezone.utc))
    client.post(f"/api/products/{created['id']}/remove", json={"admin_password": "Admin123!"}, headers=auth_headers)

    response = client.patch(f"/api/products/{created['id']}/reactivate", headers=auth_headers)
    active_list = client.get("/api/products", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["is_active"] is True
    assert any(product["id"] == created["id"] for product in active_list.json())


def test_wrong_admin_password_does_not_remove_product(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    created = client.post("/api/products", json=_product_payload("Protected Product", "PROTECTED", "PROTECTED-001"), headers=auth_headers).json()

    response = client.post(f"/api/products/{created['id']}/remove", json={"admin_password": "wrong"}, headers=auth_headers)

    assert response.status_code == 403
    assert db_session.get(Product, created["id"]) is not None


def test_cashier_cannot_remove_product(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    created = client.post("/api/products", json=_product_payload("Cashier Protected", "CASH-PROT", "CASH-PROT-001"), headers=auth_headers).json()
    cashier = _create_cashier(db_session)
    cashier_headers = _login(client, cashier.email, "Cashier123!")

    response = client.post(f"/api/products/{created['id']}/remove", json={"admin_password": "Cashier123!"}, headers=cashier_headers)

    assert response.status_code == 403


def test_delete_empty_category_and_reject_category_with_products(client: TestClient, auth_headers: dict[str, str]) -> None:
    empty_category = client.post("/api/categories", json={"name": "Empty UX"}, headers=auth_headers).json()
    used_category = client.post("/api/categories", json={"name": "Used UX"}, headers=auth_headers).json()
    client.post("/api/products", json=_product_payload("Categorized", "CAT-PROD", "CAT-PROD-001", used_category["id"]), headers=auth_headers)

    empty_delete = client.delete(f"/api/categories/{empty_category['id']}", headers=auth_headers)
    used_delete = client.delete(f"/api/categories/{used_category['id']}", headers=auth_headers)
    categories = client.get("/api/categories", params={"include_inactive": True}, headers=auth_headers).json()

    assert empty_delete.status_code == 200
    assert used_delete.status_code == 409
    assert any(category["id"] == used_category["id"] and category["product_count"] == 1 for category in categories)


def test_sales_report_pagination_and_order(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    product = client.post("/api/products", json=_product_payload("Report Product", "REP-PROD", "REP-PROD-001"), headers=auth_headers).json()
    admin = db_session.scalars(select(User).where(User.email == "admin@example.com")).one()
    now = datetime.now(timezone.utc)
    _create_sale(db_session, admin.id, product["id"], "INV-OLD", now - timedelta(days=2))
    _create_sale(db_session, admin.id, product["id"], "INV-NEW", now)
    _create_sale(db_session, admin.id, product["id"], "INV-MID", now - timedelta(days=1))

    first_page = client.get("/api/reports/sales", params={"page": 1, "page_size": 2}, headers=auth_headers)
    second_page = client.get("/api/reports/sales", params={"page": 2, "page_size": 2}, headers=auth_headers)
    out_of_range = client.get("/api/reports/sales", params={"page": 99, "page_size": 2}, headers=auth_headers)

    assert first_page.status_code == 200
    assert first_page.json()["total"] == 3
    assert first_page.json()["total_pages"] == 2
    assert [item["sale_number"] for item in first_page.json()["items"]] == ["INV-NEW", "INV-MID"]
    assert [item["sale_number"] for item in second_page.json()["items"]] == ["INV-OLD"]
    assert out_of_range.status_code == 200
    assert out_of_range.json()["items"] == []


def test_invalid_sales_report_page_size_is_rejected(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.get("/api/reports/sales", params={"page": 1, "page_size": 1000}, headers=auth_headers)

    assert response.status_code == 422
