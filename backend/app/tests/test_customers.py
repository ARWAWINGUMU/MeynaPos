from fastapi.testclient import TestClient


def test_customer_summary_and_purchase_history(client: TestClient, auth_headers: dict[str, str]) -> None:
    customer_response = client.post(
        "/api/customers",
        json={
            "name": "Maria Lopez",
            "document_number": "CC-100",
            "phone": "3001234567",
            "email": "maria@example.com",
            "address": "Main Street 123",
        },
        headers=auth_headers,
    )
    product_response = client.post(
        "/api/products",
        json={
            "name": "Customer History Item",
            "barcode": "HIST-001",
            "sku": "HIST-001",
            "price": "20000.00",
            "cost": "12000.00",
            "initial_stock": 5,
            "minimum_stock": 1,
        },
        headers=auth_headers,
    )
    customer_id = customer_response.json()["id"]
    product_id = product_response.json()["id"]

    sale_response = client.post(
        "/api/sales",
        json={
            "customer_id": customer_id,
            "items": [{"product_id": product_id, "quantity": 2}],
            "tipo_descuento": "FIXED",
            "valor_descuento": "5000.00",
            "payment": {"method": "CASH", "amount": "35000.00"},
        },
        headers=auth_headers,
    )
    summary_response = client.get("/api/customers/summary?search=Maria", headers=auth_headers)
    history_response = client.get(f"/api/customers/{customer_id}/history", headers=auth_headers)

    assert sale_response.status_code == 201
    assert summary_response.status_code == 200
    assert history_response.status_code == 200

    summary = summary_response.json()[0]
    history = history_response.json()[0]

    assert summary["name"] == "Maria Lopez"
    assert summary["purchase_count"] == 1
    assert summary["total_purchased"] == "35000.00"
    assert history["sale_number"] == sale_response.json()["invoice_number"]
    assert history["cashier"] == "Test Admin"
    assert history["products"][0]["name"] == "Customer History Item"
    assert history["subtotal"] == "40000.00"
    assert history["discount"] == "5000.00"
    assert history["total"] == "35000.00"
    assert history["payment_method"] == "CASH"
    assert history["status"] == "PAGADA"


def test_customer_history_returns_404_for_unknown_customer(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.get("/api/customers/999/history", headers=auth_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Customer not found"
