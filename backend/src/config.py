from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import os

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")


def _bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name, str(default)).strip().lower()
    return value in {"1", "true", "yes", "si", "sí", "on"}


def _path_env(name: str, default: str) -> Path:
    raw = os.getenv(name, default)
    path = Path(raw)
    return path if path.is_absolute() else BACKEND_ROOT / path


@dataclass(frozen=True)
class AppConfig:
    ollama_base_url: str = field(
        default_factory=lambda: os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    )
    llm_model: str = field(
        default_factory=lambda: os.getenv("OLLAMA_LLM_MODEL", "qwen2.5:3b")
    )
    embed_model: str = field(
        default_factory=lambda: os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
    )
    qdrant_path: Path = field(
        default_factory=lambda: _path_env("QDRANT_PATH", "storage/qdrant")
    )
    collection_name: str = field(
        default_factory=lambda: os.getenv("QDRANT_COLLECTION", "kevin_personal_rag")
    )
    data_dir: Path = field(default_factory=lambda: _path_env("DATA_DIR", "data/raw"))
    versions_dir: Path = field(
        default_factory=lambda: _path_env("VERSIONS_DIR", "data/versions")
    )
    manifest_path: Path = field(
        default_factory=lambda: _path_env(
            "MANIFEST_PATH", "storage/manifests/documents.json"
        )
    )
    chunk_size: int = field(
        default_factory=lambda: int(os.getenv("CHUNK_SIZE", "600"))
    )
    chunk_overlap: int = field(
        default_factory=lambda: int(os.getenv("CHUNK_OVERLAP", "80"))
    )
    similarity_top_k: int = field(
        default_factory=lambda: int(os.getenv("SIMILARITY_TOP_K", "4"))
    )
    request_timeout: float = field(
        default_factory=lambda: float(os.getenv("REQUEST_TIMEOUT", "180"))
    )
    min_free_disk_gb: float = field(
        default_factory=lambda: float(os.getenv("MIN_FREE_DISK_GB", "3"))
    )
    debug_sources: bool = field(
        default_factory=lambda: _bool_env("DEBUG_SOURCES", False)
    )

    def ensure_directories(self) -> None:
        for path in (
            self.qdrant_path,
            self.data_dir,
            self.versions_dir,
            self.manifest_path.parent,
        ):
            path.mkdir(parents=True, exist_ok=True)
