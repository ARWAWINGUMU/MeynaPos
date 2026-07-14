from pathlib import Path

from fastapi.testclient import TestClient


PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"


def test_product_image_upload_is_served_and_replaced(client: TestClient, auth_headers: dict[str, str]) -> None:
    product_response = client.post(
        "/api/products",
        json={
            "name": "Camera Product",
            "barcode": "IMG-001",
            "sku": "IMG-SKU-001",
            "price": "12.00",
            "cost": "5.00",
            "initial_stock": 2,
            "minimum_stock": 1,
        },
        headers=auth_headers,
    )
    product_id = product_response.json()["id"]

    first_upload = client.post(
        f"/api/products/{product_id}/image",
        files={"file": ("product.png", PNG_BYTES, "image/png")},
        headers=auth_headers,
    )
    first_url = first_upload.json()["image_url"]

    assert first_upload.status_code == 200
    assert first_url.startswith("/media/products/")
    assert Path("./test_media/products", Path(first_url).name).is_file()
    assert client.get(first_url).status_code == 200

    second_upload = client.post(
        f"/api/products/{product_id}/image",
        files={"file": ("product-2.png", PNG_BYTES, "image/png")},
        headers=auth_headers,
    )
    second_url = second_upload.json()["image_url"]

    assert second_upload.status_code == 200
    assert second_url.startswith("/media/products/")
    assert second_url != first_url
    assert not Path("./test_media/products", Path(first_url).name).exists()
    assert Path("./test_media/products", Path(second_url).name).is_file()


def test_business_logo_upload_is_persistent_and_served(client: TestClient, auth_headers: dict[str, str]) -> None:
    upload_response = client.post(
        "/api/settings/logo",
        files={"file": ("logo.png", PNG_BYTES, "image/png")},
        headers=auth_headers,
    )
    logo_url = upload_response.json()["logo_url"]

    assert upload_response.status_code == 200
    assert logo_url.startswith("/media/business/")
    assert Path("./test_media/business", Path(logo_url).name).is_file()
    assert client.get(logo_url).status_code == 200


def test_rejects_unsupported_image_type(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/api/settings/logo",
        files={"file": ("logo.txt", b"not-image", "text/plain")},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported image type"
