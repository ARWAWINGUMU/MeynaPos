from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.category import Category
from app.models.business_setting import BusinessSetting
from app.models.customer import Customer
from app.models.role import Role, RoleName
from app.models.sale import Sale
from app.models.system_setting import SystemSetting
from app.models.user import User


def seed_initial_data(db: Session) -> None:
    for role_name in RoleName:
        existing_role = db.scalars(select(Role).where(Role.name == role_name)).first()
        if existing_role is None:
            db.add(Role(name=role_name, description=f"{role_name.value.title()} role"))

    if db.scalars(select(Category).where(Category.name == "General")).first() is None:
        db.add(Category(name="General", description="Default product category"))

    if db.scalars(select(BusinessSetting)).first() is None:
        db.add(
            BusinessSetting(
                business_name="MeynaPOS",
                tax_id="0000000000",
                address="N/A",
                phone="N/A",
                email="N/A",
                city="N/A",
                currency="COP",
                tax_percentage=0,
                logo_url=None,
            )
        )
    else:
        for setting in db.scalars(select(BusinessSetting)).all():
            if setting.currency not in {"COP", "USD"}:
                setting.currency = "COP"
        for setting in db.scalars(select(BusinessSetting).where(BusinessSetting.logo_url == "/static/uploads/business/default-logo.png")).all():
            setting.logo_url = None

    default_customer = db.scalars(select(Customer).where(Customer.document_number == "0000000000")).first()
    if default_customer is None:
        default_customer = Customer(
            name="Cliente Predeterminado",
            document_number="0000000000",
            phone="N/A",
            email="N/A",
            address="N/A",
        )
        db.add(default_customer)
        db.flush()

    for sale in db.scalars(select(Sale).where(Sale.customer_id.is_(None))).all():
        sale.customer_id = default_customer.id

    admin = db.scalars(select(User).where(User.email == "admin@meynapos.com")).first()
    admin_role = db.scalars(select(Role).where(Role.name == RoleName.ADMIN)).first()
    admin_password_hash = hash_password("Admin123!")
    if admin is None and admin_role is not None:
        db.add(
            User(
                full_name="MeynaPOS Administrator",
                first_name="MeynaPOS",
                last_name="Administrator",
                email="admin@meynapos.com",
                username="admin",
                hashed_password=admin_password_hash,
                role_id=admin_role.id,
            )
        )
    elif admin is not None:
        admin.full_name = "MeynaPOS Administrator"
        admin.first_name = admin.first_name or "MeynaPOS"
        admin.last_name = admin.last_name or "Administrator"
        admin.username = admin.username or "admin"
        admin.hashed_password = admin_password_hash
        admin.is_active = True
        if admin_role is not None:
            admin.role_id = admin_role.id

    defaults = {
        "business_name": "MeynaPOS",
        "currency": "COP",
        "default_minimum_stock": "5",
        "system_notes": "Tecnología para crecer juntos",
    }
    for key, value in defaults.items():
        if db.get(SystemSetting, key) is None:
            db.add(SystemSetting(key=key, value=value))
    db.commit()
