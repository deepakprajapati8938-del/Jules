"""
backend/routers/streak.py — Streak tracking with gentle reset ritual.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from datetime import date, timedelta
from supabase import Client

from backend.deps import get_supabase

router = APIRouter(prefix="/streak", tags=["streak"])

class StreakState(BaseModel):
    current_streak: int
    last_active_date: date | None
    pending_reset_ritual: bool

@router.get("", response_model=StreakState)
def get_streak(sb: Client = Depends(get_supabase)):
    """Get current streak state."""
    res = sb.table("streak_state").select("*").limit(1).execute()
    row = res.data[0] if res.data else {"current_streak": 0, "last_active_date": None, "pending_reset_ritual": False}
    return StreakState(**{k: row[k] for k in ("current_streak", "last_active_date", "pending_reset_ritual")})

@router.post("/ping", response_model=StreakState)
def ping_streak(sb: Client = Depends(get_supabase)):
    """Record activity for today. Updates streak accordingly."""
    today = date.today()
    res = sb.table("streak_state").select("*").limit(1).execute()
    if not res.data:
        sb.table("streak_state").insert({"current_streak": 1, "last_active_date": today.isoformat(), "pending_reset_ritual": False}).execute()
        return StreakState(current_streak=1, last_active_date=today, pending_reset_ritual=False)
    
    row = res.data[0]
    row_id = row["id"]
    last = date.fromisoformat(row["last_active_date"]) if row["last_active_date"] else None
    streak = row["current_streak"]
    pending = row["pending_reset_ritual"]
    
    if last == today:
        # Already pinged today — no change
        pass
    elif last == today - timedelta(days=1):
        # Consecutive day — increment
        streak += 1
        pending = False
    elif last is None or (today - last).days > 1:
        # Missed a day — set pending_reset_ritual, don't reset streak yet
        pending = True
    
    sb.table("streak_state").update({
        "current_streak": streak,
        "last_active_date": today.isoformat(),
        "pending_reset_ritual": pending,
    }).eq("id", row_id).execute()
    
    return StreakState(current_streak=streak, last_active_date=today, pending_reset_ritual=pending)

@router.post("/complete-ritual", response_model=StreakState)
def complete_ritual(sb: Client = Depends(get_supabase)):
    """Complete the gentle reset ritual — clears pending flag WITHOUT resetting streak."""
    today = date.today()
    res = sb.table("streak_state").select("*").limit(1).execute()
    if not res.data:
        return StreakState(current_streak=0, last_active_date=None, pending_reset_ritual=False)
    
    row = res.data[0]
    sb.table("streak_state").update({
        "pending_reset_ritual": False,
        "last_active_date": today.isoformat(),
    }).eq("id", row["id"]).execute()
    
    return StreakState(
        current_streak=row["current_streak"],
        last_active_date=today,
        pending_reset_ritual=False,
    )
