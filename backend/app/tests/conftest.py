import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.database.session import Base, database_manager, get_db
from app.main import create_app
from app.models.role import Role, RoleName
from app.models.customer import Customer
from app.models.user import User


@pytest.fixture()
def db_session() -> Session:
    os.environ["TURNSTILE_SECRET_KEY"] = "1x0000000000000000000000000000000AA"
    get_settings.cache_clear()
    database_manager.configure("sqlite:///./test_meynapos.db")
    Base.metadata.drop_all(bind=database_manager.engine)
    Base.metadata.create_all(bind=database_manager.engine)
    db = database_manager.session_factory()
    admin_role = Role(name=RoleName.ADMIN, description="Admin role")
    cashier_role = Role(name=RoleName.CASHIER, description="Cashier role")
    db.add_all([admin_role, cashier_role])
    db.flush()
    db.add(Customer(name="Cliente Predeterminado", document_number="0000000000", phone="N/A", email="N/A", address="N/A"))
    db.add(
        User(
            full_name="Test Admin",
            email="admin@example.com",
            hashed_password=hash_password("Admin123!"),
            role_id=admin_role.id,
        )
    )
    db.commit()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=database_manager.engine)


@pytest.fixture()
def client(db_session: Session) -> TestClient:
    app = create_app()

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


@pytest.fixture()
def auth_headers(client: TestClient) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": "admin@example.com", "password": "Admin123!", "captchaToken": "test-token"})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
