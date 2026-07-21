from auth.passwords import hash_password, verify_password
from auth.permissions import (
    ACCESS_FULL,
    ACCESS_NONE,
    ACCESS_PARTIAL,
    PERMISSION_MATRIX,
    can_access,
    permissions_dict_from_role,
)


def test_password_hash_roundtrip():
    hashed = hash_password("Secreto123!")
    assert hashed != "Secreto123!"
    assert verify_password(hashed, "Secreto123!")
    assert not verify_password(hashed, "otra")


def test_permission_matrix_sensitive_always_none():
    for role_name, matrix in PERMISSION_MATRIX.items():
        assert matrix["sensitive"] == ACCESS_NONE, role_name


def test_can_access_partial_and_full():
    perms = permissions_dict_from_role("estudiante")
    assert can_access(perms, "profile", ACCESS_FULL)
    assert can_access(perms, "certifications", ACCESS_PARTIAL)
    assert not can_access(perms, "certifications", ACCESS_FULL)
    assert not can_access(perms, "sensitive", ACCESS_PARTIAL)


def test_reclutador_full_except_sensitive():
    perms = permissions_dict_from_role("reclutador")
    assert perms["profile"] == ACCESS_FULL
    assert perms["certifications"] == ACCESS_FULL
    assert perms["projects"] == ACCESS_FULL
    assert perms["sensitive"] == ACCESS_NONE
