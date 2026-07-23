"""
backend/routers/personal_chat.py — POST /api/v1/personal-chat

Personal chat (emotional support, motivation, general planning).
"""
from fastapi import APIRouter, HTTPException, Depends
import traceback
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from supabase import Client

from backend.deps import get_supabase
from src.llm_wrapper import call_llm
from src.embedder import _embed_with_retry

router = APIRouter(prefix="/personal-chat", tags=["personal-chat"])

PERSONAL_SYSTEM_PROMPT = """You are a warm, supportive companion for a student preparing for a medical entrance exam. 
This is a space for general conversation, motivation, planning, and emotional support — not academic doubt-solving 
(that happens in a separate chat). 
Rules:
- Never compare the student to others.
- Never say they are behind.
- Never use guilt or pressure.
- Never shame a missed day.
- Be genuinely warm and specific, not generic.
- Suggest, never force.

ARTIFACTS (Jules Canvas):
When the user asks you to build, visualize, simulate, or create an interactive tool (e.g. a study planner, a Pomodoro timer, a physics simulation, or a math graph), you MUST generate a self-contained HTML/JS/CSS widget.
Output the widget exactly like this:
```jules-artifact
<artifact-title>Title of Widget</artifact-title>
<!DOCTYPE html>
<html>
... your full html code with inline css/js ...
</html>
```
Use modern, beautiful styling (dark mode, glassmorphism, #8b5cf6 violet accents) to match the app."""

class PersonalChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    model: str | None = None
    attachment_data: Optional[str] = None
    attachment_mime_type: Optional[str] = None
    require_graph: bool = False

class PersonalChatResponse(BaseModel):
    reply: str
    session_id: str

class SessionOut(BaseModel):
    id: str
    chat_type: str
    title: str
    created_at: str
    updated_at: str

@router.get("/sessions", response_model=list[SessionOut])
def get_sessions(sb: Client = Depends(get_supabase)):
    try:
        res = sb.table("chat_sessions").select("*").eq("chat_type", "personal").order("updated_at", desc=True).execute()
        return [SessionOut(**row) for row in (res.data or [])]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("", response_model=PersonalChatResponse)
def personal_chat(req: PersonalChatRequest, sb: Client = Depends(get_supabase)):
    session_id = req.session_id
    
    # Create new session if none provided
    if not session_id:
        title = req.message[:30] + "..." if len(req.message) > 30 else req.message
        new_session = sb.table("chat_sessions").insert({
            "chat_type": "personal",
            "title": title
        }).execute()
        session_id = new_session.data[0]["id"]
    else:
        sb.table("chat_sessions").update({"updated_at": "now()"}).eq("id", session_id).execute()

    try:
        # 1. Retrieve relevant memories (GLOBAL for now, or could scope to session)
        q_embedding = _embed_with_retry(req.message)
        mem_res = sb.rpc("match_personal_memory", {
            "query_embedding": q_embedding,
            "match_count": 3,
            "match_threshold": 0.4,
        }).execute()
        memories = [r["summary_text"] for r in (mem_res.data or [])]
        
        # 2. Build context from memories and recent history (SCOPED TO SESSION)
        memory_context = ""
        if memories:
            memory_context += "Long-term memories:\n" + "\n".join(f"- {m}" for m in memories) + "\n\n"
            
        # Fetch last 8 messages for THIS session
        recent_res = sb.table("personal_chat_messages").select("role,content").eq("session_id", session_id).order("created_at", desc=True).limit(8).execute()
        if recent_res.data:
            history = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in reversed(recent_res.data))
            memory_context += f"Recent conversation history:\n{history}\n\n"
            
        if not memory_context:
            memory_context = None
        
        system_prompt_to_use = PERSONAL_SYSTEM_PROMPT
        if req.require_graph:
            system_prompt_to_use += "\n\nCRITICAL: The user has explicitly turned on GRAPH MODE. You MUST provide a `jules-artifact` containing a visually stunning interactive HTML/JS graph or visualization related to the answer, NO EXCUSES. For mobile responsiveness, if you use a side-by-side layout, you MUST use CSS media queries (e.g. `@media (max-width: 600px)`) to switch to a vertical stacked layout (`flex-direction: column`) so the graph is NEVER cut off."

        # 3. Generate response via call_llm
        reply = call_llm(
            system_prompt=system_prompt_to_use,
            user_prompt=req.message,
            context=memory_context,
            model_name=req.model,
            attachment_data=req.attachment_data,
            attachment_mime_type=req.attachment_mime_type
        )
        
        # 4. Save user message + reply to personal_chat_messages
        db_message = req.message
        if req.attachment_data:
            db_message += "\n[Attachment Included]"

        sb.table("personal_chat_messages").insert([
            {"role": "user", "content": db_message, "session_id": session_id},
            {"role": "assistant", "content": reply, "session_id": session_id},
        ]).execute()
        
        # 5. Check if memory generation is needed (every 20 messages in this session)
        count_res = sb.table("personal_chat_messages").select("id", count="exact", head=True).eq("session_id", session_id).execute()
        total = count_res.count or 0
        if total % 20 == 0 and total > 0:
            _generate_memory_entry(sb, session_id)
        
        return PersonalChatResponse(reply=reply, session_id=session_id)
    
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))

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
        res = sb.table("personal_chat_messages")\
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

def _generate_memory_entry(sb: Client, session_id: str) -> None:
    """Generate and store a memory summary from the last 20 messages of a session."""
    try:
        msgs = sb.table("personal_chat_messages").select("role,content").eq("session_id", session_id).order(
            "created_at", desc=True
        ).limit(20).execute()
        if not msgs.data:
            return
        convo = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in reversed(msgs.data))
        
        summary = call_llm(
            system_prompt=(
                "Summarize the key ongoing facts, goals, or emotional context from this "
                "conversation in 2-4 sentences, written for future reference. "
                "Do not include marks, scores, or comparisons. "
                "Focus on what matters for continuity of care and conversation."
            ),
            user_prompt=convo,
        )
        embedding = _embed_with_retry(summary)
        sb.table("personal_chat_memory").insert({
            "summary_text": summary,
            "embedding": embedding,
        }).execute()
    except Exception:
        pass
