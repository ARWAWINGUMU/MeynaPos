import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.business_setting import BusinessSetting
from app.models.role import Role, RoleName
from app.models.user import User


def test_business_print_preferences_persist(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    initial = client.get("/api/settings", headers=auth_headers).json()
    assert initial["print_preferences"]["format"] == "LETTER"
    assert initial["print_preferences"]["margin"] == 12
    updated = client.put("/api/settings", headers=auth_headers,
        json={"print_preferences": {"format": "THERMAL_58", "margin": 3, "showCustomer": False}})
    assert updated.status_code == 200, updated.text
    db_session.expire_all()
    setting = db_session.get(BusinessSetting, initial["id"])
    assert setting.print_preferences["format"] == "THERMAL_58"
    assert setting.print_preferences["showFooter"] is True
    login = client.post("/api/auth/login", json={"username": "admin@example.com", "password": "Admin123!", "captchaToken": "test-token"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    persisted = client.get("/api/settings", headers=headers).json()
    assert persisted["print_preferences"] == updated.json()["print_preferences"]
    assert persisted["business_name"] == initial["business_name"]


@pytest.mark.parametrize("preferences", [
    {"format": "THERMAL_58", "margin": 9},
    {"format": "THERMAL_80", "margin": 13},
    {"format": "LETTER", "margin": -1},
    {"format": "A4", "margin": 31},
    {"format": "UNSUPPORTED"},
    {"format": []},
    {"showFooter": False},
])
def test_invalid_print_preferences_rejected(client: TestClient, auth_headers: dict[str, str], preferences: dict[str, object]) -> None:
    response = client.put("/api/settings", headers=auth_headers, json={"print_preferences": preferences})
    assert response.status_code == 422, response.text


def test_cashier_can_read_but_cannot_change_business_printer(client: TestClient, db_session: Session, auth_headers: dict[str, str]) -> None:
    client.get("/api/settings", headers=auth_headers)
    role = db_session.scalars(select(Role).where(Role.name == RoleName.CASHIER)).one()
    db_session.add(User(full_name="Printer Cashier", email="printer@example.com",
        hashed_password=hash_password("Cashier123!"), role_id=role.id))
    db_session.commit()
    login = client.post("/api/auth/login", json={"username": "printer@example.com", "password": "Cashier123!", "captchaToken": "test-token"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.get("/api/settings", headers=headers).status_code == 200
    assert client.put("/api/settings", headers=headers, json={"print_preferences": {"format": "A4"}}).status_code == 403


def test_updating_business_preferences_does_not_overwrite_another_record(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    current = client.get("/api/settings", headers=auth_headers).json()
    other = BusinessSetting(business_name="Other Business", tax_id="", address="", phone="", email="", city="",
        currency="COP", tax_percentage=0, print_preferences={"format": "A4", "margin": 12})
    db_session.add(other)
    db_session.commit()
    response = client.put("/api/settings", headers=auth_headers, json={"print_preferences": {"format": "THERMAL_80"}})
    assert response.status_code == 200, response.text
    assert response.json()["id"] == current["id"]
    db_session.refresh(other)
    assert other.print_preferences["format"] == "A4"
