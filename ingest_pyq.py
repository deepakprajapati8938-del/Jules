"""
Batch ingestion script for NEET PYQ PDFs.
Reads from data/pyq/<YYYY>_<Subject>.pdf
"""
import sys
import logging
import re
import json
import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.pdf_to_markdown import pdf_to_markdown
from src.embedder import embed_and_store, _get_gemini, _get_supabase
from src.config import GEMINI_TEXT_MODEL

logging.basicConfig(level=logging.INFO, format='%(asctime)s  %(levelname)-8s  %(message)s', datefmt='%H:%M:%S')
logger = logging.getLogger(__name__)

def parse_pyq_filename(filepath: Path):
    """
    Parses {Year}_{Subject}.pdf or {Year}_{Subject}_{N}.pdf
    The trailing _{N} is an optional dedup suffix added by the rename script.
    """
    filename = filepath.stem
    match = re.match(r"^(\d{4})_([A-Za-z]+)(?:_\d+)?$", filename)
    if not match:
        return None, None
    year = int(match.group(1))
    subject = match.group(2)
    return year, subject

def chunk_pyq_markdown(md_text: str):
    """
    Chunks a PYQ Markdown document by individual questions.
    Looks for patterns like '1. ', '2. ', 'Q1.', etc. at the start of lines.
    """
    # Regex to match question start: newline followed by a number and dot, e.g. "\n12. " or "\nQ12. "
    question_pattern = re.compile(r'\n(?:Q\.?\s*)?(\d+)\.\s')
    
    # Split the document
    parts = question_pattern.split('\n' + md_text)
    
    # parts[0] is everything before the first question (e.g. instructions)
    # parts[1], parts[3], parts[5]... are question numbers
    # parts[2], parts[4], parts[6]... are the question contents
    
    chunks = []
    
    # If no questions found, just return the whole thing as one chunk
    if len(parts) < 3:
        if md_text.strip():
            chunks.append({"content": md_text.strip(), "q_num": "Unknown"})
        return chunks
        
    for i in range(1, len(parts), 2):
        q_num = parts[i]
        q_content = parts[i+1].strip()
        # Reconstruct the question string
        full_content = f"Question {q_num}. {q_content}"
        chunks.append({
            "content": full_content,
            "q_num": q_num
        })
        
    return chunks

def get_ncert_chapters(subject: str):
    """Fetch the list of valid NCERT chapters for a given subject."""
    client = _get_supabase()
    res = client.table("syllabus_config").select("chapter_name").eq("subject", subject).execute()
    return [row["chapter_name"] for row in res.data]

def map_chapters_llm(chunks, chapters, subject):
    """
    Uses Gemini to map a batch of questions to chapters.
    """
    if not chapters:
        # If no chapters in syllabus config, fallback
        for c in chunks:
            c["mapped_chapter"] = "Unknown"
            c["confidence"] = "low"
        return

    client = _get_gemini()
    
    prompt = f"""
    You are an expert NEET faculty in {subject}.
    I have a list of NCERT chapters for {subject}:
    {json.dumps(chapters)}
    
    I will provide {len(chunks)} previous year questions. Map EACH question to the single most appropriate NCERT chapter from the list above.
    If you are highly confident, set confidence to "high". If the question spans multiple chapters or doesn't clearly fit any, pick the best one and set confidence to "low".
    
    Questions:
    """
    for i, c in enumerate(chunks):
        content_preview = c["content"][:200].replace('\n', ' ')
        prompt += f"\n[ID: {i}] {content_preview}..."
        
    prompt += """
    
    Return ONLY a JSON array of objects, strictly in this format, with one object per question ID:
    [
      {"id": 0, "chapter": "Exact Chapter Name from the list", "confidence": "high"},
      ...
    ]
    """
    
    try:
        response = client.models.generate_content(
            model=GEMINI_TEXT_MODEL,
            contents=prompt
        )
        text = response.text
        # Extract JSON
        json_str = text[text.find('['):text.rfind(']')+1]
        mappings = json.loads(json_str)
        
        for m in mappings:
            idx = m["id"]
            if 0 <= idx < len(chunks):
                chunks[idx]["mapped_chapter"] = m.get("chapter", "Unknown")
                chunks[idx]["confidence"] = m.get("confidence", "low").lower()
                
    except Exception as e:
        logger.error(f"LLM mapping failed: {e}")
        for c in chunks:
            c["mapped_chapter"] = "Unknown"
            c["confidence"] = "low"

def main():
    data_dir = Path("data/pyq")
    if not data_dir.exists():
        logger.error(f"Directory {data_dir} does not exist.")
        sys.exit(1)
        
    pdf_files = list(data_dir.rglob("*.pdf"))
    if not pdf_files:
        logger.warning(f"No PYQ PDFs found in {data_dir}")
        sys.exit(0)
        
    logger.info(f"Found {len(pdf_files)} PYQ PDF files to process.")
    
    low_confidence_log = []
    
    for pdf_path in pdf_files:
        logger.info("-" * 60)
        logger.info(f"Processing: {pdf_path.name}")
        
        year, subject = parse_pyq_filename(pdf_path)
        if not year or not subject:
            logger.warning(f"Skipping {pdf_path.name} - does not match naming convention {{Year}}_{{Subject}}.pdf")
            continue
        logger.info(f"Extracted -> Year: {year}, Subject: {subject}")
        if subject == "Biology":
            logger.info(f"Skipping Biology PYQ: {pdf_path.name} (already perfectly mapped)")
            continue
        
        valid_chapters = get_ncert_chapters(subject)
        if not valid_chapters:
            logger.warning(f"No chapters found in syllabus_config for {subject}. Please run NCERT ingestion and seed_syllabus first.")
            # Continue anyway, chapters will be mapped to Unknown
            
        try:
            # 1. PDF -> Markdown
            md_text, md_path = pdf_to_markdown(str(pdf_path), subject=subject, chapter_name=f"{year}_PYQ")
            
            # 2. Chunking by question
            raw_chunks = chunk_pyq_markdown(md_text)
            logger.info(f"Extracted {len(raw_chunks)} questions via regex chunking.")
            
            if not raw_chunks:
                continue
                
            # 3. Best effort chapter mapping (Batch LLM calls to avoid rate limits)
            BATCH_SIZE = 10
            for i in range(0, len(raw_chunks), BATCH_SIZE):
                batch = raw_chunks[i:i+BATCH_SIZE]
                map_chapters_llm(batch, valid_chapters, subject)
                time.sleep(2) # Respect free tier rate limits (15 RPM)
                
            # Prepare for embedder
            final_chunks = []
            for c in raw_chunks:
                ch_map = c.get("mapped_chapter", "Unknown")
                conf = c.get("confidence", "low")
                
                if conf == "low":
                    low_confidence_log.append({
                        "file": pdf_path.name,
                        "question": c["content"][:100],
                        "mapped_to": ch_map
                    })
                
                final_chunks.append({
                    "content": c["content"],
                    "metadata": {
                        "source_type": "PYQ",
                        "subject": subject,
                        "chapter": ch_map,
                        "topic": None,
                        "year": year
                    }
                })
            
            # 4. Embedding and storing
            logger.info(f"Embedding {len(final_chunks)} PYQ chunks for {year}_{subject}...")
            embed_and_store(final_chunks)
            
        except Exception as e:
            logger.error(f"Failed processing {pdf_path.name}: {e}", exc_info=True)

    if low_confidence_log:
        logger.info("=" * 80)
        logger.warning(f"LOW CONFIDENCE MAPPINGS DETECTED ({len(low_confidence_log)})")
        logger.info("=" * 80)
        for log in low_confidence_log:
            logger.warning(f"File: {log['file']} | Mapped: {log['mapped_to']} | Q: {log['question']}...")
            
if __name__ == "__main__":
    main()
