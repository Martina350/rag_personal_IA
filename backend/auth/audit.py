from __future__ import annotations

from sqlalchemy.orm import Session

from .models import AuditEvent


def log_event(
    db: Session,
    *,
    action: str,
    detail: str | None = None,
    user_id: int | None = None,
    username: str | None = None,
) -> None:
    db.add(
        AuditEvent(
            user_id=user_id,
            username=username,
            action=action,
            detail=detail,
        )
    )
