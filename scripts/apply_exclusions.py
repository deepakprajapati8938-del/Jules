import sys
import os
from pathlib import Path

# Add project root to path so we can import src.config
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config import _get_supabase

def apply_exclusions():
    client = _get_supabase()

    # 1. Fetch excluded chapters from syllabus_config
    print("Fetching excluded chapters from syllabus_config...")
    res = client.table("syllabus_config").select("chapter_name").eq("included", False).execute()
    
    if not res.data:
        print("No excluded chapters found in syllabus_config. Nothing to update.")
        return

    excluded_chapters = [row["chapter_name"] for row in res.data]
    print(f"Found {len(excluded_chapters)} excluded chapter(s):")
    for ch in excluded_chapters:
        print(f"  - {ch}")
    
    # 2. Count affected rows in neet_chunks by source_type
    print("\nCalculating affected rows in neet_chunks...")
    ncert_affected = 0
    pyq_affected = 0
    
    for ch in excluded_chapters:
        # We fetch exact counts. PostgREST allows count='exact'
        ncert_res = client.table("neet_chunks").select("id", count="exact").eq("metadata->>chapter", ch).eq("metadata->>source_type", "NCERT").execute()
        pyq_res = client.table("neet_chunks").select("id", count="exact").eq("metadata->>chapter", ch).eq("metadata->>source_type", "PYQ").execute()
        
        ncert_affected += ncert_res.count if ncert_res.count else 0
        pyq_affected += pyq_res.count if pyq_res.count else 0
        
    total_affected = ncert_affected + pyq_affected
    
    print("=" * 50)
    print("EXCLUSION UPDATE SUMMARY")
    print("=" * 50)
    print(f"NCERT chunks to be excluded: {ncert_affected}")
    print(f"PYQ chunks to be excluded:   {pyq_affected}")
    print(f"TOTAL chunks to be excluded: {total_affected}")
    print("=" * 50)
    
    if total_affected == 0:
        print("No chunks match the excluded chapters. Exiting.")
        return

    # 3. Ask for confirmation before updating
    confirm = input("\nProceed with setting syllabus_excluded = true for these chunks? (y/N): ")
    if confirm.lower() != 'y':
        print("Aborted.")
        return
        
    # 4. Perform the update
    print("\nUpdating rows...")
    updated_count = 0
    for ch in excluded_chapters:
        # Supabase Python client update requires at least one match to not error out on some versions,
        # but eq on JSONB is supported.
        update_res = client.table("neet_chunks").update({"syllabus_excluded": True}).eq("metadata->>chapter", ch).execute()
        updated_count += len(update_res.data)
        
    print(f"Update complete. Successfully flagged {updated_count} chunks as excluded.")

if __name__ == "__main__":
    apply_exclusions()
