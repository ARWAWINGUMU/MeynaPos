from fastapi.testclient import TestClient


def test_login_returns_jwt(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"username": "admin@example.com", "password": "Admin123!", "captchaToken": "test-token"})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["role"] == "ADMIN"
    assert body["access_token"]


def test_login_rejects_invalid_password(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"username": "admin@example.com", "password": "wrong", "captchaToken": "test-token"})

    assert response.status_code == 401


def test_login_requires_captcha(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"username": "admin@example.com", "password": "Admin123!"})

    assert response.status_code == 400
