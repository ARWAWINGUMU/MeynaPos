from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.services.customer_service import CustomerService


def test_final_customer_keeps_identity_and_is_default(client: TestClient, auth_headers: dict[str, str], db_session: Session) -> None:
    original = db_session.scalars(select(Customer).where(Customer.document_number == "0000000000")).one()
    service = CustomerService(db_session)
    assert service.get_default_customer().id == original.id
    assert service.get_default_customer().name == "Cliente final"
    response = client.post("/api/open-sales", headers=auth_headers, json={})
    assert response.status_code == 201, response.text
    assert response.json()["customer_id"] == original.id
    assert response.json()["customer_name"] == "Cliente final"
    assert len(db_session.scalars(select(Customer).where(Customer.document_number == "0000000000")).all()) == 1
