from __future__ import annotations

import os

import requests
from fastapi import APIRouter, Request
from sqlalchemy import text

from api.schemas import HealthResponse
from auth.config import AuthConfig
from auth.models import make_engine
from src.config import AppConfig

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    auth_config = AuthConfig()
    app_config = AppConfig()
    details: list[str] = []

    postgres = "ok"
    try:
        engine = make_engine(auth_config.database_url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
    except Exception as error:
        postgres = "error"
        details.append(f"postgres: {error}")

    ollama = "ok"
    try:
        response = requests.get(f"{app_config.ollama_base_url}/api/tags", timeout=5)
        response.raise_for_status()
    except Exception as error:
        ollama = "error"
        details.append(f"ollama: {error}")

    rag = getattr(request.app.state, "rag", None)
    rag_error = getattr(request.app.state, "rag_error", None)
    if rag is not None:
        qdrant = "ok"
    elif rag_error:
        qdrant = "error"
        details.append(f"qdrant/rag: {rag_error}")
    elif app_config.qdrant_path.exists():
        qdrant = "not_loaded"
        details.append("RAG no cargado; reinicie la API tras ingest")
    else:
        qdrant = "missing"
        details.append("Ejecute: python -m src.cli ingest")

    status_value = "ok" if postgres == "ok" and ollama == "ok" and qdrant == "ok" else "degraded"
    return HealthResponse(
        status=status_value,
        postgres=postgres,
        ollama=ollama,
        qdrant=qdrant,
        detail="; ".join(details) if details else None,
    )


def cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [item.strip() for item in raw.split(",") if item.strip()]
