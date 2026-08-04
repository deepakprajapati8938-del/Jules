"""
Inspect all rows in study_sessions table.
"""
from backend.deps import get_supabase

def inspect_logs():
    sb = get_supabase()
    res = sb.table("study_sessions").select("*").order("created_at", desc=True).execute()
    data = res.data or []
    print(f"Total rows in study_sessions: {len(data)}")
    for r in data:
        print(r)

if __name__ == "__main__":
    inspect_logs()
