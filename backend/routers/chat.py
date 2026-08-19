"""
backend/routers/chat.py — POST /api/v1/chat (NCERT RAG)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from supabase import Client
from backend.deps import get_supabase
from src.retriever import answer
from src.config import DEFAULT_TOP_K, DEFAULT_SIMILARITY_THRESHOLD
import uuid

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    attachment_data: Optional[str] = None
    attachment_mime_type: Optional[str] = None
    require_graph: bool = False
    top_k: int = DEFAULT_TOP_K
    threshold: float = DEFAULT_SIMILARITY_THRESHOLD
    model: Optional[str] = None

class ChunkOut(BaseModel):
    similarity: float
    chapter: str
    topic: str
    content_snippet: str

class ChatResponse(BaseModel):
    question: str
    answer: str
    fallback_applied: bool
    chunks: list[ChunkOut]
    session_id: str
    widget_html: Optional[str] = None

class SessionOut(BaseModel):
    id: str
    chat_type: str
    title: str
    created_at: str
    updated_at: str

@router.get("/sessions", response_model=list[SessionOut])
def get_sessions(sb: Client = Depends(get_supabase)):
    try:
        res = sb.table("chat_sessions").select("*").eq("chat_type", "ncert").order("updated_at", desc=True).execute()
        return [SessionOut(**row) for row in (res.data or [])]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, sb: Client = Depends(get_supabase)):
    try:
        sb.table("chat_sessions").delete().eq("id", session_id).execute()
        return {"status": "deleted"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("", response_model=ChatResponse)
def chat(req: ChatRequest, sb: Client = Depends(get_supabase)):
    session_id = req.session_id
    
    # Create new session if none provided
    if not session_id:
        title = req.question[:30] + "..." if len(req.question) > 30 else req.question
        new_session = sb.table("chat_sessions").insert({
            "chat_type": "ncert",
            "title": title
        }).execute()
        session_id = new_session.data[0]["id"]
    else:
        # Update session updated_at
        sb.table("chat_sessions").update({"updated_at": "now()"}).eq("id", session_id).execute()

    try:
        result = answer(
            req.question, 
            top_k=req.top_k, 
            threshold=req.threshold,
            attachment_data=req.attachment_data,
            attachment_mime_type=req.attachment_mime_type,
            require_graph=req.require_graph,
            model_name=req.model
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    
    chunks_out = [
        ChunkOut(
            similarity=c.similarity,
            chapter=c.metadata.get("chapter") or "",
            topic=c.metadata.get("topic") or "",
            content_snippet=c.content[:300],
        )
        for c in result.chunks
    ]
    # Save to database
    try:
        sb.table("ncert_chat_messages").insert([
            {"role": "user", "content": result.question, "session_id": session_id},
            {"role": "assistant", "content": result.answer, "session_id": session_id},
        ]).execute()
    except Exception as e:
        print(f"Error saving message: {e}")

    return ChatResponse(
        question=result.question,
        answer=result.answer,
        fallback_applied=result.fallback_applied,
        chunks=chunks_out,
        session_id=session_id,
        widget_html=result.widget_html
    )

class HistoryMessage(BaseModel):
    id: str
    role: str
    content: str
    created_at: str
    
class HistoryResponse(BaseModel):
    messages: list[HistoryMessage]

@router.get("/history", response_model=HistoryResponse)
def get_history(session_id: str, sb: Client = Depends(get_supabase)):
    try:
        res = sb.table("ncert_chat_messages")\
            .select("id,role,content,created_at")\
            .eq("session_id", session_id)\
            .order("created_at", desc=True)\
            .order("id", desc=True)\
            .limit(50).execute()
        
        msgs = []
        for row in reversed(res.data or []):
            msgs.append(HistoryMessage(
                id=str(row["id"]),
                role=row["role"],
                content=row["content"],
                created_at=row["created_at"]
            ))
        return HistoryResponse(messages=msgs)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

class SearchResult(BaseModel):
    session_id: str
    content: str
    created_at: str

@router.get("/search", response_model=list[SearchResult])
def search_history(query: str, sb: Client = Depends(get_supabase)):
    try:
        # We use ilike to do case-insensitive search
        res = sb.table("ncert_chat_messages")\
            .select("session_id, content, created_at")\
            .ilike("content", f"%{query}%")\
            .order("created_at", desc=True)\
            .limit(20).execute()
            
        results = []
        for row in (res.data or []):
            results.append(SearchResult(
                session_id=str(row["session_id"]),
                content=row["content"][:200] + ("..." if len(row["content"]) > 200 else ""),
                created_at=row["created_at"]
            ))
        return results
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

class QuickLookupRequest(BaseModel):
    query: str

class QuickLookupResponse(BaseModel):
    answer: str

@router.post("/quick-lookup", response_model=QuickLookupResponse)
def quick_lookup(req: QuickLookupRequest):
    try:
        result = answer(
            req.query,
            top_k=2,
            threshold=DEFAULT_SIMILARITY_THRESHOLD,
            quick_lookup=True
        )
        ans = result.answer.replace("[NOT FROM NCERT — GENERAL KNOWLEDGE]", "").strip()
        return QuickLookupResponse(answer=ans)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
