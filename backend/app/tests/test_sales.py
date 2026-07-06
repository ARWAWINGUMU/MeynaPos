from fastapi.testclient import TestClient


def test_create_sale_decrements_inventory(client: TestClient, auth_headers: dict[str, str]) -> None:
    product_response = client.post(
        "/api/products",
        json={
            "name": "Sparkling Water",
            "barcode": "100200300",
            "sku": "WAT-001",
            "price": "2.50",
            "cost": "1.00",
            "initial_stock": 5,
            "minimum_stock": 2,
        },
        headers=auth_headers,
    )
    product_id = product_response.json()["id"]

    sale_response = client.post(
        "/api/sales",
        json={
            "customer_id": 1,
            "items": [{"product_id": product_id, "quantity": 2}],
            "payment": {"method": "CASH", "amount": "5.00"},
        },
        headers=auth_headers,
    )
    products_response = client.get("/api/products", headers=auth_headers)

    assert sale_response.status_code == 201
    assert sale_response.json()["total"] == "5.00"
    assert products_response.json()[0]["inventory"]["quantity"] == 3
