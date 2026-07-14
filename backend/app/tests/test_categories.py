from fastapi.testclient import TestClient


def test_category_management_and_inactive_category_validation(client: TestClient, auth_headers: dict[str, str]) -> None:
    create_response = client.post(
        "/api/categories",
        json={"name": "Beverages", "description": "Drinks and refreshments"},
        headers=auth_headers,
    )
    duplicate_response = client.post(
        "/api/categories",
        json={"name": "beverages"},
        headers=auth_headers,
    )

    assert create_response.status_code == 201
    assert create_response.json()["is_active"] is True
    assert duplicate_response.status_code == 409

    category_id = create_response.json()["id"]
    update_response = client.put(
        f"/api/categories/{category_id}",
        json={"name": "Cold Beverages"},
        headers=auth_headers,
    )
    deactivate_response = client.patch(f"/api/categories/{category_id}/deactivate", headers=auth_headers)
    product_response = client.post(
        "/api/products",
        json={
            "name": "Inactive Category Product",
            "barcode": "CAT-INACTIVE-001",
            "sku": "CAT-INACTIVE-001",
            "price": "10.00",
            "cost": "5.00",
            "category_id": category_id,
            "initial_stock": 1,
            "minimum_stock": 1,
        },
        headers=auth_headers,
    )

    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Cold Beverages"
    assert deactivate_response.status_code == 200
    assert deactivate_response.json()["is_active"] is False
    assert product_response.status_code == 422
    assert product_response.json()["detail"] == "Category is not available"


def test_category_filters_products(client: TestClient, auth_headers: dict[str, str]) -> None:
    category_response = client.post("/api/categories", json={"name": "Snacks"}, headers=auth_headers)
    category_id = category_response.json()["id"]
    product_response = client.post(
        "/api/products",
        json={
            "name": "Salted Chips",
            "barcode": "SNACK-001",
            "sku": "SNACK-001",
            "price": "8.00",
            "cost": "4.00",
            "category_id": category_id,
            "initial_stock": 5,
            "minimum_stock": 2,
        },
        headers=auth_headers,
    )
    filtered_response = client.get(f"/api/products?category_id={category_id}", headers=auth_headers)

    assert product_response.status_code == 201
    assert filtered_response.status_code == 200
    assert [product["name"] for product in filtered_response.json()] == ["Salted Chips"]
