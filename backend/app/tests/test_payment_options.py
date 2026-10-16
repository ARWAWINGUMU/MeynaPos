from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.tests.test_open_sales import cashier, draft, product
from app.models.business_setting import BusinessSetting
from app.models.payment_option import PaymentOption
from app.utils.names import next_sale_name


def test_smallest_available_label() -> None:
    assert next_sale_name([]) == "Venta 1"
    assert next_sale_name(["Venta 1", "Venta 3", "Mesa 4"]) == "Venta 2"
    assert next_sale_name([" venta   1 ", "VENTA 2"]) == "Venta 3"
    assert next_sale_name(["Venta 01", "Venta 100"]) == "Venta 1"


def test_payment_defaults_permissions_and_duplicates(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    url = "/api/payment-methods"
    first = client.get(url, headers=auth_headers)
    assert first.status_code == 200, first.text
    assert {item["code"] for item in first.json()} == {"CASH", "CARD", "TRANSFER", "QR_BREB"}
    assert client.get(url, headers=auth_headers).json() == first.json()
    created = client.post(url, headers=auth_headers, json={"name": "  Business voucher  ", "kind": "TRANSFER"})
    assert created.status_code == 201, created.text
    assert created.json()["name"] == "Business voucher"
    assert client.post(url, headers=auth_headers, json={"name": "BUSINESS   voucher"}).status_code == 409
    restricted = cashier(client, db_session, "payment.cashier")
    assert client.get(url, headers=restricted).status_code == 200
    assert client.post(url, headers=restricted, json={"name": "Unauthorized"}).status_code == 403
    assert client.post(url, headers=auth_headers, json={"name": "   "}).status_code == 422


def test_custom_payment_snapshot_and_checkout_retry(client: TestClient, auth_headers: dict[str, str]) -> None:
    option = client.post("/api/payment-methods", headers=auth_headers,
        json={"name": "Local voucher", "kind": "TRANSFER"}).json()
    saved = draft(client, auth_headers, product(client, auth_headers), quantity=1)
    url = f"/api/open-sales/{saved['id']}/complete"
    payload = {"version": saved["version"], "payment": {"method_id": option["id"], "amount": "10.00"}}
    first = client.post(url, headers=auth_headers, json=payload)
    assert first.status_code == 200, first.text
    assert first.json()["payment"]["method_name"] == "Local voucher"
    assert first.json()["payment"]["method"] == "TRANSFER"
    assert client.post(url, headers=auth_headers, json=payload).json()["id"] == first.json()["id"]
    report = client.get("/api/reports/sales", headers=auth_headers).json()
    assert report["items"][0]["payment_method_name"] == "Local voucher"


def test_unavailable_payment_is_rejected_without_completing_sale(client: TestClient, auth_headers: dict[str, str]) -> None:
    saved = draft(client, auth_headers, product(client, auth_headers), quantity=1)
    response = client.post(f"/api/open-sales/{saved['id']}/complete", headers=auth_headers,
        json={"version": saved["version"], "payment": {"method_id": 99999, "amount": "10.00"}})
    assert response.status_code == 422
    assert client.get(f"/api/open-sales/{saved['id']}", headers=auth_headers).json()["status"] == "HELD"


def test_foreign_and_inactive_payment_options_are_rejected(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    defaults = client.get("/api/payment-methods", headers=auth_headers).json()
    other = BusinessSetting(business_name="Other", tax_id="", address="", phone="", email="",
        city="", currency="COP", tax_percentage=0)
    db_session.add(other)
    db_session.flush()
    foreign = PaymentOption(business_id=other.id, code="FOREIGN", name="Other voucher", name_key="other voucher",
        kind="TRANSFER", is_active=True)
    inactive = db_session.get(PaymentOption, defaults[0]["id"])
    inactive.is_active = False
    db_session.add(foreign)
    db_session.commit()
    saved = draft(client, auth_headers, product(client, auth_headers), quantity=1)
    for identifier in (foreign.id, inactive.id):
        response = client.post(f"/api/open-sales/{saved['id']}/complete", headers=auth_headers,
            json={"version": saved["version"], "payment": {"method_id": identifier, "amount": "10.00"}})
        assert response.status_code == 422, response.text
