from langdetect import DetectorFactory, LangDetectException, detect
from llama_index.core import Settings, VectorStoreIndex
from llama_index.core.response_synthesizers import get_response_synthesizer
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.llms.ollama import Ollama
from llama_index.vector_stores.qdrant import QdrantVectorStore
from qdrant_client import QdrantClient

from .authorization import denial_message, filter_source_nodes
from .config import AppConfig
from .privacy import REFUSAL_EN, REFUSAL_ES, is_sensitive_query, redact_sensitive_text
from .prompts import FALLBACK_EN, FALLBACK_ES, build_prompt

DetectorFactory.seed = 0


def detect_language(text: str) -> str:
    if len(text.strip()) < 12:
        english_markers = {"what", "who", "how", "experience", "certification", "skills"}
        return "en" if set(text.lower().split()) & english_markers else "es"
    try:
        return "en" if detect(text) == "en" else "es"
    except LangDetectException:
        return "es"


class PersonalRAG:
    def __init__(self, config: AppConfig):
        self.config = config
        Settings.llm = Ollama(
            model=config.llm_model,
            base_url=config.ollama_base_url,
            request_timeout=config.request_timeout,
            temperature=0.1,
        )
        Settings.embed_model = OllamaEmbedding(
            model_name=config.embed_model,
            base_url=config.ollama_base_url,
        )
        self.client = QdrantClient(path=str(config.qdrant_path))
        if not self.client.collection_exists(config.collection_name):
            self.client.close()
            raise RuntimeError("La colección no existe. Ejecute primero: python -m src.cli ingest")
        vector_store = QdrantVectorStore(
            client=self.client,
            collection_name=config.collection_name,
        )
        self.index = VectorStoreIndex.from_vector_store(vector_store)

    def close(self) -> None:
        self.client.close()

    def ask(
        self,
        query: str,
        role: dict,
        permissions: dict[str, str] | None = None,
    ) -> dict:
        language = detect_language(query)
        if is_sensitive_query(query):
            return {
                "answer": REFUSAL_EN if language == "en" else REFUSAL_ES,
                "language": language,
                "sources": [],
                "filtered": False,
            }

        # Recuperar de más candidatos si hay filtro de permisos
        top_k = self.config.similarity_top_k
        retrieve_k = top_k * 2 if permissions is not None else top_k
        retriever = self.index.as_retriever(similarity_top_k=retrieve_k)
        raw_nodes = retriever.retrieve(query)
        allowed_nodes = filter_source_nodes(raw_nodes, permissions)[:top_k]

        if raw_nodes and not allowed_nodes:
            return {
                "answer": denial_message(language),
                "language": language,
                "sources": [],
                "filtered": True,
            }

        if not allowed_nodes:
            return {
                "answer": FALLBACK_EN if language == "en" else FALLBACK_ES,
                "language": language,
                "sources": [],
                "filtered": False,
            }

        synthesizer = get_response_synthesizer(
            text_qa_template=build_prompt(role, language),
            response_mode="compact",
        )
        response = synthesizer.synthesize(query, nodes=allowed_nodes)
        answer = redact_sensitive_text(str(response))

        sources = []
        for node in getattr(response, "source_nodes", None) or allowed_nodes:
            metadata = getattr(node, "metadata", None)
            if metadata is None and hasattr(node, "node"):
                metadata = getattr(node.node, "metadata", {}) or {}
            metadata = metadata or {}
            text = getattr(node, "text", None)
            if text is None and hasattr(node, "node"):
                text = node.node.get_content()
            sources.append(
                {
                    "score": getattr(node, "score", None),
                    "file_name": metadata.get("file_name", "desconocido"),
                    "document_type": metadata.get("document_type", "desconocido"),
                    "text": (text or "")[:300],
                }
            )

        return {
            "answer": answer,
            "language": language,
            "sources": sources,
            "filtered": permissions is not None and len(allowed_nodes) < len(raw_nodes),
        }
