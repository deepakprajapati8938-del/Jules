"""
backend/routers/tests.py — Test generator: generate, fetch, submit, tag mistakes.
NEET scoring: +4 correct, -1 wrong, 0 unattempted.
"""
import random
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Literal, Optional
from supabase import Client

from backend.deps import get_supabase

router = APIRouter(prefix="/tests", tags=["tests"])

ValidTestType = Literal["chapter", "subject", "custom", "mock"]
ValidMistakeType = Literal["silly_mistake", "concept_gap", "didnt_know"]

# ── Pydantic models ────────────────────────────────────────────────────────────

class GenerateTestRequest(BaseModel):
    test_type: ValidTestType
    subject: Optional[str] = None
    chapter_name: Optional[str] = None
    num_questions: int = 30
    duration_mins: int = 60

class QuestionOut(BaseModel):
    id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    subject: str
    chapter_name: Optional[str] = None
    source_type: str

class TestOut(BaseModel):
    test_id: int
    attempt_id: int
    test_type: str
    duration_mins: int
    questions: list[QuestionOut]

class AnswerSubmit(BaseModel):
    question_id: int
    chosen_ans: Optional[Literal["A","B","C","D"]] = None  # None = unattempted
    time_taken_seconds: int = 0
    marked_for_review: bool = False

class SubmitRequest(BaseModel):
    answers: list[AnswerSubmit]

class SubmitResult(BaseModel):
    score: float
    total_marks: int
    correct: int
    wrong: int
    unattempted: int
    breakdown: dict

class MistakeTag(BaseModel):
    mistake_type: ValidMistakeType

# ── Helpers ────────────────────────────────────────────────────────────────────

def _fetch_questions(sb: Client, req: GenerateTestRequest) -> list[dict]:
    """Pull random questions from neet_chunks (PYQ source_type) respecting filters."""
    q = sb.table("neet_chunks").select(
        "id,content,metadata"
    ).eq("syllabus_excluded", False)
    
    if req.test_type == "chapter" and req.chapter_name:
        q = q.filter("metadata->>chapter", "eq", req.chapter_name)
    elif req.test_type == "subject" and req.subject:
        q = q.filter("metadata->>subject", "eq", req.subject)
    # mock/custom: no filter — full bank
    
    res = q.eq("metadata->>source_type", "PYQ").limit(500).execute()
    rows = res.data or []
    random.shuffle(rows)
    return rows[:req.num_questions]

# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=TestOut)
def generate_test(req: GenerateTestRequest, sb: Client = Depends(get_supabase)):
    """Generate a test and create a test attempt."""
    chunks = _fetch_questions(sb, req)
    if not chunks:
        raise HTTPException(status_code=404, detail="No questions found for the given filters.")
    
    # Create test record
    test_res = sb.table("tests").insert({
        "test_type": req.test_type,
        "subject": req.subject,
        "chapter_name": req.chapter_name,
        "total_marks": len(chunks) * 4,
        "duration_mins": req.duration_mins,
    }).execute()
    test_id = test_res.data[0]["id"]
    
    # Insert questions
    questions_out = []
    for i, chunk in enumerate(chunks):
        meta = chunk.get("metadata") or {}
        # For PYQ chunks, content IS the question text (already chunked per-question)
        options = meta.get("options", {})
        q_insert = {
            "test_id": test_id,
            "chunk_id": chunk["id"],
            "question_text": chunk["content"][:1000],
            "option_a": options.get("A", "See source material"),
            "option_b": options.get("B", "See source material"),
            "option_c": options.get("C", "See source material"),
            "option_d": options.get("D", "See source material"),
            "correct_ans": meta.get("correct_ans", "A"),
            "subject": meta.get("subject", ""),
            "chapter_name": meta.get("chapter"),
            "source_type": meta.get("source_type", "PYQ"),
            "display_order": i,
        }
        q_res = sb.table("test_questions").insert(q_insert).execute()
        q_data = q_res.data[0]
        questions_out.append(QuestionOut(
            id=q_data["id"],
            question_text=q_data["question_text"],
            option_a=q_data["option_a"],
            option_b=q_data["option_b"],
            option_c=q_data["option_c"],
            option_d=q_data["option_d"],
            subject=q_data["subject"],
            chapter_name=q_data.get("chapter_name"),
            source_type=q_data["source_type"],
        ))
    
    # Create attempt
    attempt_res = sb.table("test_attempts").insert({"test_id": test_id}).execute()
    attempt_id = attempt_res.data[0]["id"]
    
    return TestOut(
        test_id=test_id,
        attempt_id=attempt_id,
        test_type=req.test_type,
        duration_mins=req.duration_mins,
        questions=questions_out,
    )

@router.get("/{test_id}", response_model=list[QuestionOut])
def get_test(test_id: int, sb: Client = Depends(get_supabase)):
    res = sb.table("test_questions").select("*").eq("test_id", test_id).order("display_order").execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Test not found.")
    return [QuestionOut(**{k: r[k] for k in QuestionOut.model_fields}) for r in res.data]

@router.post("/{test_id}/submit", response_model=SubmitResult)
def submit_test(test_id: int, body: SubmitRequest, sb: Client = Depends(get_supabase)):
    """Submit answers. NEET scoring: +4 correct, -1 wrong, 0 unattempted."""
    # Get active attempt
    att_res = sb.table("test_attempts").select("*").eq("test_id", test_id).eq("is_completed", False).limit(1).execute()
    if not att_res.data:
        raise HTTPException(status_code=404, detail="No active attempt found for this test.")
    attempt = att_res.data[0]
    
    # Get correct answers
    q_res = sb.table("test_questions").select("id,correct_ans").eq("test_id", test_id).execute()
    correct_map = {r["id"]: r["correct_ans"] for r in (q_res.data or [])}
    
    correct = wrong = unattempted = 0
    breakdown: dict[str, dict] = {}
    
    for ans in body.answers:
        qid = ans.question_id
        correct_ans = correct_map.get(qid)
        is_correct = None
        
        if ans.chosen_ans is None:
            unattempted += 1
        elif ans.chosen_ans == correct_ans:
            correct += 1
            is_correct = True
        else:
            wrong += 1
            is_correct = False
        
        sb.table("question_attempts").insert({
            "test_attempt_id": attempt["id"],
            "test_question_id": qid,
            "chosen_ans": ans.chosen_ans,
            "is_correct": is_correct,
            "time_taken_seconds": ans.time_taken_seconds,
            "marked_for_review": ans.marked_for_review,
        }).execute()
        breakdown[str(qid)] = {"chosen": ans.chosen_ans, "correct": correct_ans, "is_correct": is_correct}
    
    score = (correct * 4) + (wrong * -1)
    total_marks = len(correct_map) * 4
    
    from datetime import datetime, timezone
    sb.table("test_attempts").update({
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "is_completed": True,
        "score": score,
        "total_marks": total_marks,
    }).eq("id", attempt["id"]).execute()
    
    return SubmitResult(
        score=score, total_marks=total_marks,
        correct=correct, wrong=wrong, unattempted=unattempted,
        breakdown=breakdown,
    )

@router.patch("/{test_id}/questions/{question_id}/mistake")
def tag_mistake(
    test_id: int,
    question_id: int,
    body: MistakeTag,
    sb: Client = Depends(get_supabase),
):
    """Tag a wrong answer with a mistake type (student action after reviewing)."""
    sb.table("question_attempts").update({"mistake_type": body.mistake_type}).eq(
        "test_question_id", question_id
    ).execute()
    return {"question_id": question_id, "mistake_type": body.mistake_type}
