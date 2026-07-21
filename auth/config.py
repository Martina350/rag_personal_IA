from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os

from dotenv import load_dotenv

load_dotenv()


def _bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name, str(default)).strip().lower()
    return value in {"1", "true", "yes", "si", "sí", "on"}


@dataclass(frozen=True)
class AuthConfig:
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/rag_auth",
    )
    admin_username: str = os.getenv("AUTH_ADMIN_USERNAME", "admin")
    admin_password: str = os.getenv("AUTH_ADMIN_PASSWORD", "CambiarAdmin123!")
    session_hours: int = int(os.getenv("AUTH_SESSION_HOURS", "8"))
    max_failed_attempts: int = int(os.getenv("AUTH_MAX_FAILED_ATTEMPTS", "5"))
    lock_minutes: int = int(os.getenv("AUTH_LOCK_MINUTES", "15"))
    session_file: Path = Path(os.getenv("AUTH_SESSION_FILE", "storage/auth_session.json"))
    auth_required: bool = _bool_env("AUTH_REQUIRED", True)
