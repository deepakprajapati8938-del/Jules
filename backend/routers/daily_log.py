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
    Log a daily study session.
    """
    try:
        data = {
            "subject": session.subject,
            "chapter_name": session.chapter_name,
            "time_spent_mins": session.time_spent_mins,
            "notes": session.notes,
            # Let Supabase handle created_at
        }
        res = sb.table("study_sessions").insert(data).execute()
        
        # After logging, also update the streak state to ensure streak is maintained
        # (simulating the gentle reset logic from Phase 4)
        streak_res = sb.table("streak_state").select("*").execute()
        if streak_res.data:
            streak_id = streak_res.data[0]["id"]
            today = datetime.now(timezone.utc).date().isoformat()
            
            # Simple streak update (we just update last_active_date so streak doesn't die)
            # A full implementation would check pending_reset_ritual
            sb.table("streak_state").update({
                "last_active_date": today
            }).eq("id", streak_id).execute()

        return StudySession(**res.data[0])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history", response_model=List[StudySession])
def get_session_history(limit: int = 10, sb: Client = Depends(get_supabase)):
    """
    Get recent study sessions.
    """
    try:
        res = sb.table("study_sessions").select("*").order("created_at", desc=True).limit(limit).execute()
        return [StudySession(**row) for row in (res.data or [])]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
