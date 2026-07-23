"""
backend/routers/journal.py — Daily reflection journal + weekly/monthly AI summaries.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Literal, Optional
from datetime import date, timedelta
from supabase import Client

from backend.deps import get_supabase
from src.llm_wrapper import call_llm

router = APIRouter(prefix="/journal", tags=["journal"])

ValidMood = Literal["great", "good", "neutral", "low"]

class JournalEntry(BaseModel):
    entry_date: date
    mood: ValidMood
    one_line_reflection: Optional[str] = None

class JournalUpsert(BaseModel):
    mood: ValidMood
    one_line_reflection: Optional[str] = None

class SummaryResponse(BaseModel):
    period_type: str
    period_start: date
    period_end: date
    summary_text: str

@router.post("", response_model=JournalEntry)
def upsert_journal(body: JournalUpsert, sb: Client = Depends(get_supabase)):
    """Create or update today's journal entry."""
    today = date.today().isoformat()
    sb.table("reflection_journal").upsert({
        "entry_date": today,
        "mood": body.mood,
        "one_line_reflection": body.one_line_reflection,
    }, on_conflict="entry_date").execute()
    return JournalEntry(entry_date=today, mood=body.mood, one_line_reflection=body.one_line_reflection)

@router.get("", response_model=list[JournalEntry])
def list_journal(sb: Client = Depends(get_supabase)):
    res = sb.table("reflection_journal").select("*").order("entry_date", desc=True).execute()
    return [
        JournalEntry(entry_date=r["entry_date"], mood=r["mood"], one_line_reflection=r.get("one_line_reflection"))
        for r in (res.data or [])
    ]

@router.get("/summary", response_model=SummaryResponse)
def get_summary(
    period_type: Literal["weekly", "monthly"] = Query(default="weekly"),
    sb: Client = Depends(get_supabase),
):
    """Get or generate an AI summary for the most recently completed period."""
    today = date.today()
    if period_type == "weekly":
        # Most recent completed week (Mon-Sun)
        days_since_monday = today.weekday()
        period_end = today - timedelta(days=days_since_monday + 1)  # last Sunday
        period_start = period_end - timedelta(days=6)               # last Monday
    else:
        # Most recent completed month
        first_of_this_month = today.replace(day=1)
        period_end = first_of_this_month - timedelta(days=1)
        period_start = period_end.replace(day=1)
    
    # Check if summary exists
    existing = sb.table("reflection_summaries").select("*").eq(
        "period_type", period_type
    ).eq("period_start", period_start.isoformat()).execute()
    
    if existing.data:
        r = existing.data[0]
        return SummaryResponse(
            period_type=r["period_type"],
            period_start=r["period_start"],
            period_end=r["period_end"],
            summary_text=r["summary_text"],
        )
    
    # Generate a new summary
    entries = sb.table("reflection_journal").select("entry_date,mood,one_line_reflection").gte(
        "entry_date", period_start.isoformat()
    ).lte("entry_date", period_end.isoformat()).order("entry_date").execute()
    
    if not entries.data:
        raise HTTPException(status_code=404, detail="No journal entries found for this period.")
    
    entries_text = "\n".join(
        f"{r['entry_date']} [{r['mood']}]: {r.get('one_line_reflection') or 'No note'}"
        for r in entries.data
    )
    
    summary_text = call_llm(
        system_prompt=(
            f"Write a short (3-5 sentence), warm {period_type} summary of this student's entries "
            "based on their daily mood and reflections. Focus on effort, consistency, and personal growth. "
            "Never mention marks, scores, or rankings. Never say they fell behind or should try harder. "
            "This is about who they're becoming, not what they've achieved."
        ),
        user_prompt=entries_text,
    )
    
    sb.table("reflection_summaries").insert({
        "period_type": period_type,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "summary_text": summary_text,
    }).execute()
    
    return SummaryResponse(
        period_type=period_type,
        period_start=period_start,
        period_end=period_end,
        summary_text=summary_text,
    )
