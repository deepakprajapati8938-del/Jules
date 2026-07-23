import sys
from pathlib import Path

# Add project root to path so we can import src modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.embedder import _get_supabase  # _get_supabase lives in embedder, not config

def seed_syllabus():
    client = _get_supabase()

    # We need to find all unique (chapter, subject) pairs currently in neet_chunks
    print("Fetching distinct chapters from neet_chunks...")
    
    res = client.table("neet_chunks").select("metadata->>chapter, metadata->>subject").execute()
    
    if not res.data:
        print("No chunks found in neet_chunks. Please run NCERT ingestion first.")
        return

    # Extract distinct pairs
    unique_chapters = set()
    for row in res.data:
        ch = row.get("chapter")
        sub = row.get("subject")
        if ch and sub:
            unique_chapters.add((ch, sub))

    print(f"Found {len(unique_chapters)} unique chapters.")

    # The 6 chapters removed from NEET Biology Syllabus (NMC 2024 update).
    # Names must match what parse_filename produces (CamelCase -> space-separated),
    # e.g. "TransportInPlants" -> "Transport In Plants"
    EXCLUDED_CHAPTERS = {
        "Transport In Plants",
        "Mineral Nutrition",
        "Digestion And Absorption",
        "Reproduction In Organisms",
        "Strategies For Enhancement",
        "Environmental Issues"
    }

    # Prepare data for insertion
    rows_to_insert = []
    for ch, sub in unique_chapters:
        # Automatically flag the known excluded chapters
        is_included = ch not in EXCLUDED_CHAPTERS
        
        rows_to_insert.append({
            "chapter_name": ch,
            "subject": sub,
            "included": is_included,
            "weightage_marks": None
        })
        
    if not rows_to_insert:
        print("No data to insert.")
        return

    print(f"Inserting {len(rows_to_insert)} rows into syllabus_config...")
    
    # Upsert data into syllabus_config
    insert_res = client.table("syllabus_config").upsert(rows_to_insert, on_conflict="chapter_name").execute()
    
    print("\n--- SYLLABUS CONFIG SEEDED ---")
    print(f"Total rows seeded: {len(insert_res.data)}")
    
    # Print which ones are excluded
    excluded = [r for r in rows_to_insert if not r["included"]]
    print(f"Chapters marked as excluded ({len(excluded)}):")
    for r in excluded:
        print(f"  - [{r['subject']}] {r['chapter_name']}")

if __name__ == "__main__":
    seed_syllabus()
