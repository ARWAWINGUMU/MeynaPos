from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.role import Role, RoleName
from app.models.sale import DiscountType, Sale
from app.models.user import User


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


def test_admin_deactivates_cashier_and_invalidates_token(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    cashier = _create_user(db_session, RoleName.CASHIER, "cashier.deactivate@example.com")
    cashier_headers = _login(client, cashier.email, "User123!")

    response = client.patch(f"/api/users/{cashier.id}/deactivate", json={"admin_password": "Admin123!"}, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["is_active"] is False
    db_session.refresh(cashier)
    assert cashier.token_version == 1
    assert client.get("/api/products", headers=cashier_headers).status_code == 401
    assert client.post("/api/auth/login", json={"username": cashier.email, "password": "User123!", "captchaToken": "test-token"}).status_code == 403


def test_admin_reactivates_cashier(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    cashier = _create_user(db_session, RoleName.CASHIER, "cashier.reactivate@example.com")
    cashier.is_active = False
    db_session.commit()

    response = client.patch(f"/api/users/{cashier.id}/reactivate", json={"admin_password": "Admin123!"}, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["is_active"] is True
    assert client.post("/api/auth/login", json={"username": cashier.email, "password": "User123!", "captchaToken": "test-token"}).status_code == 200


def test_cashier_cannot_deactivate_users(client: TestClient, db_session: Session) -> None:
    cashier = _create_user(db_session, RoleName.CASHIER, "cashier.noadmin@example.com")
    target = _create_user(db_session, RoleName.CASHIER, "cashier.target@example.com")
    cashier_headers = _login(client, cashier.email, "User123!")

    response = client.patch(f"/api/users/{target.id}/deactivate", json={"admin_password": "User123!"}, headers=cashier_headers)

    assert response.status_code == 403


def test_admin_cannot_deactivate_or_delete_self(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    admin = db_session.scalars(select(User).where(User.email == "admin@example.com")).one()

    deactivate_response = client.patch(f"/api/users/{admin.id}/deactivate", json={"admin_password": "Admin123!"}, headers=auth_headers)
    delete_response = client.request("DELETE", f"/api/users/{admin.id}", json={"admin_password": "Admin123!"}, headers=auth_headers)

    assert deactivate_response.status_code == 403
    assert delete_response.status_code == 403


def test_cannot_deactivate_last_active_admin(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    admin = db_session.scalars(select(User).where(User.email == "admin@example.com")).one()
    other_admin = _create_user(db_session, RoleName.ADMIN, "admin.inactive@example.com")
    other_admin.is_active = False
    db_session.commit()

    response = client.patch(f"/api/users/{admin.id}/deactivate", json={"admin_password": "Admin123!"}, headers=auth_headers)

    assert response.status_code == 403
    assert response.json()["detail"]["message"] == "No puede desactivarse a sí mismo."


def test_admin_can_deactivate_another_admin_if_one_remains(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    other_admin = _create_user(db_session, RoleName.ADMIN, "admin.other@example.com")

    response = client.patch(f"/api/users/{other_admin.id}/deactivate", json={"admin_password": "Admin123!"}, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["is_active"] is False


def test_cannot_delete_admin_or_cashier_with_sales(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    admin = db_session.scalars(select(User).where(User.email == "admin@example.com")).one()
    other_admin = _create_user(db_session, RoleName.ADMIN, "admin.delete@example.com")
    cashier = _create_user(db_session, RoleName.CASHIER, "cashier.history@example.com")
    db_session.add(
        Sale(
            invoice_number="INV-HISTORY-001",
            cashier_id=cashier.id,
            subtotal=Decimal("10.00"),
            tax_percentage=Decimal("0.00"),
            tax_amount=Decimal("0.00"),
            tax=Decimal("0.00"),
            discount_type=DiscountType.NONE,
            discount_value=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            total=Decimal("10.00"),
        )
    )
    db_session.commit()

    admin_delete = client.request("DELETE", f"/api/users/{admin.id}", json={"admin_password": "Admin123!"}, headers=auth_headers)
    other_admin_delete = client.request("DELETE", f"/api/users/{other_admin.id}", json={"admin_password": "Admin123!"}, headers=auth_headers)
    cashier_delete = client.request("DELETE", f"/api/users/{cashier.id}", json={"admin_password": "Admin123!"}, headers=auth_headers)

    assert admin_delete.status_code == 403
    assert other_admin_delete.status_code == 403
    assert cashier_delete.status_code == 409
    assert db_session.scalars(select(Sale).where(Sale.cashier_id == cashier.id)).first() is not None


def test_can_delete_cashier_without_history(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    cashier = _create_user(db_session, RoleName.CASHIER, "cashier.delete@example.com")
    cashier_id = cashier.id

    response = client.request("DELETE", f"/api/users/{cashier_id}", json={"admin_password": "Admin123!"}, headers=auth_headers)

    assert response.status_code == 200
    assert db_session.get(User, cashier_id) is None


def test_wrong_admin_password_rejects_sensitive_action(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    cashier = _create_user(db_session, RoleName.CASHIER, "cashier.wrongpass@example.com")

    response = client.patch(f"/api/users/{cashier.id}/deactivate", json={"admin_password": "wrong"}, headers=auth_headers)

    assert response.status_code == 403
    db_session.refresh(cashier)
    assert cashier.is_active is True
