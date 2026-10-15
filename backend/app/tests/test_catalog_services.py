from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory import Inventory
from app.models.inventory_alert import InventoryAlert


def create_article(client: TestClient, headers: dict[str, str], kind: str, sku: str) -> dict:
    response = client.post("/api/products", headers=headers, json={"name": f"Article {sku}", "sku": sku,
        "article_type": kind, "price": "10.00", "cost": "0.00", "initial_stock": 5, "minimum_stock": 1})
    assert response.status_code == 201, response.text
    return response.json()


def test_mixed_sale_only_decrements_physical_stock(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    product = create_article(client, auth_headers, "PRODUCT", "PHYSICAL")
    service = create_article(client, auth_headers, "SERVICE", "CONSULTING")
    assert service["inventory"] is None
    response = client.post("/api/sales", headers=auth_headers, json={"customer_id": 1,
        "items": [{"product_id": product["id"], "quantity": 2}, {"product_id": service["id"], "quantity": 10}],
        "discount_type": "PERCENTAGE", "discount_value": "10", "payment": {"method": "CASH", "amount": "108.00"}})
    assert response.status_code == 201, response.text
    assert response.json()["total"] == "108.00"
    assert len(response.json()["details"]) == 2
    assert db_session.scalar(select(Inventory.quantity).where(Inventory.product_id == product["id"])) == 3
    assert db_session.scalar(select(Inventory).where(Inventory.product_id == service["id"])) is None
    assert db_session.scalar(select(InventoryAlert).where(InventoryAlert.product_id == service["id"])) is None
    assert all(item["product_id"] != service["id"] for item in client.get("/api/reports/inventory", headers=auth_headers).json())


def test_service_open_sale_completes_without_stock(client: TestClient, auth_headers: dict[str, str]) -> None:
    service = create_article(client, auth_headers, "SERVICE", "REPAIR")
    response = client.post("/api/open-sales", headers=auth_headers, json={"items": [
        {"product_id": service["id"], "quantity": 20, "unit_price": service["price"]}]})
    assert response.status_code == 201, response.text
    saved = response.json()
    assert saved["issues"] == []
    result = client.post(f"/api/open-sales/{saved['id']}/complete", headers=auth_headers,
        json={"version": saved["version"], "payment": {"method": "CASH", "amount": "200.00"}})
    assert result.status_code == 200, result.text
    assert result.json()["details"][0]["quantity"] == 20


def test_converting_to_service_resolves_alert_and_preserves_stock(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    product = create_article(client, auth_headers, "PRODUCT", "CONVERT")
    client.put(f"/api/products/{product['id']}", headers=auth_headers, json={"quantity": 1})
    assert client.get("/api/notifications/inventory-alerts", headers=auth_headers).json()
    converted = client.put(f"/api/products/{product['id']}", headers=auth_headers, json={"article_type": "SERVICE"})
    assert converted.status_code == 200, converted.text
    assert client.get("/api/notifications/inventory-alerts", headers=auth_headers).json() == []
    assert db_session.scalar(select(Inventory.quantity).where(Inventory.product_id == product["id"])) == 1
    assert client.patch(f"/api/inventory/{product['id']}", headers=auth_headers, json={"quantity": 10}).status_code == 422
    reverted = client.put(f"/api/products/{product['id']}", headers=auth_headers, json={"article_type": "PRODUCT"})
    assert reverted.status_code == 200
    assert reverted.json()["inventory"]["quantity"] == 1


def test_invalid_article_type_is_rejected(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post("/api/products", headers=auth_headers, json={"name": "Invalid", "sku": "INVALID", "price": "10", "cost": "0", "article_type": "UNKNOWN"})
    assert response.status_code == 422
