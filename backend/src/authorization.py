"""Autorización de fragmentos RAG según matriz de permisos (Fase C)."""

from __future__ import annotations

from auth.permissions import ACCESS_FULL, ACCESS_NONE, ACCESS_PARTIAL, can_access

# document_type (metadato de ingestión) -> recurso de la matriz
DOCUMENT_TYPE_TO_RESOURCE: dict[str, str] = {
    "curriculum": "profile",
    "certificacion": "certifications",
    "proyecto": "projects",
}

PARTIAL_MAX_CHARS = 220

DENIAL_ES = (
    "No tienes permiso para consultar ese tipo de información con tu rol actual. "
    "Si necesitas ampliar el acceso, habla directamente con Martina a través de sus canales oficiales."
)
DENIAL_EN = (
    "You do not have permission to access that type of information with your current role. "
    "For broader access, speak directly with Martina through her official channels."
)


def resource_for_document_type(document_type: str | None) -> str:
    key = (document_type or "curriculum").strip().lower()
    return DOCUMENT_TYPE_TO_RESOURCE.get(key, "profile")


def node_allowed(permissions: dict[str, str] | None, document_type: str | None) -> bool:
    """True si el rol puede usar el fragmento (partial o full)."""
    if permissions is None:
        return True
    if permissions.get("sensitive", ACCESS_NONE) != ACCESS_NONE:
        # defensa: sensitive nunca debe ser distinto de none
        pass
    resource = resource_for_document_type(document_type)
    if resource == "sensitive":
        return False
    return can_access(permissions, resource, ACCESS_PARTIAL)


def access_level_for_node(permissions: dict[str, str] | None, document_type: str | None) -> str:
    if permissions is None:
        return ACCESS_FULL
    resource = resource_for_document_type(document_type)
    return permissions.get(resource, ACCESS_NONE)


def apply_partial_truncation(text: str, level: str) -> str:
    if level == ACCESS_FULL:
        return text
    if level == ACCESS_PARTIAL:
        trimmed = text.strip()
        if len(trimmed) <= PARTIAL_MAX_CHARS:
            return trimmed
        return trimmed[:PARTIAL_MAX_CHARS].rstrip() + "…"
    return ""


def filter_source_nodes(nodes: list, permissions: dict[str, str] | None) -> list:
    """Filtra nodos recuperados y recorta texto si el acceso es partial."""
    if permissions is None:
        return list(nodes)

    filtered = []
    for node in nodes:
        metadata = getattr(node, "metadata", None)
        if metadata is None and hasattr(node, "node"):
            metadata = getattr(node.node, "metadata", {}) or {}
        metadata = metadata or {}
        document_type = metadata.get("document_type")
        if not node_allowed(permissions, document_type):
            continue

        level = access_level_for_node(permissions, document_type)
        if level == ACCESS_NONE:
            continue

        # Recortar contenido del nodo interno cuando el acceso es parcial
        if level == ACCESS_PARTIAL and hasattr(node, "node"):
            original = node.node.get_content()
            truncated = apply_partial_truncation(original, level)
            try:
                node.node.set_content(truncated)
            except Exception:
                pass
        elif level == ACCESS_PARTIAL:
            text = getattr(node, "text", "") or ""
            truncated = apply_partial_truncation(text, level)
            if hasattr(node, "set_content"):
                try:
                    node.set_content(truncated)
                except Exception:
                    pass

        filtered.append(node)
    return filtered


def denial_message(language: str) -> str:
    return DENIAL_EN if language == "en" else DENIAL_ES
