"""
backend/routers/suggestions.py — Deterministic suggestion engine.
No LLM required — purely signal-based ranking.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from supabase import Client

from backend.deps import get_supabase

router = APIRouter(prefix="/suggestions", tags=["suggestions"])

# NEET subject weightage fallback (per spec)
SUBJECT_WEIGHT = {"Biology": 0.50, "Physics": 0.25, "Chemistry": 0.25}

class Suggestion(BaseModel):
    chapter_name: str
    subject: str
    confidence_status: str
    reason: str
    score: float

@router.get("", response_model=list[Suggestion])
def get_suggestions(top_n: int = 5, sb: Client = Depends(get_supabase)):
    """
    Returns top N chapter suggestions ranked by:
    1. Confidence status (not_started > learning > revised > comfortable > confident)
    2. Subject weightage (Biology > Physics = Chemistry)
    3. Wrong answers in recent tests (question_attempts)
    """
    # Get all included chapters
    sc_res = sb.table("syllabus_config").select("chapter_name,subject,weightage_marks").eq("included", True).execute()
    chapters = {(r["chapter_name"], r["subject"]): r for r in (sc_res.data or [])}
    
    # Get confidence data
    cc_res = sb.table("chapter_confidence").select("chapter_name,subject,status").execute()
    confidence = {(r["chapter_name"], r["subject"]): r["status"] for r in (cc_res.data or [])}
    
    # Get wrong answer counts per chapter
    qa_res = sb.table("question_attempts").select("test_question_id").eq("is_correct", False).execute()
    wrong_ids = [r["test_question_id"] for r in (qa_res.data or [])]
    wrong_by_chapter: dict[tuple, int] = {}
    if wrong_ids:
        tq_res = sb.table("test_questions").select("chapter_name,subject").in_("id", wrong_ids[:200]).execute()
        for r in (tq_res.data or []):
            key = (r["chapter_name"], r["subject"])
            wrong_by_chapter[key] = wrong_by_chapter.get(key, 0) + 1
    
    STATUS_SCORE = {"not_started": 1.0, "learning": 0.8, "revised": 0.5, "comfortable": 0.2, "confident": 0.0}
    
    scored = []
    for (ch, subj), data in chapters.items():
        status = confidence.get((ch, subj), "not_started")
        status_score = STATUS_SCORE.get(status, 0.5)
        weight = SUBJECT_WEIGHT.get(subj, 0.25)
        wrong_score = min(wrong_by_chapter.get((ch, subj), 0) / 10.0, 0.5)  # cap at 0.5
        
        total = (status_score * 0.5) + (weight * 0.3) + (wrong_score * 0.2)
        
        if status == "confident":
            continue  # Don't suggest already-confident chapters
        
        reason = "Not started yet" if status == "not_started" else \
                 "Still learning" if status == "learning" else \
                 "Needs revision" if wrong_by_chapter.get((ch, subj), 0) > 0 else \
                 "Could use more practice"
        
        scored.append(Suggestion(
            chapter_name=ch,
            subject=subj,
            confidence_status=status,
            reason=reason,
            score=round(total, 4),
        ))
    
    scored.sort(key=lambda x: x.score, reverse=True)
    return scored[:top_n]
