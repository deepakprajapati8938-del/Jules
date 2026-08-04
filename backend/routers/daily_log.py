from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from typing import List, Optional
from datetime import datetime, timezone
from backend.deps import get_supabase
from pydantic import BaseModel

router = APIRouter(prefix="/daily-log", tags=["daily_log"])

class StudySessionCreate(BaseModel):
    subject: str
    chapter_name: str
    time_spent_mins: int
    notes: Optional[str] = None
    session_date: Optional[str] = None # YYYY-MM-DD format for backdating

class StudySession(BaseModel):
    id: int
    subject: str
    chapter_name: str
    time_spent_mins: int
    notes: Optional[str]
    created_at: str

@router.post("/", response_model=StudySession)
def log_session(session: StudySessionCreate, sb: Client = Depends(get_supabase)):
    """
    Log a daily study session with support for backdating (session_date).
    """
    try:
        data = {
            "subject": session.subject,
            "chapter_name": session.chapter_name,
            "time_spent_mins": session.time_spent_mins,
            "notes": session.notes,
        }
        
        # Handle backdating if session_date is specified
        if session.session_date:
            # Format as ISO 8601 UTC timestamp at noon
            data["created_at"] = f"{session.session_date}T12:00:00.000Z"
            
        res = sb.table("study_sessions").insert(data).execute()
        
        # After logging, also update the streak state to ensure streak is maintained
        streak_res = sb.table("streak_state").select("*").execute()
        if streak_res.data:
            streak_id = streak_res.data[0]["id"]
            active_date = session.session_date if session.session_date else datetime.now(timezone.utc).date().isoformat()
            
            sb.table("streak_state").update({
                "last_active_date": active_date
            }).eq("id", streak_id).execute()

        return StudySession(**res.data[0])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history", response_model=List[StudySession])
def get_session_history(limit: int = 500, subject: Optional[str] = None, sb: Client = Depends(get_supabase)):
    """
    Get study session history with high limit (for NEET 2027 archive) and optional subject filter.
    """
    try:
        query = sb.table("study_sessions").select("*").order("created_at", desc=True)
        if subject and subject.lower() != "all":
            query = query.eq("subject", subject)
            
        res = query.limit(limit).execute()
        return [StudySession(**row) for row in (res.data or [])]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

