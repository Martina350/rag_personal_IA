from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.deps import get_auth_config, get_current_user, get_db
from api.schemas import LoginRequest, LoginResponse, MeResponse, MessageResponse
from auth.config import AuthConfig
from auth.service import AuthContext, AuthError, authenticate, logout

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(
    body: LoginRequest,
    db: Session = Depends(get_db),
    config: AuthConfig = Depends(get_auth_config),
) -> LoginResponse:
    try:
        ctx = authenticate(db, config, body.username, body.password)
    except AuthError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(error)) from error
    return LoginResponse(
        access_token=ctx.token,
        username=ctx.username,
        role_name=ctx.role_name,
        role_label=ctx.role_label,
        tone_key=ctx.tone_key,
        is_admin=ctx.is_admin,
        permissions=ctx.permissions,
        expires_in_hours=config.session_hours,
    )


@router.post("/logout", response_model=MessageResponse)
def logout_route(
    ctx: AuthContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    logout(db, ctx.token)
    return MessageResponse(message="Sesión cerrada.")


@router.get("/me", response_model=MeResponse)
def me(ctx: AuthContext = Depends(get_current_user)) -> MeResponse:
    return MeResponse(
        username=ctx.username,
        role_name=ctx.role_name,
        role_label=ctx.role_label,
        tone_key=ctx.tone_key,
        is_admin=ctx.is_admin,
        permissions=ctx.permissions,
    )
