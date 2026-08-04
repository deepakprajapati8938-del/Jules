"""
Clean up test rows created by automated test scripts in study_sessions table.
"""
from backend.deps import get_supabase

def clean_test_logs():
    sb = get_supabase()
    
    # Delete rows with notes containing "Automated test"
    res = sb.table("study_sessions").delete().like("notes", "%Automated test%").execute()
    deleted_count = len(res.data) if res.data else 0
    print(f"[SUCCESS] Deleted {deleted_count} automated test entries from study_sessions table.")

if __name__ == "__main__":
    clean_test_logs()
