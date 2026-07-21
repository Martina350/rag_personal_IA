"""Helpers para exigir sesión de Fase 2 desde la CLI RAG."""

from __future__ import annotations

from auth.audit import log_event
from auth.config import AuthConfig
from auth.models import make_session_factory
from auth.service import AuthContext, AuthError, load_local_session_token, resolve_session


def require_auth_context(auth_config: AuthConfig | None = None) -> AuthContext:
    config = auth_config or AuthConfig()
    if not config.auth_required:
        raise AuthError("AUTH_REQUIRED está desactivado.")

    token = load_local_session_token(config.session_file)
    if not token:
        raise AuthError(
            "Debe autenticarse primero: python -m auth.cli login"
        )

    factory, engine = make_session_factory(config.database_url)
    db = factory()
    try:
        return resolve_session(db, token)
    finally:
        db.close()
        engine.dispose()


def audit_chat_query(auth_config: AuthConfig, ctx: AuthContext, question: str) -> None:
    factory, engine = make_session_factory(auth_config.database_url)
    db = factory()
    try:
        log_event(
            db,
            action="chat_query",
            user_id=ctx.user_id,
            username=ctx.username,
            detail=question[:200],
        )
        db.commit()
    finally:
        db.close()
        engine.dispose()
