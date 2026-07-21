from __future__ import annotations

import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy.orm import Session, joinedload

from .audit import log_event
from .config import AuthConfig
from .models import SessionToken, User, utcnow
from .passwords import hash_password, verify_password
from .permissions import permissions_dict_from_role


@dataclass
class AuthContext:
    user_id: int
    username: str
    role_name: str
    role_label: str
    tone_key: str
    permissions: dict[str, str]
    token: str
    is_admin: bool


class AuthError(Exception):
    pass


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def create_user(
    db: Session,
    *,
    username: str,
    password: str,
    role_id: int,
    is_active: bool = True,
) -> User:
    if db.query(User).filter(User.username == username).first():
        raise AuthError(f"El usuario '{username}' ya existe.")
    user = User(
        username=username.strip(),
        password_hash=hash_password(password),
        role_id=role_id,
        is_active=is_active,
    )
    db.add(user)
    db.flush()
    log_event(db, action="user_created", username=username, user_id=user.id, detail=f"role_id={role_id}")
    return user


def revoke_user(db: Session, username: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise AuthError(f"Usuario '{username}' no encontrado.")
    user.is_active = False
    for session in user.sessions:
        session.revoked = True
    log_event(db, action="user_revoked", username=username, user_id=user.id)
    return user


def authenticate(
    db: Session,
    config: AuthConfig,
    username: str,
    password: str,
) -> AuthContext:
    user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.username == username.strip())
        .first()
    )
    now = utcnow()

    if not user:
        log_event(db, action="login_failed", username=username, detail="unknown_user")
        db.commit()
        raise AuthError("Credenciales inválidas.")

    if user.locked_until and _aware(user.locked_until) > now:
        log_event(db, action="login_blocked", username=username, user_id=user.id, detail="locked")
        db.commit()
        raise AuthError("Cuenta bloqueada temporalmente. Intente más tarde.")

    if not user.is_active:
        log_event(db, action="login_failed", username=username, user_id=user.id, detail="revoked")
        db.commit()
        raise AuthError("Usuario revocado. Contacte al administrador.")

    if not verify_password(user.password_hash, password):
        user.failed_attempts += 1
        if user.failed_attempts >= config.max_failed_attempts:
            user.locked_until = now + timedelta(minutes=config.lock_minutes)
            user.failed_attempts = 0
            log_event(
                db,
                action="account_locked",
                username=username,
                user_id=user.id,
                detail=f"{config.lock_minutes}m",
            )
            db.commit()
            raise AuthError("Demasiados intentos fallidos. Cuenta bloqueada temporalmente.")
        log_event(db, action="login_failed", username=username, user_id=user.id, detail="bad_password")
        db.commit()
        raise AuthError("Credenciales inválidas.")

    user.failed_attempts = 0
    user.locked_until = None
    token = secrets.token_urlsafe(32)
    expires_at = now + timedelta(hours=config.session_hours)
    db.add(SessionToken(user_id=user.id, token=token, expires_at=expires_at))
    log_event(db, action="login_success", username=username, user_id=user.id)
    db.commit()

    return AuthContext(
        user_id=user.id,
        username=user.username,
        role_name=user.role.name,
        role_label=user.role.label,
        tone_key=user.role.tone_key,
        permissions=permissions_dict_from_role(user.role.name),
        token=token,
        is_admin=user.role.name == "administrador",
    )


def logout(db: Session, token: str) -> None:
    session = db.query(SessionToken).filter(SessionToken.token == token).first()
    if not session:
        return
    session.revoked = True
    log_event(db, action="logout", user_id=session.user_id, detail="console")
    db.commit()


def resolve_session(db: Session, token: str) -> AuthContext:
    session = (
        db.query(SessionToken)
        .options(joinedload(SessionToken.user).joinedload(User.role))
        .filter(SessionToken.token == token)
        .first()
    )
    if not session:
        raise AuthError("Sesión no encontrada. Inicie sesión con: python -m auth.cli login")

    now = utcnow()
    if session.revoked or _aware(session.expires_at) <= now:
        raise AuthError("Sesión expirada o revocada. Inicie sesión nuevamente.")

    user = session.user
    if not user.is_active:
        raise AuthError("Usuario revocado.")

    return AuthContext(
        user_id=user.id,
        username=user.username,
        role_name=user.role.name,
        role_label=user.role.label,
        tone_key=user.role.tone_key,
        permissions=permissions_dict_from_role(user.role.name),
        token=token,
        is_admin=user.role.name == "administrador",
    )


def save_local_session(path: Path, ctx: AuthContext) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "token": ctx.token,
        "username": ctx.username,
        "role_name": ctx.role_name,
        "role_label": ctx.role_label,
        "tone_key": ctx.tone_key,
        "is_admin": ctx.is_admin,
        "permissions": ctx.permissions,
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def load_local_session_token(path: Path) -> str | None:
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    token = data.get("token")
    return token if isinstance(token, str) and token else None


def clear_local_session(path: Path) -> None:
    if path.exists():
        path.unlink()
