from fastapi import APIRouter, Depends
from supabase import Client
from datetime import datetime, timedelta, timezone
from backend.deps import get_supabase
from pydantic import BaseModel
import json
import random
from src.llm_wrapper import call_llm

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

class StudyTrend(BaseModel):
    date: str
    minutes: int

class SubjectBalance(BaseModel):
    physics: int
    chemistry: int
    biology: int

class DashboardStatsResponse(BaseModel):
    progress_percentage: int
    study_trend: list[StudyTrend]
    total_study_minutes_7d: int
    neglected_chapters: list[str]
    subject_balance: SubjectBalance

@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(sb: Client = Depends(get_supabase)):
    # 1. Calculate Marks-Weighted Progress
    # Get all included chapters and their weightage
    syl_res = sb.table("syllabus_config").select("chapter_name, subject, weightage_marks").eq("included", True).execute()
    syl_chapters = {r["chapter_name"]: (r["weightage_marks"] or 0) for r in (syl_res.data or [])}
    syl_subjects = {r["chapter_name"]: r["subject"] for r in (syl_res.data or [])}
    
    # Get user confidence
    conf_res = sb.table("chapter_confidence").select("chapter_name, status").execute()
    
    total_syllabus_marks = sum(syl_chapters.values())
    mastered_marks = 0
    
    if total_syllabus_marks > 0:
        for r in (conf_res.data or []):
            if r["status"] in ["comfortable", "confident"]:
                mastered_marks += syl_chapters.get(r["chapter_name"], 0)
                
        progress = int((mastered_marks / total_syllabus_marks) * 100)
    else:
        progress = 0

    # 2. Calculate Study Time Trend (Last 7 Days)
    # We will sum `time_taken_seconds` from `question_attempts` grouped by the day the `test_attempts` was started
    # Note: For simplicity, we just fetch the last 7 days of attempts
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=6)
    
    study_by_day = { (now - timedelta(days=i)).strftime("%a"): 0 for i in range(6, -1, -1) }
    subject_times = {"Physics": 0, "Chemistry": 0, "Biology": 0}
                
    # Also fetch manual study sessions from daily log
    sessions_res = sb.table("study_sessions").select("created_at, time_spent_mins, subject, chapter_name").gte("created_at", seven_days_ago.isoformat()).execute()
    for s in (sessions_res.data or []):
        dt = datetime.fromisoformat(s["created_at"].replace('Z', '+00:00'))
        day_str = dt.strftime("%a")
        if day_str in study_by_day:
            time_sec = (s["time_spent_mins"] or 0) * 60
            study_by_day[day_str] += time_sec
            
            subj = s.get("subject")
            if not subj and s.get("chapter_name"):
                subj = syl_subjects.get(s.get("chapter_name"))
            if subj in ["Physics", "Chemistry", "Biology"]:
                subject_times[subj] += time_sec
                
    study_trend = []
    total_minutes_7d = 0
    for day_str, seconds in study_by_day.items():
        mins = seconds // 60
        study_trend.append(StudyTrend(date=day_str, minutes=mins))
        total_minutes_7d += mins

    # Force chronological order (6 days ago -> today)
    ordered_trend = []
    for i in range(6, -1, -1):
        d_str = (now - timedelta(days=i)).strftime("%a")
        ordered_trend.append(next(item for item in study_trend if item.date == d_str))

    # 3. Calculate Neglected Chapters
    # Chapters that are included but haven't been logged in study_sessions in the last 14 days
    fourteen_days_ago = now - timedelta(days=14)
    recent_sessions = sb.table("study_sessions").select("chapter_name").gte("created_at", fourteen_days_ago.isoformat()).execute()
    recent_chapters = {s["chapter_name"] for s in (recent_sessions.data or [])}
    
    neglected_chapters = []
    # Sort included chapters, we will just pick a few that aren't in recent_chapters
    for ch in syl_chapters.keys():
        if ch not in recent_chapters:
            neglected_chapters.append(ch)
            if len(neglected_chapters) >= 3:
                break

    return DashboardStatsResponse(
        progress_percentage=progress,
        study_trend=ordered_trend,
        total_study_minutes_7d=total_minutes_7d,
        neglected_chapters=neglected_chapters,
        subject_balance=SubjectBalance(
            physics=int(subject_times.get("Physics", 0) // 60),
            chemistry=int(subject_times.get("Chemistry", 0) // 60),
            biology=int(subject_times.get("Biology", 0) // 60)
        )
    )

class QuickMCQResponse(BaseModel):
    question: str
    options: list[str]
    correct_answer_index: int
    explanation: str

@router.get("/quick-mcq", response_model=QuickMCQResponse)
def get_quick_mcq(sb: Client = Depends(get_supabase)):
    # 1. Fetch a random fact from the database
    # Fetch a block and pick one randomly
    res = sb.table("ncert_facts").select("fact_text, chapter_name, subject").limit(200).execute()
    facts = res.data or []
    
    if not facts:
        # Fallback
        return QuickMCQResponse(
            question="Which of the following is true about Jules?",
            options=["It is a NEET prep app", "It is a game", "It is a social network", "It is a search engine"],
            correct_answer_index=0,
            explanation="Jules is your personal NEET prep tool."
        )
        
    fact = random.choice(facts)
    
    # 2. Call LLM to generate MCQ
    system_prompt = (
        "You are an expert NEET biology/chemistry/physics tutor. "
        "Generate exactly ONE multiple choice question based on the provided fact. "
        "The question must be challenging but fair. Provide exactly 4 options. "
        "Return your response ONLY as a valid JSON object matching this schema:\n"
        "{\n"
        '  "question": "The question text",\n'
        '  "options": ["A", "B", "C", "D"],\n'
        '  "correct_answer_index": 0,\n'
        '  "explanation": "Short explanation of why this is correct"\n'
        "}\n"
        "Do not include markdown blocks or any other text."
    )
    user_prompt = f"Fact: {fact['fact_text']}\nSubject: {fact['subject']}\nChapter: {fact['chapter_name']}"
    
    try:
        response_text = call_llm(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            model_name="gemini-3.5-flash-lite",
            max_retries=2
        )
        # Strip markdown formatting if the model still outputs it
        cleaned_text = response_text.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned_text)
        
        return QuickMCQResponse(
            question=data.get("question", "Failed to parse question"),
            options=data.get("options", ["A", "B", "C", "D"]),
            correct_answer_index=int(data.get("correct_answer_index", 0)),
            explanation=data.get("explanation", "Failed to parse explanation")
        )
    except Exception as e:
        import logging
        logging.error(f"Failed to generate quick MCQ: {e}")
        return QuickMCQResponse(
            question=f"Fact: {fact['fact_text']}. What is the correct conclusion?",
            options=["True", "False", "Not mentioned", "None of the above"],
            correct_answer_index=0,
            explanation="Error generating question via LLM."
        )
