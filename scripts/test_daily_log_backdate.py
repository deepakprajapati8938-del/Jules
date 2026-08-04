"""
Quick verification script for daily log backdating & history API.
"""
from backend.routers.daily_log import StudySessionCreate, log_session, get_session_history
from backend.deps import get_supabase

def test_daily_log_backdating():
    sb = get_supabase()
    
    # 1. Test logging a backdated session for yesterday
    test_session = StudySessionCreate(
        subject="Biology",
        chapter_name="Principles of Inheritance and Variation",
        time_spent_mins=45,
        notes="Automated test backdated log",
        session_date="2026-08-03"
    )
    
    created = log_session(test_session, sb)
    print("Logged session ID:", created.id)
    print("Created at:", created.created_at)
    assert "2026-08-03" in created.created_at
    
    # 2. Test fetching history with limit
    history = get_session_history(limit=50, subject="Biology", sb=sb)
    print(f"Fetched {len(history)} Biology sessions")
    assert any(s.id == created.id for s in history)
    
    print("[SUCCESS] Backdated Daily Log API test passed!")

if __name__ == "__main__":
    test_daily_log_backdating()
