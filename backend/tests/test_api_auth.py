"""Pruebas ligeras de la API (sin depender de Ollama para auth)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api.main import app
from auth.config import AuthConfig
from auth.models import Base, make_engine, make_session_factory
from auth.seed import seed_roles_and_admin


@pytest.fixture()
def api_client(tmp_path, monkeypatch):
    db_path = tmp_path / "api_auth.db"
    url = f"sqlite+pysqlite:///{db_path}"
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("AUTH_ADMIN_USERNAME", "admin")
    monkeypatch.setenv("AUTH_ADMIN_PASSWORD", "AdminTest123!")
    monkeypatch.setenv("AUTH_SESSION_HOURS", "2")

    config = AuthConfig()
    engine = make_engine(url)
    Base.metadata.create_all(engine)
    factory, _ = make_session_factory(url)
    db = factory()
    seed_roles_and_admin(db, config)
    db.close()
    engine.dispose()

    with TestClient(app, raise_server_exceptions=False) as client:
        app.state.rag = None
        app.state.rag_error = "mocked"
        yield client


def test_health_endpoint(api_client):
    response = api_client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert "status" in body
    assert "postgres" in body


def test_login_and_me(api_client):
    login = api_client.post(
        "/auth/login",
        json={"username": "admin", "password": "AdminTest123!"},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    me = api_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "admin"
    assert me.json()["is_admin"] is True


def test_chat_requires_auth(api_client):
    response = api_client.post("/chat", json={"question": "hola"})
    assert response.status_code == 401


def test_admin_users_requires_admin(api_client):
    denied = api_client.get("/admin/users")
    assert denied.status_code == 401

    login = api_client.post(
        "/auth/login",
        json={"username": "admin", "password": "AdminTest123!"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    roles = api_client.get("/admin/roles", headers=headers)
    assert roles.status_code == 200
    assert any(role["name"] == "estudiante" for role in roles.json())

    users = api_client.get("/admin/users", headers=headers)
    assert users.status_code == 200
    assert any(user["username"] == "admin" for user in users.json())

    created = api_client.post(
        "/admin/users",
        headers=headers,
        json={"username": "demo_estudiante", "password": "DemoUser123!", "role_name": "estudiante"},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["username"] == "demo_estudiante"
    assert body["permissions"]["certifications"] == "partial"
