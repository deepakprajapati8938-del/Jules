"""
Batch ingestion script for all NCERT PDFs.
Reads from data/ncert/<Subject>/<ClassNN_ChNN_ChapterName>.pdf
"""
import sys
import logging
import re
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.pdf_to_markdown import pdf_to_markdown
from src.chunker import chunk_markdown
from src.embedder import embed_and_store, clear_chapter_chunks

logging.basicConfig(level=logging.INFO, format='%(asctime)s  %(levelname)-8s  %(message)s', datefmt='%H:%M:%S')
logger = logging.getLogger(__name__)

def parse_filename(filepath: Path):
    """
    Parses two filename formats:
    1. Class{11|12}_Ch{NN}_{ChapterNameNoSpaces}.pdf  e.g. Class11_Ch01_TheLivingWorld.pdf
    2. Plain descriptive name e.g. Gravitation.pdf, Solutions.pdf, HYDROCARBONS.pdf

    Returns (subject, chapter_name) or (None, None) if it's a junk file to skip.
    """
    subject = filepath.parent.name
    filename = filepath.stem

    # Skip files that are clearly appendix/answer/reference material
    # NOTE: Be specific — avoid words that appear in real chapter names
    SKIP_KEYWORDS = ["answer to ", "appendix", "answers to some", "answer to some",
                     "definitions of the si", "atomic number and molar",
                     "selected problems"]
    if any(kw in filename.lower() for kw in SKIP_KEYWORDS):
        return None, None

    # Format 1: Class11_Ch01_TheLivingWorld
    match = re.match(r"^Class(11|12)_Ch\d+_(.+)$", filename)
    if match:
        chapter_camel = match.group(2)
        # Convert CamelCase to spaces: TheLivingWorld -> The Living World
        chapter_name = re.sub(r'([A-Z])', r' \1', chapter_camel).strip()
        chapter_name = re.sub(r'\s+', ' ', chapter_name)
        return subject, chapter_name

    # Format 2: Plain descriptive name (Gravitation, Solutions, HYDROCARBONS, etc.)
    # Convert to Title Case, replace underscores/hyphens with spaces
    chapter_name = filename.replace('_', ' ').replace('-', ' ')
    chapter_name = chapter_name.title().strip()
    chapter_name = re.sub(r'\s+', ' ', chapter_name)
    return subject, chapter_name

def main():
    data_dir = Path("data/ncert")
    if not data_dir.exists():
        logger.error(f"Directory {data_dir} does not exist.")
        sys.exit(1)
        
    pdf_files = [
        p for p in data_dir.rglob("*.pdf")
        if "_skip" not in p.parts  # exclude appendix/junk folders
    ]
    if not pdf_files:
        logger.warning(f"No PDFs found in {data_dir}")
        sys.exit(0)
        
    logger.info(f"Found {len(pdf_files)} PDF files to process.")
    
    results = []
    
    for pdf_path in pdf_files:
        logger.info("-" * 60)
        logger.info(f"Processing: {pdf_path.name}")
        
        subject, chapter_name = parse_filename(pdf_path)
        if not subject or not chapter_name:
            logger.warning(f"Skipping {pdf_path.name} - does not match naming convention Class{{11|12}}_Ch{{NN}}_{{ChapterNameNoSpaces}}.pdf")
            results.append({"file": pdf_path.name, "status": "SKIPPED", "chunks": 0, "error": "Invalid filename format"})
            continue
            
        logger.info(f"Extracted -> Subject: {subject}, Chapter: {chapter_name}")
        
        # Check if already ingested — use count-only query, don't fetch rows
        from src.embedder import _get_supabase
        sb = _get_supabase()
        already_ingested = False
        for attempt in range(3):
            try:
                existing = sb.table("neet_chunks").select("id", count="exact", head=True)\
                    .filter("metadata->>chapter", "eq", chapter_name).execute()
                if existing.count and existing.count > 4:  # require >4 chunks — avoids re-skipping thin/bad entries
                    logger.info(f"  Skipping '{chapter_name}' — already ingested ({existing.count} chunks).")
                    results.append({"file": pdf_path.name, "status": "SKIPPED", "chunks": existing.count, "error": "Already ingested"})
                    already_ingested = True
                break
            except Exception as e:
                logger.warning(f"  Supabase check failed (attempt {attempt+1}/3): {e}")
                import time; time.sleep(5)
        if already_ingested:
            continue
            
        try:
            # 1. PDF -> Markdown
            md_text, md_path = pdf_to_markdown(str(pdf_path), subject, chapter_name)
            
            # 2. Chunking
            chunks = chunk_markdown(md_text, subject=subject, chapter_override=chapter_name)
            
            # Clear existing rows for this chapter to avoid duplicates
            clear_chapter_chunks(chapter_name)
            # 3. Embedding and storing
            embed_and_store(chunks)
            
            results.append({"file": pdf_path.name, "status": "SUCCESS", "chunks": len(chunks), "error": ""})
            
        except Exception as e:
            logger.error(f"Failed processing {pdf_path.name}: {e}", exc_info=True)
            results.append({"file": pdf_path.name, "status": "FAILED", "chunks": 0, "error": str(e)})

    # Print summary table
    logger.info("=" * 80)
    logger.info("BATCH INGESTION SUMMARY")
    logger.info("=" * 80)
    logger.info(f"{'File':<40} | {'Status':<10} | {'Chunks':<8} | {'Error'}")
    logger.info("-" * 80)
    for r in results:
        err = r["error"][:25] + "..." if len(r["error"]) > 25 else r["error"]
        logger.info(f"{r['file']:<40} | {r['status']:<10} | {r['chunks']:<8} | {err}")
    logger.info("=" * 80)

if __name__ == "__main__":
    main()
