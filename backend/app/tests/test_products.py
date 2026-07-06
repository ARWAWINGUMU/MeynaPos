from fastapi.testclient import TestClient


def test_create_and_find_product_by_barcode(client: TestClient, auth_headers: dict[str, str]) -> None:
    payload = {
        "name": "Organic Coffee",
        "description": "Premium 500g bag",
        "barcode": "7701234567890",
        "sku": "COF-500",
        "price": "18.50",
        "cost": "10.00",
        "initial_stock": 12,
        "minimum_stock": 3,
    }

    create_response = client.post("/api/products", json=payload, headers=auth_headers)
    barcode_response = client.get("/api/products/barcode/7701234567890", headers=auth_headers)

    assert create_response.status_code == 201
    assert barcode_response.status_code == 200
    assert barcode_response.json()["name"] == "Organic Coffee"
    assert barcode_response.json()["inventory"]["quantity"] == 12

