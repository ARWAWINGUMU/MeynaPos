from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_access_token, hash_password, verify_password
from app.models.role import Role, RoleName
from app.models.user import User


def test_create_cashier_sets_temporary_password(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/api/users",
        json={
            "first_name": "Caja",
            "last_name": "Uno",
            "email": "cashier.temp@example.com",
            "username": "cashier_temp",
            "role": "CASHIER",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["must_change_password"] is True
    assert body["temporary_password"]
    assert body["temporary_password_expires_at"]

    user = db_session.scalars(select(User).where(User.email == "cashier.temp@example.com")).one()
    assert user.hashed_password != body["temporary_password"]
    assert verify_password(body["temporary_password"], user.hashed_password)


def test_login_with_valid_temporary_password_returns_limited_token(client: TestClient, auth_headers: dict[str, str]) -> None:
    created = client.post(
        "/api/users",
        json={
            "first_name": "Caja",
            "last_name": "Dos",
            "email": "cashier.limited@example.com",
            "username": "cashier_limited",
            "role": "CASHIER",
        },
        headers=auth_headers,
    ).json()

    login_response = client.post(
        "/api/auth/login",
        json={"username": "cashier.limited@example.com", "password": created["temporary_password"], "captchaToken": "test-token"},
    )

    assert login_response.status_code == 200
    body = login_response.json()
    payload = decode_access_token(body["access_token"])
    assert body["must_change_password"] is True
    assert payload["password_change_required"] is True
    assert payload["token_version"] == created["token_version"]


def test_limited_token_cannot_access_functional_endpoints(client: TestClient, auth_headers: dict[str, str]) -> None:
    created = client.post(
        "/api/users",
        json={
            "first_name": "Caja",
            "last_name": "Tres",
            "email": "cashier.blocked@example.com",
            "username": "cashier_blocked",
            "role": "CASHIER",
        },
        headers=auth_headers,
    ).json()
    login_response = client.post(
        "/api/auth/login",
        json={"username": "cashier.blocked@example.com", "password": created["temporary_password"], "captchaToken": "test-token"},
    )
    limited_headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

    response = client.get("/api/products", headers=limited_headers)

    assert response.status_code == 403


def test_required_password_change_success_and_new_login(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    created = client.post(
        "/api/users",
        json={
            "first_name": "Caja",
            "last_name": "Cuatro",
            "email": "cashier.change@example.com",
            "username": "cashier_change",
            "role": "CASHIER",
        },
        headers=auth_headers,
    ).json()
    login_response = client.post(
        "/api/auth/login",
        json={"username": "cashier.change@example.com", "password": created["temporary_password"], "captchaToken": "test-token"},
    )
    limited_headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

    change_response = client.post(
        "/api/auth/change-required-password",
        json={
            "current_password": created["temporary_password"],
            "new_password": "NewSecure123!",
            "confirm_password": "NewSecure123!",
        },
        headers=limited_headers,
    )

    assert change_response.status_code == 200
    user = db_session.scalars(select(User).where(User.email == "cashier.change@example.com")).one()
    assert user.must_change_password is False
    assert user.temporary_password_expires_at is None
    assert user.password_changed_at is not None
    assert user.token_version == created["token_version"] + 1

    login_with_new_password = client.post(
        "/api/auth/login",
        json={"username": "cashier.change@example.com", "password": "NewSecure123!", "captchaToken": "test-token"},
    )
    assert login_with_new_password.status_code == 200
    assert login_with_new_password.json()["must_change_password"] is False


def test_expired_temporary_password_cannot_login(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    created = client.post(
        "/api/users",
        json={
            "first_name": "Caja",
            "last_name": "Cinco",
            "email": "cashier.expired@example.com",
            "username": "cashier_expired",
            "role": "CASHIER",
        },
        headers=auth_headers,
    ).json()
    user = db_session.scalars(select(User).where(User.email == "cashier.expired@example.com")).one()
    user.temporary_password_expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    db_session.commit()

    response = client.post(
        "/api/auth/login",
        json={"username": "cashier.expired@example.com", "password": created["temporary_password"], "captchaToken": "test-token"},
    )

    assert response.status_code == 403
    assert response.json()["detail"]["temporary_password_expired"] is True


def test_admin_reset_requires_admin_password_and_invalidates_old_token(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    created = client.post(
        "/api/users",
        json={
            "first_name": "Caja",
            "last_name": "Seis",
            "email": "cashier.reset@example.com",
            "username": "cashier_reset",
            "role": "CASHIER",
        },
        headers=auth_headers,
    ).json()
    login_response = client.post(
        "/api/auth/login",
        json={"username": "cashier.reset@example.com", "password": created["temporary_password"], "captchaToken": "test-token"},
    )
    old_headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

    denied = client.patch(
        f"/api/users/{created['id']}/password",
        json={"admin_password": "wrong"},
        headers=auth_headers,
    )
    assert denied.status_code == 403

    reset = client.patch(
        f"/api/users/{created['id']}/password",
        json={"admin_password": "Admin123!"},
        headers=auth_headers,
    )
    assert reset.status_code == 200
    assert reset.json()["temporary_password"] != created["temporary_password"]

    old_token_response = client.get("/api/products", headers=old_headers)
    user = db_session.get(User, created["id"])
    assert old_token_response.status_code == 401
    assert user is not None
    assert user.token_version == created["token_version"] + 1


def test_cashier_cannot_reset_password(client: TestClient, db_session: Session) -> None:
    cashier_role = db_session.scalars(select(Role).where(Role.name == RoleName.CASHIER)).one()
    cashier = User(
        full_name="Normal Cashier",
        first_name="Normal",
        last_name="Cashier",
        email="normal.cashier@example.com",
        username="normal_cashier",
        hashed_password=hash_password("Cashier123!"),
        role_id=cashier_role.id,
    )
    db_session.add(cashier)
    db_session.commit()

    login_response = client.post(
        "/api/auth/login",
        json={"username": "normal.cashier@example.com", "password": "Cashier123!", "captchaToken": "test-token"},
    )
    headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

    response = client.patch("/api/users/1/password", json={"admin_password": "Cashier123!"}, headers=headers)

    assert response.status_code == 403


def test_required_password_change_rejects_same_or_weak_password(client: TestClient, auth_headers: dict[str, str]) -> None:
    created = client.post(
        "/api/users",
        json={
            "first_name": "Caja",
            "last_name": "Siete",
            "email": "cashier.weak@example.com",
            "username": "cashier_weak",
            "role": "CASHIER",
        },
        headers=auth_headers,
    ).json()
    login_response = client.post(
        "/api/auth/login",
        json={"username": "cashier.weak@example.com", "password": created["temporary_password"], "captchaToken": "test-token"},
    )
    headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

    same_response = client.post(
        "/api/auth/change-required-password",
        json={
            "current_password": created["temporary_password"],
            "new_password": created["temporary_password"],
            "confirm_password": created["temporary_password"],
        },
        headers=headers,
    )
    weak_response = client.post(
        "/api/auth/change-required-password",
        json={
            "current_password": created["temporary_password"],
            "new_password": "weakpass",
            "confirm_password": "weakpass",
        },
        headers=headers,
    )

    assert same_response.status_code == 400
    assert weak_response.status_code == 400
