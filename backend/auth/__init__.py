"""Autenticación y autorización (Fase 2) con PostgreSQL."""

__all__ = ["AuthConfig"]


def __getattr__(name: str):
    if name == "AuthConfig":
        from .config import AuthConfig

        return AuthConfig
    raise AttributeError(name)
