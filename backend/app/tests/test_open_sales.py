from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.inventory import Inventory
from app.models.open_sale import OpenSale
from app.models.payment import Payment
from app.models.role import Role, RoleName
from app.models.sale import Sale
from app.models.user import User


def product(client: TestClient, headers: dict[str, str], *, stock: int = 5, code: str = "OPEN-001") -> dict:
    response = client.post("/api/products", headers=headers, json={"name": f"Product {code}", "sku": code,
        "barcode": code, "price": "10.00", "cost": "5.00", "initial_stock": stock, "minimum_stock": 1})
    assert response.status_code == 201, response.text
    return response.json()


def draft(client: TestClient, headers: dict[str, str], item: dict, *, quantity: int = 3, identifier: str | None = None) -> dict:
    response = client.post("/api/open-sales", headers=headers, json={"id": identifier or str(uuid4()), "status": "HELD",
        "items": [{"product_id": item["id"], "quantity": quantity, "unit_price": item["price"]}],
        "notes": "Customer is arranging payment"})
    assert response.status_code == 201, response.text
    return response.json()


def update_payload(saved: dict, *, quantity: int = 1) -> dict:
    return {"version": saved["version"], "status": "DRAFT", "customer_id": saved["customer_id"],
        "items": [{"product_id": line["original_product_id"], "quantity": quantity, "unit_price": line["unit_price"]} for line in saved["lines"]],
        "discount_type": saved["discount_type"], "discount_value": saved["discount_value"], "notes": saved["notes"]}


def complete(client: TestClient, headers: dict[str, str], saved: dict, *, amount: str = "100.00"):
    return client.post(f"/api/open-sales/{saved['id']}/complete", headers=headers,
        json={"version": saved["version"], "payment": {"method": "CASH", "amount": amount}})


def cashier(client: TestClient, db: Session, name: str) -> dict[str, str]:
    role = db.scalars(select(Role).where(Role.name == RoleName.CASHIER)).one()
    db.add(User(full_name=name, email=f"{name}@example.com", hashed_password=hash_password("Cashier123!"), role_id=role.id))
    db.commit()
    response = client.post("/api/auth/login", json={"username": f"{name}@example.com", "password": "Cashier123!", "captchaToken": "test-token"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_hold_persists_without_financial_or_inventory_effects(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    item = product(client, auth_headers)
    saved = draft(client, auth_headers, item)
    assert saved["status"] == "HELD" and saved["total"] == "30.00"
    assert db_session.scalar(select(Inventory.quantity).where(Inventory.product_id == item["id"])) == 5
    assert db_session.scalar(select(func.count(Sale.id))) == 0
    assert db_session.scalar(select(func.count(Payment.id))) == 0
    report = client.get("/api/reports/sales", headers=auth_headers).json()
    assert report["total"] == 0 and report["items"] == []


def test_open_sale_names_persist_and_reject_normalized_duplicates(client: TestClient, auth_headers: dict[str, str]) -> None:
    item = product(client, auth_headers)
    first = draft(client, auth_headers, item)
    second = draft(client, auth_headers, item)
    assert first["number"] != second["number"]
    assert first["name"] == f"Venta {first['number']}"
    for saved in (first,):
        url = f"/api/open-sales/{saved['id']}/name"
        assert client.patch(url, headers=auth_headers, json={"version": saved["version"], "name": "   "}).status_code == 422
        renamed = client.patch(url, headers=auth_headers, json={"version": saved["version"], "name": " Mesa 4 "})
        assert renamed.status_code == 200, renamed.text
        assert renamed.json()["name"] == "Mesa 4"
        assert client.get(f"/api/open-sales/{saved['id']}", headers=auth_headers).json()["name"] == "Mesa 4"
        assert client.patch(url, headers=auth_headers, json={"version": saved["version"], "name": "Stale"}).status_code == 409
    duplicate = client.patch(f"/api/open-sales/{second['id']}/name", headers=auth_headers,
        json={"version": second["version"], "name": " mesa   4 "})
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"]["code"] == "NAME_CONFLICT"
    reused = draft(client, auth_headers, item)
    assert reused["name"] == "Venta 1"
    assert reused["number"] != first["number"] and reused["id"] != first["id"]


def test_cancelled_and_completed_names_are_reusable(client: TestClient, auth_headers: dict[str, str]) -> None:
    item = product(client, auth_headers, stock=20)
    first = draft(client, auth_headers, item, quantity=1)
    assert complete(client, auth_headers, first).status_code == 200
    second = draft(client, auth_headers, item, quantity=1)
    assert second["name"] == "Venta 1"
    assert client.post(f"/api/open-sales/{second['id']}/cancel", headers=auth_headers,
        json={"version": second["version"]}).status_code == 200
    third = draft(client, auth_headers, item, quantity=1)
    assert third["name"] == "Venta 1"
    assert len({first["number"], second["number"], third["number"]}) == 3


def test_multiple_open_sales_remain_independent_after_reload(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    first_product = product(client, auth_headers)
    second_product = product(client, auth_headers, code="OPEN-002")
    first = draft(client, auth_headers, first_product, quantity=2)
    second = draft(client, auth_headers, second_product, quantity=1)
    payload = update_payload(first, quantity=4)
    payload.update(discount_type="PERCENTAGE", discount_value="10", notes="Only first sale")
    assert client.put(f"/api/open-sales/{first['id']}", headers=auth_headers, json=payload).status_code == 200
    db_session.expire_all()
    a = client.get(f"/api/open-sales/{first['id']}", headers=auth_headers).json()
    b = client.get(f"/api/open-sales/{second['id']}", headers=auth_headers).json()
    assert a["lines"][0]["quantity"] == 4 and a["total"] == "36.00"
    assert b["lines"][0]["original_product_id"] == second_product["id"]
    assert b["lines"][0]["quantity"] == 1 and b["discount_type"] == "NONE"
    assert b["notes"] != a["notes"]
    assert len(client.get("/api/open-sales", headers=auth_headers).json()) == 2


def test_checkout_is_idempotent_and_decrements_stock_once(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    item = product(client, auth_headers)
    saved = draft(client, auth_headers, item)
    first = complete(client, auth_headers, saved)
    second = complete(client, auth_headers, saved)
    assert first.status_code == second.status_code == 200, first.text
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["total"] == "30.00"
    assert db_session.scalar(select(Inventory.quantity).where(Inventory.product_id == item["id"])) == 2
    assert db_session.scalar(select(func.count(Sale.id))) == 1
    assert db_session.scalar(select(func.count(Payment.id))) == 1
    completed = client.get(f"/api/open-sales/{saved['id']}", headers=auth_headers).json()
    assert completed["status"] == "COMPLETED" and completed["sale_id"] == first.json()["id"]
    assert client.get("/api/open-sales", headers=auth_headers).json() == []
    assert client.put(f"/api/open-sales/{saved['id']}", headers=auth_headers, json=update_payload(saved)).status_code == 409


def test_cancellation_is_persistent_and_never_creates_a_sale(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    item = product(client, auth_headers)
    saved = draft(client, auth_headers, item)
    response = client.post(f"/api/open-sales/{saved['id']}/cancel", headers=auth_headers, json={"version": saved["version"]})
    assert response.status_code == 200 and response.json()["status"] == "CANCELLED"
    db_session.expire_all()
    assert db_session.get(OpenSale, saved["id"]).status == "CANCELLED"
    assert complete(client, auth_headers, saved).status_code == 409
    assert db_session.scalar(select(Inventory.quantity).where(Inventory.product_id == item["id"])) == 5
    assert db_session.scalar(select(func.count(Sale.id))) == 0


def test_stock_is_rechecked_after_another_customer_pays(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    item = product(client, auth_headers)
    a = draft(client, auth_headers, item, quantity=3)
    b = draft(client, auth_headers, item, quantity=4)
    assert complete(client, auth_headers, b).status_code == 200
    recovered = client.get(f"/api/open-sales/{a['id']}", headers=auth_headers).json()
    assert "INSUFFICIENT_STOCK" in [issue["code"] for issue in recovered["issues"]]
    assert complete(client, auth_headers, a).status_code == 409
    assert db_session.scalar(select(Inventory.quantity).where(Inventory.product_id == item["id"])) == 1


def test_price_change_requires_explicit_acceptance(client: TestClient, auth_headers: dict[str, str]) -> None:
    item = product(client, auth_headers)
    saved = draft(client, auth_headers, item, quantity=1)
    client.put(f"/api/products/{item['id']}", headers=auth_headers, json={"price": "15.00"})
    recovered = client.get(f"/api/open-sales/{saved['id']}", headers=auth_headers).json()
    assert recovered["lines"][0]["unit_price"] == "10.00" and recovered["total"] == "10.00"
    assert "PRICE_CHANGED" in [issue["code"] for issue in recovered["issues"]]
    assert complete(client, auth_headers, saved).status_code == 409
    accepted = client.post(f"/api/open-sales/{saved['id']}/reprice", headers=auth_headers, json={"version": saved["version"]})
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["total"] == "15.00"
    assert complete(client, auth_headers, accepted.json()).json()["total"] == "15.00"


def test_inactive_product_blocks_payment(client: TestClient, auth_headers: dict[str, str]) -> None:
    item = product(client, auth_headers)
    saved = draft(client, auth_headers, item)
    client.put(f"/api/products/{item['id']}", headers=auth_headers, json={"is_active": False})
    response = complete(client, auth_headers, saved)
    assert response.status_code == 409
    assert "PRODUCT_INACTIVE" in [issue["code"] for issue in response.json()["detail"]["issues"]]


def test_stale_updates_do_not_overwrite_another_window(client: TestClient, auth_headers: dict[str, str]) -> None:
    saved = draft(client, auth_headers, product(client, auth_headers))
    first = client.put(f"/api/open-sales/{saved['id']}", headers=auth_headers, json=update_payload(saved, quantity=2))
    second = client.put(f"/api/open-sales/{saved['id']}", headers=auth_headers, json=update_payload(saved, quantity=4))
    assert first.status_code == 200 and second.status_code == 409
    assert second.json()["detail"]["code"] == "VERSION_CONFLICT"
    assert client.get(f"/api/open-sales/{saved['id']}", headers=auth_headers).json()["lines"][0]["quantity"] == 2


def test_cashiers_only_access_their_own_sales(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    item = product(client, auth_headers)
    first_headers = cashier(client, db_session, "first.cashier")
    other_headers = cashier(client, db_session, "other.cashier")
    saved = draft(client, first_headers, item)
    assert len(client.get("/api/open-sales", headers=first_headers).json()) == 1
    assert client.get("/api/open-sales", headers=other_headers).json() == []
    assert client.get(f"/api/open-sales/{saved['id']}", headers=other_headers).status_code == 403
    assert client.put(f"/api/open-sales/{saved['id']}", headers=other_headers, json=update_payload(saved)).status_code == 403
    assert complete(client, other_headers, saved).status_code == 403
    assert client.post(f"/api/open-sales/{saved['id']}/cancel", headers=other_headers, json={"version": 1}).status_code == 403
    assert client.get(f"/api/open-sales/{saved['id']}", headers=auth_headers).status_code == 200


def test_invalid_discount_is_saved_but_cannot_be_charged(client: TestClient, auth_headers: dict[str, str]) -> None:
    saved = draft(client, auth_headers, product(client, auth_headers), quantity=1)
    payload = update_payload(saved)
    payload.update(discount_type="FIXED", discount_value="999")
    updated = client.put(f"/api/open-sales/{saved['id']}", headers=auth_headers, json=payload).json()
    assert updated["total"] is None
    assert complete(client, auth_headers, updated).status_code == 409


def test_failed_payment_rolls_back_all_effects(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    item = product(client, auth_headers)
    saved = draft(client, auth_headers, item)
    response = complete(client, auth_headers, saved, amount="1.00")
    assert response.status_code == 400, response.text
    db_session.expire_all()
    assert db_session.get(OpenSale, saved["id"]).status == "HELD"
    assert db_session.scalar(select(Inventory.quantity).where(Inventory.product_id == item["id"])) == 5
    assert db_session.scalar(select(func.count(Payment.id))) == 0


def test_creation_retry_uses_the_same_identifier(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    item = product(client, auth_headers)
    identifier = str(uuid4())
    first = draft(client, auth_headers, item, identifier=identifier)
    second = draft(client, auth_headers, item, identifier=identifier)
    assert first["id"] == second["id"]
    assert db_session.scalar(select(func.count(OpenSale.id))) == 1


def test_currency_and_tax_changes_require_review(client: TestClient, auth_headers: dict[str, str]) -> None:
    saved = draft(client, auth_headers, product(client, auth_headers), quantity=1)
    client.put("/api/settings", headers=auth_headers, json={"currency": "USD", "tax_percentage": "19"})
    response = complete(client, auth_headers, saved)
    assert response.status_code == 409
    codes = {issue["code"] for issue in response.json()["detail"]["issues"]}
    assert {"CURRENCY_CHANGED", "TAX_CHANGED"} <= codes


def test_direct_sale_cannot_oversell_duplicate_lines(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    item = product(client, auth_headers)
    response = client.post("/api/sales", headers=auth_headers, json={"customer_id": 1,
        "items": [{"product_id": item["id"], "quantity": 3}, {"product_id": item["id"], "quantity": 3}],
        "payment": {"method": "CASH", "amount": "60.00"}})
    assert response.status_code == 409
    assert db_session.scalar(select(Inventory.quantity).where(Inventory.product_id == item["id"])) == 5


def test_deleted_product_is_kept_as_a_snapshot_and_blocks_payment(client: TestClient, auth_headers: dict[str, str]) -> None:
    item = product(client, auth_headers)
    saved = draft(client, auth_headers, item)
    removed = client.post(f"/api/products/{item['id']}/remove", headers=auth_headers, json={"admin_password": "Admin123!"})
    assert removed.status_code == 200, removed.text
    recovered = client.get(f"/api/open-sales/{saved['id']}", headers=auth_headers).json()
    assert recovered["lines"][0]["product_name"] == item["name"]
    assert recovered["lines"][0]["product"] is None
    assert complete(client, auth_headers, saved).status_code == 409


def test_free_sale_with_a_valid_full_discount_can_be_completed(client: TestClient, auth_headers: dict[str, str]) -> None:
    saved = draft(client, auth_headers, product(client, auth_headers), quantity=1)
    payload = update_payload(saved)
    payload.update(discount_type="PERCENTAGE", discount_value="100")
    updated = client.put(f"/api/open-sales/{saved['id']}", headers=auth_headers, json=payload)
    assert updated.status_code == 200 and updated.json()["total"] == "0.00"
    response = complete(client, auth_headers, updated.json(), amount="0.00")
    assert response.status_code == 200 and response.json()["total"] == "0.00"
