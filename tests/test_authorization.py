from types import SimpleNamespace

from auth.permissions import ACCESS_FULL, ACCESS_NONE, ACCESS_PARTIAL, permissions_dict_from_role

from src.authorization import (
    apply_partial_truncation,
    filter_source_nodes,
    node_allowed,
    resource_for_document_type,
)
from src.documents import file_metadata


def test_resource_mapping():
    assert resource_for_document_type("curriculum") == "profile"
    assert resource_for_document_type("certificacion") == "certifications"
    assert resource_for_document_type("proyecto") == "projects"
    assert resource_for_document_type(None) == "profile"


def test_file_metadata_detects_types():
    assert file_metadata(r"C:\data\cv_actualizado.pdf")["document_type"] == "curriculum"
    assert file_metadata(r"C:\data\certificado_servicios.pdf")["document_type"] == "certificacion"
    assert file_metadata(r"C:\data\proyecto_quipus.pdf")["document_type"] == "proyecto"


def test_estudiante_allows_partial_certs():
    perms = permissions_dict_from_role("estudiante")
    assert node_allowed(perms, "curriculum")
    assert node_allowed(perms, "certificacion")
    assert node_allowed(perms, "proyecto")
    assert perms["certifications"] == ACCESS_PARTIAL
    assert perms["sensitive"] == ACCESS_NONE


def test_filter_excludes_when_none():
    perms = {
        "profile": ACCESS_FULL,
        "certifications": ACCESS_NONE,
        "projects": ACCESS_NONE,
        "sensitive": ACCESS_NONE,
    }
    nodes = [
        SimpleNamespace(
            metadata={"document_type": "certificacion", "file_name": "c.pdf"},
            text="certificado completo " * 20,
            score=0.9,
        ),
        SimpleNamespace(
            metadata={"document_type": "curriculum", "file_name": "cv.pdf"},
            text="perfil profesional",
            score=0.8,
        ),
    ]
    filtered = filter_source_nodes(nodes, perms)
    assert len(filtered) == 1
    assert filtered[0].metadata["document_type"] == "curriculum"


def test_partial_truncates_text():
    long_text = "A" * 500
    assert len(apply_partial_truncation(long_text, ACCESS_PARTIAL)) < 250
    assert apply_partial_truncation(long_text, ACCESS_FULL) == long_text
