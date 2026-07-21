from __future__ import annotations

from sqlalchemy.orm import Session

from .config import AuthConfig
from .models import Base, Permission, Role, User, make_engine
from .passwords import hash_password
from .permissions import PERMISSION_MATRIX, ROLE_DEFINITIONS


def init_schema(database_url: str) -> None:
    engine = make_engine(database_url)
    Base.metadata.create_all(engine)
    engine.dispose()


def seed_roles_and_admin(db: Session, config: AuthConfig) -> None:
    roles_by_name: dict[str, Role] = {}
    for definition in ROLE_DEFINITIONS:
        role = db.query(Role).filter(Role.name == definition["name"]).first()
        if not role:
            role = Role(
                name=definition["name"],
                label=definition["label"],
                tone_key=definition["tone_key"],
            )
            db.add(role)
            db.flush()
        else:
            role.label = definition["label"]
            role.tone_key = definition["tone_key"]
        roles_by_name[role.name] = role

        matrix = PERMISSION_MATRIX[role.name]
        for resource, access_level in matrix.items():
            perm = (
                db.query(Permission)
                .filter(Permission.role_id == role.id, Permission.resource == resource)
                .first()
            )
            if not perm:
                db.add(
                    Permission(role_id=role.id, resource=resource, access_level=access_level)
                )
            else:
                perm.access_level = access_level

    admin_role = roles_by_name["administrador"]
    admin = db.query(User).filter(User.username == config.admin_username).first()
    if not admin:
        db.add(
            User(
                username=config.admin_username,
                password_hash=hash_password(config.admin_password),
                role_id=admin_role.id,
                is_active=True,
            )
        )
    db.commit()
