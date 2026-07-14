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
    assert sale_response.json()["tipo_descuento"] == "NONE"
    assert sale_response.json()["monto_descuento"] == "0.00"
    assert products_response.json()[0]["inventory"]["quantity"] == 3


def test_create_sale_applies_fixed_discount(client: TestClient, auth_headers: dict[str, str]) -> None:
    product_response = client.post(
        "/api/products",
        json={
            "name": "Notebook",
            "barcode": "100200301",
            "sku": "NOT-001",
            "price": "10000.00",
            "cost": "6000.00",
            "initial_stock": 3,
            "minimum_stock": 1,
        },
        headers=auth_headers,
    )
    product_id = product_response.json()["id"]

    sale_response = client.post(
        "/api/sales",
        json={
            "customer_id": 1,
            "items": [{"product_id": product_id, "quantity": 1}],
            "tipo_descuento": "FIXED",
            "valor_descuento": "1500.00",
            "payment": {"method": "CASH", "amount": "8500.00"},
        },
        headers=auth_headers,
    )

    assert sale_response.status_code == 201
    assert sale_response.json()["subtotal"] == "10000.00"
    assert sale_response.json()["tipo_descuento"] == "FIXED"
    assert sale_response.json()["valor_descuento"] == "1500.00"
    assert sale_response.json()["monto_descuento"] == "1500.00"
    assert sale_response.json()["total"] == "8500.00"


def test_rejects_cash_payment_below_final_total(client: TestClient, auth_headers: dict[str, str]) -> None:
    product_response = client.post(
        "/api/products",
        json={
            "name": "Marker",
            "barcode": "100200302",
            "sku": "MAR-001",
            "price": "10000.00",
            "cost": "3000.00",
            "initial_stock": 3,
            "minimum_stock": 1,
        },
        headers=auth_headers,
    )
    product_id = product_response.json()["id"]

    sale_response = client.post(
        "/api/sales",
        json={
            "customer_id": 1,
            "items": [{"product_id": product_id, "quantity": 1}],
            "tipo_descuento": "PERCENTAGE",
            "valor_descuento": "10",
            "payment": {"method": "CASH", "amount": "8999.00"},
        },
        headers=auth_headers,
    )

    assert sale_response.status_code == 400
    assert sale_response.json()["detail"] == "Payment amount is lower than sale total"


def test_create_sale_rejects_insufficient_stock(client: TestClient, auth_headers: dict[str, str]) -> None:
    product_response = client.post(
        "/api/products",
        json={
            "name": "Limited Item",
            "barcode": "100200303",
            "sku": "LIM-001",
            "price": "20.00",
            "cost": "10.00",
            "initial_stock": 1,
            "minimum_stock": 1,
        },
        headers=auth_headers,
    )
    product_id = product_response.json()["id"]

    sale_response = client.post(
        "/api/sales",
        json={
            "customer_id": 1,
            "items": [{"product_id": product_id, "quantity": 2}],
            "payment": {"method": "CASH", "amount": "40.00"},
        },
        headers=auth_headers,
    )

    assert sale_response.status_code == 409
    assert sale_response.json()["detail"] == "Insufficient stock for Limited Item"
