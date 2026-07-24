from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.role import Role, RoleName
from app.models.user import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        statement = select(User).options(joinedload(User.role)).where(User.email == email)
        return self.db.scalars(statement).first()

    def get_by_username(self, username: str) -> User | None:
        statement = select(User).options(joinedload(User.role)).where(User.username == username)
        return self.db.scalars(statement).first()

    def get_by_identifier(self, identifier: str) -> User | None:
        statement = (
            select(User)
            .options(joinedload(User.role))
            .where(or_(User.email == identifier, User.username == identifier))
        )
        return self.db.scalars(statement).first()

    def list(self, search: str | None = None, role: RoleName | None = None, status: str | None = None) -> list[User]:
        statement = select(User).options(joinedload(User.role)).order_by(User.created_at.desc())
        if search:
            term = f"%{search}%"
            statement = statement.where(
                or_(User.full_name.ilike(term), User.email.ilike(term), User.username.ilike(term))
            )
        if role:
            statement = statement.join(User.role).where(Role.name == role)
        if status == "active":
            statement = statement.where(User.is_active.is_(True), User.locked.is_(False))
        elif status == "inactive":
            statement = statement.where(User.is_active.is_(False))
        elif status == "locked":
            statement = statement.where(User.locked.is_(True))
        elif status == "password_pending":
            statement = statement.where(User.must_change_password.is_(True))
        elif status == "temporary_expired":
            statement = statement.where(User.must_change_password.is_(True), User.temporary_password_expires_at <= datetime.now(timezone.utc))
        return list(self.db.scalars(statement).unique().all())

    def get(self, user_id: int) -> User | None:
        statement = select(User).options(joinedload(User.role)).where(User.id == user_id)
        return self.db.scalars(statement).first()

    def add(self, user: User) -> User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
