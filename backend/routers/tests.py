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

import base64
import json
from fastapi import UploadFile, File

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

RAW_CHAPTER_ALIASES = {
    # Chemistry
    "Redox Reaction": "Redox Reactions",
    "Hydrocarbon": "Hydrocarbons",
    "Atomic Structure": "Structure Of Atom",
    "Organic Chemistry: GOC": "Organic Chemistry Some Basic Principles",
    "Organic Chemistry: IUPAC Nomenclature": "Organic Chemistry Some Basic Principles",
    "Organic Chemistry: Isomerism": "Organic Chemistry Some Basic Principles",
    
    # Physics
    "Work, Energy & Power": "Work Energy And Power",
    "Centre of mass and System of Particles": "Centre Of Mass And Rotational Motion",
    "Rotational Motion": "Centre Of Mass And Rotational Motion",
    
    # Botany
    "Sexual Reproduction in Flowering Plant": "Sexual Reproduction In Flowering Plants",
    "Principle of Inheritance and Variation": "Principles Of Inheritance",
    "Organisms and Population": "Organisms And Populations",
    
    # Zoology
    "Structural Organization in Animals": "Structural Organisation In Animals",
    "Excretory Products & their Elimination": "Excretory Products",
    "Chemical Coordination & Integration": "Chemical Coordination",
    "Human Health and Diseases": "Human Health And Disease",
    "Biotechnology: Principles & Processes": "Biotechnology Principles",
    "Biotechnology and its Applications": "Biotechnology Applications",
}

def _fetch_questions(sb: Client, req: GenerateTestRequest) -> list[dict]:
    """Pull random questions from neet_chunks (PYQ source_type) respecting filters."""
    q = sb.table("neet_chunks").select(
        "id,content,metadata"
    ).eq("syllabus_excluded", False)
    
    if req.test_type == "chapter" and req.chapter_name:
        db_chapter = RAW_CHAPTER_ALIASES.get(req.chapter_name, req.chapter_name)
        q = q.filter("metadata->>chapter", "eq", db_chapter)
    elif req.test_type == "subject" and req.subject:
        q = q.filter("metadata->>subject", "eq", req.subject)
    # mock/custom: no filter — full bank
    
    res = q.filter("metadata->>source_type", "eq", "PYQ").limit(500).execute()
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

@router.post("/generate-from-pdf", response_model=TestOut)
async def generate_test_from_pdf(
    file: UploadFile = File(...),
    answer_key_file: Optional[UploadFile] = File(None),
    sb: Client = Depends(get_supabase)
):
    """Generate a test by extracting questions from an uploaded PDF using Gemini Vision."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    file_bytes = await file.read()
    # Increased limit to 20MB for full mock tests
    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 20MB limit.")
        
    import fitz
    import concurrent.futures
    from src.llm_wrapper import call_llm
    
    # Split PDF into chunks of 4 pages
    chunk_size = 4
    b64_chunks = []
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for i in range(0, len(doc), chunk_size):
            chunk_doc = fitz.open()
            chunk_doc.insert_pdf(doc, from_page=i, to_page=min(i + chunk_size - 1, len(doc) - 1))
            chunk_bytes = chunk_doc.write()
            b64_chunks.append(base64.b64encode(chunk_bytes).decode("utf-8"))
            chunk_doc.close()
        doc.close()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process PDF file: {e}")

    answer_key_dict_str = ""
    if answer_key_file and answer_key_file.filename and answer_key_file.filename.lower().endswith(".pdf"):
        ak_bytes = await answer_key_file.read()
        if len(ak_bytes) <= 5 * 1024 * 1024:
            ak_b64 = base64.b64encode(ak_bytes).decode("utf-8")
            ak_prompt = (
                "Extract the answer key from this document. "
                "Return the output STRICTLY as a JSON dictionary where keys are question numbers (as strings) "
                'and values are the correct option ("A", "B", "C", or "D"). '
                "Do not include any explanation or markdown outside the JSON."
            )
            try:
                ak_res = call_llm(
                    system_prompt="You are an expert answer key extractor.",
                    user_prompt=ak_prompt,
                    attachment_data=ak_b64,
                    attachment_mime_type="application/pdf"
                )
                ak_clean = ak_res.strip()
                if ak_clean.startswith("```json"): ak_clean = ak_clean[7:]
                if ak_clean.endswith("```"): ak_clean = ak_clean[:-3]
                # Validate it's parseable
                json.loads(ak_clean.strip())
                answer_key_dict_str = f" Use this provided answer key to assign the correct answer to each extracted question: {ak_clean.strip()}."
            except Exception as e:
                print(f"Failed to process answer key: {e}")

    system_prompt = (
        "You are an expert test extractor. The user has provided a chunk of a PDF test paper. "
        "Your task is to extract ONLY the multiple choice questions that are visibly present in this specific chunk. "
        "CRITICAL INSTRUCTION: DO NOT generate, make up, or hallucinate any additional questions. Stop extracting exactly when you reach the end of the provided pages. "
        "If there is an answer key provided in the document, map the correct answers to the questions. "
        "If no answer key is found, you must SOLVE the questions to determine the correct answers. "
        f"{answer_key_dict_str} "
        "Return the output STRICTLY as a JSON list of objects, without any markdown formatting or explanation outside the JSON. "
        "Each object must have exactly these keys: "
        '"question_text" (string), "option_a" (string), "option_b" (string), "option_c" (string), "option_d" (string), '
        '"correct_ans" (must be strictly "A", "B", "C", or "D"). '
        "Do not include question numbers in question_text."
    )
    
    def process_chunk(b64_data):
        try:
            response_text = call_llm(
                system_prompt=system_prompt,
                user_prompt="Extract questions and answers to JSON.",
                attachment_data=b64_data,
                attachment_mime_type="application/pdf"
            )
            cleaned = response_text.strip()
            if cleaned.startswith("```json"): cleaned = cleaned[7:]
            if cleaned.endswith("```"): cleaned = cleaned[:-3]
            return json.loads(cleaned.strip())
        except Exception as e:
            print(f"Chunk processing failed: {e}")
            return []

    # Run chunks concurrently
    extracted_qas = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        results = executor.map(process_chunk, b64_chunks)
        for res in results:
            if isinstance(res, list):
                extracted_qas.extend(res)
                
    if not extracted_qas:
        raise HTTPException(status_code=400, detail="Could not extract any questions from the PDF.")

    # Deduplicate based on question_text to prevent LLM overlap or repetition
    seen_texts = set()
    unique_qas = []
    for q in extracted_qas:
        q_text = q.get("question_text", "").strip().lower()
        if q_text and q_text not in seen_texts:
            seen_texts.add(q_text)
            unique_qas.append(q)
            
    extracted_qas = unique_qas

    # Cap at 220
    if len(extracted_qas) > 220:
        extracted_qas = extracted_qas[:220]
        
    duration_mins = max(10, int(len(extracted_qas) * 1.5))
        
    test_res = sb.table("tests").insert({
        "test_type": "custom",
        "subject": "PDF Upload",
        "chapter_name": file.filename[:50],
        "total_marks": len(extracted_qas) * 4,
        "duration_mins": duration_mins,
    }).execute()
    test_id = test_res.data[0]["id"]
    
    questions_out = []
    for i, q in enumerate(extracted_qas):
        q_insert = {
            "test_id": test_id,
            "chunk_id": None,
            "question_text": str(q.get("question_text", "Missing question text"))[:1000],
            "option_a": str(q.get("option_a", "N/A"))[:500],
            "option_b": str(q.get("option_b", "N/A"))[:500],
            "option_c": str(q.get("option_c", "N/A"))[:500],
            "option_d": str(q.get("option_d", "N/A"))[:500],
            "correct_ans": q.get("correct_ans", "A") if q.get("correct_ans") in ["A","B","C","D"] else "A",
            "subject": "Unknown",
            "chapter_name": file.filename[:50],
            "source_type": "PYQ",
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
        
    attempt_res = sb.table("test_attempts").insert({"test_id": test_id}).execute()
    attempt_id = attempt_res.data[0]["id"]
    
    return TestOut(
        test_id=test_id,
        attempt_id=attempt_id,
        test_type="custom",
        duration_mins=duration_mins,
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
