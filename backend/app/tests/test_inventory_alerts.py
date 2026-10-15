from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.inventory_alert import InventoryAlert
from app.models.role import Role, RoleName
from app.models.user import User
from app.services.inventory_alert_service import InventoryAlertService


def _create_product(client: TestClient, auth_headers: dict[str, str], name: str, barcode: str, sku: str, stock: int, minimum: int) -> dict:
    response = client.post(
        "/api/products",
        json={
            "name": name,
            "barcode": barcode,
            "sku": sku,
            "price": "10.00",
            "cost": "5.00",
            "initial_stock": stock,
            "minimum_stock": minimum,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _sell(client: TestClient, auth_headers: dict[str, str], product_id: int, quantity: int, amount: str) -> None:
    response = client.post(
        "/api/sales",
        json={
            "customer_id": 1,
            "items": [{"product_id": product_id, "quantity": quantity}],
            "payment": {"method": "CASH", "amount": amount},
        },
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text


def _alerts(client: TestClient, auth_headers: dict[str, str]) -> list[dict]:
    response = client.get("/api/notifications/inventory-alerts", headers=auth_headers)
    assert response.status_code == 200, response.text
    return response.json()


def _cashier_headers(client: TestClient, db_session: Session) -> dict[str, str]:
    cashier_role = db_session.query(Role).filter(Role.name == RoleName.CASHIER).one()
    db_session.add(
        User(
            full_name="Test Cashier",
            email="cashier@example.com",
            hashed_password=hash_password("Cashier123!"),
            role_id=cashier_role.id,
        )
    )
    db_session.commit()
    response = client.post("/api/auth/login", json={"username": "cashier@example.com", "password": "Cashier123!", "captchaToken": "test-token"})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_product_with_normal_stock_does_not_create_alert(client: TestClient, auth_headers: dict[str, str]) -> None:
    _create_product(client, auth_headers, "Normal Stock", "ALERT-001", "ALERT-001", 10, 3)

    assert _alerts(client, auth_headers) == []


def test_product_reaching_low_stock_creates_alert(client: TestClient, auth_headers: dict[str, str]) -> None:
    product = _create_product(client, auth_headers, "Low Threshold", "ALERT-002", "ALERT-002", 6, 5)

    _sell(client, auth_headers, product["id"], 1, "10.00")

    alerts = _alerts(client, auth_headers)
    assert len(alerts) == 1
    assert alerts[0]["product_id"] == product["id"]
    assert alerts[0]["status"] == "LOW_STOCK"
    assert alerts[0]["quantity"] == 5
    assert alerts[0]["minimum_stock"] == 5


def test_out_of_stock_product_creates_critical_alert(client: TestClient, auth_headers: dict[str, str]) -> None:
    product = _create_product(client, auth_headers, "Empty Product", "ALERT-003", "ALERT-003", 0, 2)

    alerts = _alerts(client, auth_headers)
    assert len(alerts) == 1
    assert alerts[0]["product_id"] == product["id"]
    assert alerts[0]["status"] == "OUT_OF_STOCK"
    assert alerts[0]["quantity"] == 0


def test_low_stock_to_out_of_stock_updates_existing_alert(client: TestClient, auth_headers: dict[str, str]) -> None:
    product = _create_product(client, auth_headers, "Low To Empty", "ALERT-004", "ALERT-004", 1, 2)
    first_alert = _alerts(client, auth_headers)[0]

    _sell(client, auth_headers, product["id"], 1, "10.00")

    alerts = _alerts(client, auth_headers)
    assert len(alerts) == 1
    assert alerts[0]["id"] == first_alert["id"]
    assert alerts[0]["status"] == "OUT_OF_STOCK"
    assert alerts[0]["read"] is False


def test_repeated_sales_while_low_stock_do_not_duplicate_alert(client: TestClient, auth_headers: dict[str, str]) -> None:
    product = _create_product(client, auth_headers, "Still Low", "ALERT-005", "ALERT-005", 6, 5)

    _sell(client, auth_headers, product["id"], 1, "10.00")
    first_alert = _alerts(client, auth_headers)[0]
    _sell(client, auth_headers, product["id"], 1, "10.00")

    alerts = _alerts(client, auth_headers)
    assert len(alerts) == 1
    assert alerts[0]["id"] == first_alert["id"]
    assert alerts[0]["quantity"] == 4


def test_replenished_product_resolves_alert(client: TestClient, auth_headers: dict[str, str]) -> None:
    product = _create_product(client, auth_headers, "Replenished", "ALERT-006", "ALERT-006", 1, 3)
    assert len(_alerts(client, auth_headers)) == 1

    response = client.patch(f"/api/inventory/{product['id']}", json={"quantity": 8}, headers=auth_headers)

    assert response.status_code == 200, response.text
    assert _alerts(client, auth_headers) == []


def test_product_can_generate_new_alert_after_resolution(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    product = _create_product(client, auth_headers, "Falls Again", "ALERT-007", "ALERT-007", 1, 3)
    first_alert_id = _alerts(client, auth_headers)[0]["id"]
    response = client.patch(f"/api/inventory/{product['id']}", json={"quantity": 8}, headers=auth_headers)
    assert response.status_code == 200, response.text

    _sell(client, auth_headers, product["id"], 5, "50.00")

    alerts = _alerts(client, auth_headers)
    assert len(alerts) == 1
    assert alerts[0]["id"] != first_alert_id
    assert db_session.query(InventoryAlert).filter(InventoryAlert.product_id == product["id"]).count() == 2


def test_mark_as_read_keeps_active_stock_condition(client: TestClient, auth_headers: dict[str, str]) -> None:
    _create_product(client, auth_headers, "Read Active", "ALERT-008", "ALERT-008", 1, 3)
    alert = _alerts(client, auth_headers)[0]

    response = client.patch(f"/api/notifications/inventory-alerts/{alert['id']}/read", headers=auth_headers)

    assert response.status_code == 200, response.text
    assert response.json()["read"] is True
    alerts = _alerts(client, auth_headers)
    assert len(alerts) == 1
    assert alerts[0]["active"] is True
    assert alerts[0]["read"] is True


def test_cashier_cannot_access_inventory_alerts(client: TestClient, db_session: Session) -> None:
    cashier_headers = _cashier_headers(client, db_session)

    response = client.get("/api/notifications/inventory-alerts", headers=cashier_headers)

    assert response.status_code == 403


def test_persisted_alerts_are_available_after_session_refresh(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    product = _create_product(client, auth_headers, "Persistent Alert", "ALERT-009", "ALERT-009", 1, 3)
    db_session.expire_all()

    alerts = _alerts(client, auth_headers)

    assert len(alerts) == 1
    assert alerts[0]["product_id"] == product["id"]
    assert alerts[0]["active"] is True


def test_alert_can_be_marked_unread(client: TestClient, auth_headers: dict[str, str]) -> None:
    _create_product(client, auth_headers, "Unread Again", "ALERT-010", "ALERT-010", 1, 3)
    alert = _alerts(client, auth_headers)[0]
    url = f"/api/notifications/inventory-alerts/{alert['id']}/read"
    assert client.patch(url, headers=auth_headers).json()["read"] is True
    response = client.patch(url, params={"read": False}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["read"] is False
    assert response.json()["active"] is True


def test_expiration_does_not_recreate_unchanged_condition(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    product = _create_product(client, auth_headers, "Expired Alert", "ALERT-011", "ALERT-011", 3, 5)
    alert = db_session.query(InventoryAlert).one()
    alert.detected_at = datetime.now(timezone.utc) - timedelta(days=16)
    db_session.commit()

    assert _alerts(client, auth_headers) == []
    InventoryAlertService(db_session).purge_expired()
    assert db_session.query(InventoryAlert).count() == 0
    _sell(client, auth_headers, product["id"], 1, "10.00")
    assert _alerts(client, auth_headers) == []

    _sell(client, auth_headers, product["id"], 2, "20.00")
    assert _alerts(client, auth_headers)[0]["status"] == "OUT_OF_STOCK"


def test_cleanup_preserves_recent_and_deletes_resolved_notifications(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    old_product = _create_product(client, auth_headers, "Old Resolved", "ALERT-012", "ALERT-012", 1, 3)
    old_alert = db_session.query(InventoryAlert).one()
    old_alert.detected_at = datetime.now(timezone.utc) - timedelta(days=16)
    db_session.commit()
    client.patch(f"/api/inventory/{old_product['id']}", json={"quantity": 8}, headers=auth_headers)
    recent_product = _create_product(client, auth_headers, "Recent", "ALERT-013", "ALERT-013", 1, 3)

    InventoryAlertService(db_session).purge_expired()

    remaining = db_session.query(InventoryAlert).all()
    assert len(remaining) == 1
    assert remaining[0].product_id == recent_product["id"]
    client.patch(f"/api/inventory/{old_product['id']}", json={"quantity": 1}, headers=auth_headers)
    assert len(_alerts(client, auth_headers)) == 2


def test_cashier_cannot_change_read_state(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    _create_product(client, auth_headers, "Protected Alert", "ALERT-014", "ALERT-014", 1, 3)
    alert = _alerts(client, auth_headers)[0]
    response = client.patch(
        f"/api/notifications/inventory-alerts/{alert['id']}/read",
        params={"read": False}, headers=_cashier_headers(client, db_session),
    )
    assert response.status_code == 403


def test_conditional_alert_request_changes_after_stock_update(client: TestClient, auth_headers: dict[str, str]) -> None:
    product = _create_product(client, auth_headers, "Conditional", "ALERT-015", "ALERT-015", 2, 3)
    url = "/api/notifications/inventory-alerts"
    initial = client.get(url, headers=auth_headers)
    headers = {**auth_headers, "If-None-Match": initial.headers["etag"]}
    unchanged = client.get(url, headers=headers)
    assert unchanged.status_code == 304
    assert unchanged.content == b""
    _sell(client, auth_headers, product["id"], 1, "10.00")
    changed = client.get(url, headers=headers)
    assert changed.status_code == 200
    assert changed.headers["etag"] != initial.headers["etag"]
    assert changed.json()[0]["quantity"] == 1
