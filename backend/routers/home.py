from fastapi import APIRouter, Depends
from pydantic import BaseModel
from supabase import Client
from typing import Optional, List
from backend.deps import get_supabase
from backend.routers.suggestions import get_suggestions, Suggestion

router = APIRouter(prefix="/home", tags=["home"])

class RecentChat(BaseModel):
    id: str
    role: str
    content: str
    type: str # "NCERT" or "Personal"
    created_at: str

class HomeData(BaseModel):
    suggestion: Optional[Suggestion]
    last_incomplete_test: Optional[dict]
    flashcards_due: int
    recent_chats: List[RecentChat]

@router.get("/data", response_model=HomeData)
def get_home_data(sb: Client = Depends(get_supabase)):
    # 1. Suggestion
    suggestions = get_suggestions(top_n=1, sb=sb)
    suggestion = suggestions[0] if suggestions else None

    # 2. Last Incomplete Test
    test_res = sb.table("test_attempts").select("id, started_at, test_id").eq("is_completed", False).order("started_at", desc=True).limit(1).execute()
    last_incomplete_test = None
    if test_res.data:
        t = test_res.data[0]
        test_info = sb.table("tests").select("test_type, subject, chapter_name, total_marks, duration_mins").eq("id", t["test_id"]).execute()
        if test_info.data:
            last_incomplete_test = {
                "attempt_id": t["id"],
                "test_id": t["test_id"],
                "started_at": t["started_at"],
                **test_info.data[0]
            }

    # 3. Flashcards Due (stub)
    flashcards_due = 0

    # 4. Recent Chats (merge NCERT and Personal, take top 3 latest user messages)
    chats = []
    
    ncert_res = sb.table("ncert_chat_messages").select("id, role, content, created_at").eq("role", "user").order("created_at", desc=True).limit(3).execute()
    for row in (ncert_res.data or []):
        chats.append(RecentChat(
            id=str(row["id"]), role=row["role"], content=row["content"], type="NCERT", created_at=row["created_at"]
        ))
        
    personal_res = sb.table("personal_chat_messages").select("id, role, content, created_at").eq("role", "user").order("created_at", desc=True).limit(3).execute()
    for row in (personal_res.data or []):
        chats.append(RecentChat(
            id=str(row["id"]), role=row["role"], content=row["content"], type="Personal", created_at=row["created_at"]
        ))
        
    chats.sort(key=lambda x: x.created_at, reverse=True)
    recent_chats = chats[:3]

    return HomeData(
        suggestion=suggestion,
        last_incomplete_test=last_incomplete_test,
        flashcards_due=flashcards_due,
        recent_chats=recent_chats
    )
