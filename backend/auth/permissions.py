"""Matriz de permisos de la Fase 2.

Recursos:
- profile
- certifications
- projects
- sensitive  (siempre none / no por defecto)
"""

from __future__ import annotations

ACCESS_NONE = "none"
ACCESS_PARTIAL = "partial"
ACCESS_FULL = "full"

# role_name -> resource -> access_level
PERMISSION_MATRIX: dict[str, dict[str, str]] = {
    "administrador": {
        "profile": ACCESS_FULL,
        "certifications": ACCESS_FULL,
        "projects": ACCESS_FULL,
        "sensitive": ACCESS_NONE,
    },
    "reclutador": {
        "profile": ACCESS_FULL,
        "certifications": ACCESS_FULL,
        "projects": ACCESS_FULL,
        "sensitive": ACCESS_NONE,
    },
    "cliente": {
        "profile": ACCESS_FULL,
        "certifications": ACCESS_PARTIAL,
        "projects": ACCESS_FULL,
        "sensitive": ACCESS_NONE,
    },
    "estudiante": {
        "profile": ACCESS_FULL,
        "certifications": ACCESS_PARTIAL,
        "projects": ACCESS_PARTIAL,
        "sensitive": ACCESS_NONE,
    },
    "colega": {
        "profile": ACCESS_FULL,
        "certifications": ACCESS_FULL,
        "projects": ACCESS_FULL,
        "sensitive": ACCESS_NONE,
    },
    "general": {
        "profile": ACCESS_FULL,
        "certifications": ACCESS_PARTIAL,
        "projects": ACCESS_PARTIAL,
        "sensitive": ACCESS_NONE,
    },
}

ROLE_DEFINITIONS: list[dict[str, str]] = [
    {"name": "administrador", "label": "Administrador", "tone_key": "general"},
    {"name": "reclutador", "label": "Reclutador", "tone_key": "reclutador"},
    {"name": "cliente", "label": "Cliente potencial", "tone_key": "cliente"},
    {"name": "estudiante", "label": "Estudiante", "tone_key": "estudiante"},
    {"name": "colega", "label": "Colega profesional", "tone_key": "colega"},
    {"name": "general", "label": "Usuario general autorizado", "tone_key": "general"},
]


def can_access(permissions: dict[str, str], resource: str, required: str = ACCESS_PARTIAL) -> bool:
    level = permissions.get(resource, ACCESS_NONE)
    if required == ACCESS_FULL:
        return level == ACCESS_FULL
    if required == ACCESS_PARTIAL:
        return level in {ACCESS_PARTIAL, ACCESS_FULL}
    return False


def permissions_dict_from_role(role_name: str) -> dict[str, str]:
    return dict(PERMISSION_MATRIX.get(role_name, PERMISSION_MATRIX["general"]))
