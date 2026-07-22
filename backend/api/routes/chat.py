from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from api.deps import get_current_user, get_db
from api.schemas import ChatRequest, ChatResponse, SourceOut
from auth.audit import log_event
from auth.service import AuthContext
from src.roles import get_role_by_key

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(
    body: ChatRequest,
    request: Request,
    ctx: AuthContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    rag = getattr(request.app.state, "rag", None)
    if rag is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RAG no inicializado. Verifique ingestión y Qdrant local.",
        )

    tone_key = body.tone_key or ctx.tone_key
    role = get_role_by_key(tone_key)

    log_event(
        db,
        action="chat_query",
        user_id=ctx.user_id,
        username=ctx.username,
        detail=body.question[:200],
    )
    db.commit()

    try:
        result = rag.ask(body.question, role, permissions=ctx.permissions)
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al consultar el RAG: {error}",
        ) from error

    sources: list[SourceOut] = []
    if ctx.is_admin:
        sources = [SourceOut(**item) for item in result.get("sources", [])]

    return ChatResponse(
        answer=result["answer"],
        language=result["language"],
        filtered=bool(result.get("filtered")),
        sources=sources,
    )
