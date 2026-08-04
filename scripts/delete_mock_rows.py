"""
Delete initial mock/seed development rows (IDs 1, 2, 3, 4, 5) from study_sessions.
"""
from backend.deps import get_supabase

def delete_mock_rows():
    sb = get_supabase()
    # Delete initial mock development test rows
    res = sb.table("study_sessions").delete().in_("id", [1, 2, 3, 4, 5]).execute()
    deleted_count = len(res.data) if res.data else 0
    print(f"[SUCCESS] Deleted {deleted_count} mock development rows (IDs 1-5).")

if __name__ == "__main__":
    delete_mock_rows()
