"""
backend/routers/confidence.py — Confidence tracking for chapters.
Only updated via explicit user action, never automatically.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Literal
from supabase import Client

from backend.deps import get_supabase

router = APIRouter(prefix="/confidence", tags=["confidence"])

ValidStatus = Literal["not_started", "learning", "revised", "comfortable", "confident"]

class ConfidenceItem(BaseModel):
    chapter_name: str
    subject: str
    status: ValidStatus

class UpdateConfidence(BaseModel):
    status: ValidStatus

@router.get("", response_model=list[ConfidenceItem])
def list_confidence(sb: Client = Depends(get_supabase)):
    """Return confidence status for all chapters."""
    # Start from syllabus_config as the source of truth for chapters
    sc = sb.table("syllabus_config").select("chapter_name,subject").eq("included", True).execute()
    cc = sb.table("chapter_confidence").select("chapter_name,subject,status").execute()
    
    confidence_map = {
        (r["chapter_name"], r["subject"]): r["status"]
        for r in (cc.data or [])
    }
    
    result = []
    for row in (sc.data or []):
        result.append(ConfidenceItem(
            chapter_name=row["chapter_name"],
            subject=row["subject"],
            status=confidence_map.get((row["chapter_name"], row["subject"]), "not_started"),
        ))
    return result

@router.patch("/{chapter_name}", response_model=ConfidenceItem)
def update_confidence(
    chapter_name: str,
    subject: str,
    body: UpdateConfidence,
    sb: Client = Depends(get_supabase),
):
    """Update confidence for a chapter. Only called from explicit user action."""
    sb.table("chapter_confidence").upsert({
        "chapter_name": chapter_name,
        "subject": subject,
        "status": body.status,
    }, on_conflict="chapter_name,subject").execute()
    
    return ConfidenceItem(chapter_name=chapter_name, subject=subject, status=body.status)
