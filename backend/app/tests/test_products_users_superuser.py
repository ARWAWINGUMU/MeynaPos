from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.core.config import get_settings
from app.database.seed import seed_initial_data
from app.models.product import Product
from app.models.purchase import Purchase
from app.models.purchase_detail import PurchaseDetail
from app.models.role import Role, RoleName
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.models.user import User


def _product_payload(name: str, sku: str, barcode: str) -> dict[str, object]:
    return {
        "name": name,
        "description": "Filter product",
        "barcode": barcode,
        "sku": sku,
        "price": "10.00",
        "cost": "5.00",
        "initial_stock": 5,
        "minimum_stock": 1,
    }


def _create_user(db: Session, role_name: RoleName, email: str, password: str = "User123!") -> User:
    role = db.scalars(select(Role).where(Role.name == role_name)).one()
    user = User(
        full_name=email.split("@")[0],
        first_name="Test",
        last_name="User",
        email=email,
        username=email.split("@")[0],
        hashed_password=hash_password(password),
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


def test_product_status_filters_are_explicit(client: TestClient, auth_headers: dict[str, str]) -> None:
    active = client.post("/api/products", json=_product_payload("Active Filter", "ACTIVE-FILTER", "ACTIVE-FILTER"), headers=auth_headers).json()
    inactive = client.post("/api/products", json=_product_payload("Inactive Filter", "INACTIVE-FILTER", "INACTIVE-FILTER"), headers=auth_headers).json()
    client.patch(f"/api/products/{inactive['id']}/deactivate", json={"admin_password": "Admin123!"}, headers=auth_headers)

    active_list = client.get("/api/products", params={"status_filter": "active"}, headers=auth_headers).json()
    inactive_list = client.get("/api/products", params={"status_filter": "inactive"}, headers=auth_headers).json()
    all_list = client.get("/api/products", params={"status_filter": "all"}, headers=auth_headers).json()

    assert active["id"] in {product["id"] for product in active_list}
    assert inactive["id"] not in {product["id"] for product in active_list}
    assert inactive["id"] in {product["id"] for product in inactive_list}
    assert active["id"] not in {product["id"] for product in inactive_list}
    assert {active["id"], inactive["id"]}.issubset({product["id"] for product in all_list})


def test_permanent_product_delete_preserves_sales_and_snapshots(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    product = client.post("/api/products", json=_product_payload("Snapshot Product", "SNAPSHOT-PROD", "SNAPSHOT-PROD"), headers=auth_headers).json()
    sale_response = client.post(
        "/api/sales",
        json={
            "customer_id": 1,
            "items": [{"product_id": product["id"], "quantity": 2}],
            "payment": {"method": "CASH", "amount": "20.00"},
        },
        headers=auth_headers,
    )
    assert sale_response.status_code == 201
    sale_id = sale_response.json()["id"]

    delete_response = client.request("DELETE", f"/api/products/{product['id']}/permanent", json={"admin_password": "Admin123!"}, headers=auth_headers)
    sale_detail = client.get(f"/api/sales/{sale_id}", headers=auth_headers).json()
    all_products = client.get("/api/products", params={"status_filter": "all"}, headers=auth_headers).json()

    assert delete_response.status_code == 200
    assert delete_response.json() == {"action": "permanently_deleted", "product": None, "history_preserved": True}
    assert db_session.get(Product, product["id"]) is None
    assert db_session.get(Sale, sale_id) is not None
    assert product["id"] not in {item["id"] for item in all_products}
    assert sale_detail["details"][0]["product_id"] is None
    assert sale_detail["details"][0]["product_name"] == "Snapshot Product"
    assert Decimal(sale_detail["details"][0]["unit_price"]) == Decimal("10.00")
    assert sale_detail["details"][0]["quantity"] == 2


def test_permanent_product_delete_rejects_purchase_history(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    product = client.post("/api/products", json=_product_payload("Purchase Product", "PURCHASE-PROD", "PURCHASE-PROD"), headers=auth_headers).json()
    purchase = Purchase(supplier_name="Supplier", total=Decimal("5.00"), details=[PurchaseDetail(product_id=product["id"], quantity=1, unit_cost=Decimal("5.00"), line_total=Decimal("5.00"))])
    db_session.add(purchase)
    db_session.commit()

    response = client.request("DELETE", f"/api/products/{product['id']}/permanent", json={"admin_password": "Admin123!"}, headers=auth_headers)

    assert response.status_code == 409
    assert response.json()["detail"]["relation"] == "purchase_details"
    assert db_session.get(Product, product["id"]) is not None


def test_create_users_and_reject_duplicates_or_superuser_assignment(client: TestClient, auth_headers: dict[str, str]) -> None:
    cashier = client.post(
        "/api/users",
        json={"first_name": "Cashier", "last_name": "New", "email": "cashier.new@example.com", "username": "cashier_new", "role": "CASHIER"},
        headers=auth_headers,
    )
    admin = client.post(
        "/api/users",
        json={"first_name": "Admin", "last_name": "Normal", "email": "admin.normal@example.com", "username": "admin_normal", "role": "ADMIN"},
        headers=auth_headers,
    )
    duplicate_email = client.post(
        "/api/users",
        json={"first_name": "Other", "last_name": "User", "email": "cashier.new@example.com", "username": "other_user", "role": "CASHIER"},
        headers=auth_headers,
    )
    duplicate_username = client.post(
        "/api/users",
        json={"first_name": "Other", "last_name": "User", "email": "other@example.com", "username": "cashier_new", "role": "CASHIER"},
        headers=auth_headers,
    )
    superuser_attempt = client.post(
        "/api/users",
        json={"first_name": "Owner", "last_name": "Fake", "email": "owner.fake@example.com", "username": "owner_fake", "role": "ADMIN", "is_superuser": True},
        headers=auth_headers,
    )

    assert cashier.status_code == 201
    assert cashier.json()["is_superuser"] is False
    assert cashier.json()["must_change_password"] is True
    assert "temporary_password" in cashier.json()
    assert admin.status_code == 201
    assert admin.json()["is_superuser"] is False
    assert duplicate_email.status_code == 409
    assert duplicate_email.json()["detail"]["message"] == "El correo ya está registrado."
    assert duplicate_username.status_code == 409
    assert superuser_attempt.status_code == 422


def test_seed_creates_initial_superuser(db_session: Session, monkeypatch) -> None:
    monkeypatch.setenv("INITIAL_ADMIN_EMAIL", "owner.seed@example.com")
    monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", "OwnerSeed123!")
    monkeypatch.setenv("INITIAL_ADMIN_NAME", "Owner Seed")
    get_settings.cache_clear()
    db_session.query(User).delete()
    db_session.commit()

    seed_initial_data(db_session)

    owner = db_session.scalars(select(User).where(User.is_superuser.is_(True))).one()
    assert owner.role.name == RoleName.ADMIN
    assert owner.is_active is True
    assert owner.must_change_password is True


def test_normal_admin_cannot_modify_superuser(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    owner = db_session.scalars(select(User).where(User.email == "admin@example.com")).one()
    owner.is_superuser = True
    normal_admin = _create_user(db_session, RoleName.ADMIN, "normal.admin@example.com")
    db_session.commit()
    normal_headers = _login(client, normal_admin.email, "User123!")

    edit = client.put(
        f"/api/users/{owner.id}",
        json={"first_name": "Changed", "last_name": "Owner", "email": owner.email, "username": owner.username or "admin", "role": "ADMIN"},
        headers=normal_headers,
    )
    deactivate = client.patch(f"/api/users/{owner.id}/deactivate", json={"admin_password": "User123!"}, headers=normal_headers)
    reset = client.patch(f"/api/users/{owner.id}/password", json={"admin_password": "User123!"}, headers=normal_headers)

    assert edit.status_code == 403
    assert deactivate.status_code == 403
    assert reset.status_code == 403


def test_superuser_can_change_own_password(client: TestClient, db_session: Session) -> None:
    owner = db_session.scalars(select(User).where(User.email == "admin@example.com")).one()
    owner.is_superuser = True
    db_session.commit()
    headers = _login(client, owner.email, "Admin123!")

    response = client.post(
        "/api/auth/change-password",
        json={"current_password": "Admin123!", "new_password": "NewAdmin123!", "confirm_password": "NewAdmin123!"},
        headers=headers,
    )

    assert response.status_code == 200
