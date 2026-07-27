import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.embedder import _get_supabase

def cleanup_db():
    sb = _get_supabase()
    
    # 1. Delete junk appendix files that got ingested from _skip folder
    junk_chapters = [
        'Keph1A1','Keph1An','Keph1Ps','Keph2An','Keph2Ps',
        'Leph1An','Leph1Ps','Leph2An','Leph2Ps',
        'Kech1Ps','Kech2Ps','Lech1Ps','Lech2Ps',
        'Kebo1Ps','Lebo1Ps'
    ]
    
    print("Deleting junk appendix files...")
    for chap in junk_chapters:
        res = sb.table("neet_chunks").delete().filter("metadata->>chapter", "eq", chap).execute()
        if res.data:
            print(f"Deleted {len(res.data)} chunks for {chap}")
            
    # 2. Delete Physics chapters that only got 1-3 chunks (old bad ingest garbage)
    thin_physics_chapters = [
        'Gravitation','Current Electricity',
        'Electromagnetic Induction','Alternating Current',
        'Electromagnetic Waves','Wave Optics','Atoms',
        'Kinetic Theory','Thermodynamics','Oscillations','Waves'
    ]
    
    print("\nDeleting thin Physics chapters...")
    for chap in thin_physics_chapters:
        res = sb.table("neet_chunks").delete()\
            .filter("metadata->>subject", "eq", "Physics")\
            .filter("metadata->>source_type", "eq", "NCERT")\
            .filter("metadata->>chapter", "eq", chap).execute()
        if res.data:
            print(f"Deleted {len(res.data)} chunks for {chap}")
            
    print("\nDone.")

if __name__ == "__main__":
    cleanup_db()
