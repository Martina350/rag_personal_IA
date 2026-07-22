from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from api.deps import get_db, require_admin
from api.schemas import (
    AdminCreateUserRequest,
    AdminRoleOut,
    AdminUserOut,
    MessageResponse,
)
from auth.models import Role, User
from auth.permissions import permissions_dict_from_role
from auth.service import AuthContext, AuthError, create_user, revoke_user

router = APIRouter(prefix="/admin", tags=["admin"])


def _user_out(user: User) -> AdminUserOut:
    role = user.role
    return AdminUserOut(
        id=user.id,
        username=user.username,
        role_name=role.name,
        role_label=role.label,
        is_active=user.is_active,
        is_admin=role.name == "administrador",
        permissions=permissions_dict_from_role(role.name),
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


@router.get("/roles", response_model=list[AdminRoleOut])
def list_roles(
    _admin: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminRoleOut]:
    roles = db.query(Role).order_by(Role.id).all()
    return [
        AdminRoleOut(
            name=role.name,
            label=role.label,
            tone_key=role.tone_key,
            permissions=permissions_dict_from_role(role.name),
        )
        for role in roles
    ]


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    _admin: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminUserOut]:
    users = (
        db.query(User)
        .options(joinedload(User.role))
        .order_by(User.username)
        .all()
    )
    return [_user_out(user) for user in users]


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_admin_user(
    body: AdminCreateUserRequest,
    _admin: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserOut:
    role = db.query(Role).filter(Role.name == body.role_name.strip()).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rol desconocido. Consulte GET /admin/roles.",
        )
    try:
        user = create_user(
            db,
            username=body.username.strip(),
            password=body.password,
            role_id=role.id,
        )
        db.commit()
        user = (
            db.query(User)
            .options(joinedload(User.role))
            .filter(User.id == user.id)
            .one()
        )
        return _user_out(user)
    except AuthError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.post("/users/{username}/revoke", response_model=MessageResponse)
def revoke_admin_user(
    username: str,
    admin: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> MessageResponse:
    if username.strip() == admin.username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes revocar tu propia cuenta de administrador.",
        )
    try:
        revoke_user(db, username.strip())
        db.commit()
        return MessageResponse(message=f"Usuario '{username}' revocado.")
    except AuthError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
