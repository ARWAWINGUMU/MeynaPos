from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.category import Category
from app.models.business_setting import BusinessSetting
from app.models.customer import Customer
from app.models.role import Role, RoleName
from app.models.sale import Sale
from app.models.system_setting import SystemSetting
from app.models.user import User


def seed_initial_data(db: Session) -> None:
    settings = get_settings()
    for role_name in RoleName:
        existing_role = db.scalars(select(Role).where(Role.name == role_name)).first()
        if existing_role is None:
            db.add(Role(name=role_name, description=f"{role_name.value.title()} role"))

    if db.scalars(select(Category).where(Category.name == "General")).first() is None:
        db.add(Category(name="General", description="Default product category"))

    if db.scalars(select(BusinessSetting)).first() is None:
        db.add(
            BusinessSetting(
                business_name=settings.default_business_name,
                tax_id=settings.default_business_nit,
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

    admin_role = db.scalars(select(Role).where(Role.name == RoleName.ADMIN)).first()
    existing_admin = (
        db.scalars(select(User).join(User.role).where(Role.name == RoleName.ADMIN)).first()
        if admin_role is not None
        else None
    )
    if existing_admin is None and admin_role is not None:
        if not settings.initial_admin_email or not settings.initial_admin_password:
            raise RuntimeError("INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required to create the first administrator.")
        if settings.environment.lower() == "production" and settings.initial_admin_password == "change-me":
            raise RuntimeError("INITIAL_ADMIN_PASSWORD must be changed before production deployment.")
        name_parts = settings.initial_admin_name.strip().split(maxsplit=1)
        first_name = name_parts[0] if name_parts else "Administrador"
        last_name = name_parts[1] if len(name_parts) > 1 else ""
        db.add(
            User(
                full_name=settings.initial_admin_name,
                first_name=first_name,
                last_name=last_name,
                email=settings.initial_admin_email,
                username=settings.initial_admin_email.split("@")[0],
                hashed_password=hash_password(settings.initial_admin_password),
                is_active=True,
                is_superuser=True,
                must_change_password=True,
                password_changed_at=None,
                temporary_password_expires_at=None,
                token_version=0,
                role_id=admin_role.id,
            )
        )

    defaults = {
        "business_name": settings.default_business_name,
        "currency": "COP",
        "default_minimum_stock": "5",
        "system_notes": "Tecnología para crecer juntos",
    }
    for key, value in defaults.items():
        if db.get(SystemSetting, key) is None:
            db.add(SystemSetting(key=key, value=value))
    db.commit()
