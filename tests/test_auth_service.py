"""Pruebas de autenticación con SQLite en memoria (misma lógica que Postgres)."""

from datetime import timedelta

import pytest
from sqlalchemy.orm import Session

from auth.config import AuthConfig
from auth.models import Base, Role, User, make_engine, utcnow
from auth.passwords import hash_password
from auth.permissions import PERMISSION_MATRIX, ROLE_DEFINITIONS
from auth.seed import seed_roles_and_admin
from auth.service import AuthError, authenticate, create_user, resolve_session, revoke_user
from auth.models import Permission


@pytest.fixture()
def db_session(tmp_path):
    engine = make_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = Session(engine)
    config = AuthConfig(
        database_url="sqlite+pysqlite:///:memory:",
        admin_username="admin",
        admin_password="AdminTest123!",
        session_hours=1,
        max_failed_attempts=3,
        lock_minutes=15,
        session_file=tmp_path / "session.json",
        auth_required=True,
    )
    seed_roles_and_admin(session, config)
    yield session, config
    session.close()
    engine.dispose()


def test_seed_creates_roles_and_admin(db_session):
    session, config = db_session
    roles = session.query(Role).all()
    assert len(roles) == len(ROLE_DEFINITIONS)
    admin = session.query(User).filter(User.username == "admin").first()
    assert admin is not None
    assert admin.role.name == "administrador"
    perms = session.query(Permission).count()
    assert perms == sum(len(v) for v in PERMISSION_MATRIX.values())


def test_login_success_and_session(db_session):
    session, config = db_session
    ctx = authenticate(session, config, "admin", "AdminTest123!")
    assert ctx.username == "admin"
    assert ctx.is_admin
    resolved = resolve_session(session, ctx.token)
    assert resolved.user_id == ctx.user_id


def test_login_failure_and_lockout(db_session):
    session, config = db_session
    role = session.query(Role).filter(Role.name == "estudiante").first()
    create_user(session, username="alumno", password="Alumno123!", role_id=role.id)
    session.commit()

    for _ in range(config.max_failed_attempts):
        with pytest.raises(AuthError):
            authenticate(session, config, "alumno", "mala")

    user = session.query(User).filter(User.username == "alumno").first()
    assert user.locked_until is not None

    with pytest.raises(AuthError, match="bloqueada"):
        authenticate(session, config, "alumno", "Alumno123!")


def test_revoke_blocks_login(db_session):
    session, config = db_session
    role = session.query(Role).filter(Role.name == "general").first()
    create_user(session, username="visita", password="Visita123!", role_id=role.id)
    session.commit()
    revoke_user(session, "visita")
    session.commit()
    with pytest.raises(AuthError, match="revocado"):
        authenticate(session, config, "visita", "Visita123!")
