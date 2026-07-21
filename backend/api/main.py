from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import auth as auth_routes
from api.routes import chat as chat_routes
from api.routes import health as health_routes
from src.config import AppConfig
from src.rag import PersonalRAG


@asynccontextmanager
async def lifespan(app: FastAPI):
    config = AppConfig()
    config.ensure_directories()
    rag = None
    try:
        rag = PersonalRAG(config)
        app.state.rag = rag
        app.state.rag_error = None
    except Exception as error:
        app.state.rag = None
        app.state.rag_error = str(error)
    try:
        yield
    finally:
        if rag is not None:
            rag.close()


app = FastAPI(
    title="RAG Personal API",
    description="Fase D: autenticación + PersonalRAG con permisos",
    version="0.4.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=health_routes.cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(chat_routes.router)
app.include_router(health_routes.router)
