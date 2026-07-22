from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role_name: str
    role_label: str
    tone_key: str
    is_admin: bool
    permissions: dict[str, str]
    expires_in_hours: int


class MeResponse(BaseModel):
    username: str
    role_name: str
    role_label: str
    tone_key: str
    is_admin: bool
    permissions: dict[str, str]


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    tone_key: str | None = Field(
        default=None,
        description="Tono conversacional opcional (reclutador, cliente, estudiante, colega, general).",
    )


class SourceOut(BaseModel):
    score: float | None = None
    file_name: str
    document_type: str
    text: str


class ChatResponse(BaseModel):
    answer: str
    language: str
    filtered: bool = False
    sources: list[SourceOut] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    postgres: str
    ollama: str
    qdrant: str
    detail: str | None = None


class MessageResponse(BaseModel):
    message: str


class AdminUserOut(BaseModel):
    id: int
    username: str
    role_name: str
    role_label: str
    is_active: bool
    is_admin: bool
    permissions: dict[str, str]
    created_at: str | None = None


class AdminRoleOut(BaseModel):
    name: str
    label: str
    tone_key: str
    permissions: dict[str, str]


class AdminCreateUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=8, max_length=128)
    role_name: str = Field(min_length=1, max_length=64)
