from __future__ import annotations

from collections.abc import Generator

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from auth.config import AuthConfig
from auth.models import make_session_factory
from auth.service import AuthContext, AuthError, resolve_session


def get_auth_config() -> AuthConfig:
    return AuthConfig()


def get_db(config: AuthConfig = Depends(get_auth_config)) -> Generator[Session, None, None]:
    factory, engine = make_session_factory(config.database_url)
    db = factory()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def _extract_bearer(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta encabezado Authorization Bearer.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Formato inválido. Use: Authorization: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token.strip()


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AuthContext:
    token = _extract_bearer(authorization)
    try:
        return resolve_session(db, token)
    except AuthError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(error),
            headers={"WWW-Authenticate": "Bearer"},
        ) from error


def require_admin(ctx: AuthContext = Depends(get_current_user)) -> AuthContext:
    if not ctx.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el administrador puede realizar esta acción.",
        )
    return ctx
