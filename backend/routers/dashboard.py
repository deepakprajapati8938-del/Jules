from fastapi import APIRouter, Depends
from supabase import Client
from datetime import datetime, timedelta, timezone
from backend.deps import get_supabase
from pydantic import BaseModel

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

class StudyTrend(BaseModel):
    date: str
    minutes: int

class DashboardStatsResponse(BaseModel):
    progress_percentage: int
    study_trend: list[StudyTrend]
    total_study_minutes_7d: int

@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(sb: Client = Depends(get_supabase)):
    # 1. Calculate Marks-Weighted Progress
    # Get all included chapters and their weightage
    syl_res = sb.table("syllabus_config").select("chapter_name, weightage_marks").eq("included", True).execute()
    syl_chapters = {r["chapter_name"]: (r["weightage_marks"] or 0) for r in (syl_res.data or [])}
    
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
    
    # Fetch test attempts in last 7 days
    attempts_res = sb.table("test_attempts").select("id, started_at").gte("started_at", seven_days_ago.isoformat()).execute()
    attempt_ids = [a["id"] for a in (attempts_res.data or [])]
    
    attempt_times = {} # attempt_id -> date string (e.g. "Mon")
    for a in (attempts_res.data or []):
        dt = datetime.fromisoformat(a["started_at"].replace('Z', '+00:00'))
        day_str = dt.strftime("%a") # "Mon", "Tue"
        attempt_times[a["id"]] = day_str
        
    study_by_day = { (now - timedelta(days=i)).strftime("%a"): 0 for i in range(6, -1, -1) }
    
    if attempt_ids:
        # Fetch question attempts for these tests
        q_res = sb.table("question_attempts").select("test_attempt_id, time_taken_seconds").in_("test_attempt_id", attempt_ids).execute()
        for q in (q_res.data or []):
            day_str = attempt_times.get(q["test_attempt_id"])
            if day_str in study_by_day:
                study_by_day[day_str] += (q["time_taken_seconds"] or 0)
                
    # Also fetch manual study sessions from daily log
    sessions_res = sb.table("study_sessions").select("created_at, time_spent_mins").gte("created_at", seven_days_ago.isoformat()).execute()
    for s in (sessions_res.data or []):
        dt = datetime.fromisoformat(s["created_at"].replace('Z', '+00:00'))
        day_str = dt.strftime("%a")
        if day_str in study_by_day:
            study_by_day[day_str] += (s["time_spent_mins"] or 0) * 60  # convert mins to seconds for addition
                
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

    return DashboardStatsResponse(
        progress_percentage=progress,
        study_trend=ordered_trend,
        total_study_minutes_7d=total_minutes_7d
    )
