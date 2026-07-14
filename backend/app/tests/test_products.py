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


def test_find_product_by_qr_code_text(client: TestClient, auth_headers: dict[str, str]) -> None:
    payload = {
        "name": "QR Gift Card",
        "description": "Digital product",
        "barcode": "7701234567891",
        "qr_code": "MEYNAPOS:GIFTCARD:001",
        "sku": "GFT-001",
        "price": "50.00",
        "cost": "40.00",
        "initial_stock": 4,
        "minimum_stock": 1,
    }

    create_response = client.post("/api/products", json=payload, headers=auth_headers)
    qr_response = client.get("/api/products/barcode/MEYNAPOS:GIFTCARD:001", headers=auth_headers)

    assert create_response.status_code == 201
    assert qr_response.status_code == 200
    assert qr_response.json()["qr_code"] == "MEYNAPOS:GIFTCARD:001"


def test_reject_duplicate_barcode(client: TestClient, auth_headers: dict[str, str]) -> None:
    payload = {
        "name": "First Product",
        "barcode": "DUP-001",
        "sku": "DUP-SKU-001",
        "price": "10.00",
        "cost": "5.00",
        "initial_stock": 1,
        "minimum_stock": 1,
    }
    duplicate_payload = {
        **payload,
        "name": "Second Product",
        "sku": "DUP-SKU-002",
    }

    first_response = client.post("/api/products", json=payload, headers=auth_headers)
    duplicate_response = client.post("/api/products", json=duplicate_payload, headers=auth_headers)

    assert first_response.status_code == 201
    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["detail"] == "Barcode already exists"
