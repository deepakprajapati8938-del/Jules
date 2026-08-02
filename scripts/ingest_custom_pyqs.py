import sys
import logging
import re
import json
import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.pdf_to_markdown import pdf_to_markdown
from src.embedder import embed_and_store, _get_gemini, _get_supabase

logging.basicConfig(level=logging.INFO, format='%(asctime)s  %(levelname)-8s  %(message)s', datefmt='%H:%M:%S')
logger = logging.getLogger(__name__)

def chunk_custom_pyq_markdown(md_text: str):
    """
    Chunks a custom PYQ Markdown document by individual questions.
    Looks for pattern '## Question<num>'
    """
    # Regex to match question start: "## Question1", "## Question 2", etc.
    question_pattern = re.compile(r'\n## Question\s*(\d+)', re.IGNORECASE)
    
    parts = question_pattern.split('\n' + md_text)
    
    chunks = []
    if len(parts) < 3:
        if md_text.strip():
            chunks.append({"content": md_text.strip(), "q_num": "Unknown"})
        return chunks
        
    for i in range(1, len(parts), 2):
        q_num = parts[i]
        q_content = parts[i+1].strip()
        full_content = f"Question {q_num}.\n{q_content}"
        chunks.append({
            "content": full_content,
            "q_num": q_num
        })
        
    return chunks

def main():
    data_dir = Path("data/pyq")
    if not data_dir.exists():
        logger.error(f"Directory {data_dir} does not exist.")
        sys.exit(1)
        
    # Get all pdfs, but filter out the ones starting with Year (e.g. 2025_Chemistry.pdf)
    pdf_files = [f for f in data_dir.rglob("*.pdf") if not re.match(r"^\d{4}_", f.name)]
    
    if not pdf_files:
        logger.warning("No custom chapter PDFs found.")
        sys.exit(0)
        
    logger.info(f"Found {len(pdf_files)} custom PYQ PDF files to process.")
    
    # Check syllabus config just in case, but we will force the chapter anyway.
    # Subject is Chemistry for all these based on the titles, but we can just hardcode Chemistry for now or guess.
    
    for pdf_path in pdf_files:
        logger.info("-" * 60)
        chapter_name = pdf_path.stem
        logger.info(f"Processing: {chapter_name}")
        
        # We will assume Chemistry since these are all organic/inorganic chem chapters
        subject = "Chemistry"
        
        try:
            # 1. PDF -> Markdown
            md_text, md_path = pdf_to_markdown(str(pdf_path), subject=subject, chapter_name=chapter_name)
            
            # 2. Chunking by question
            raw_chunks = chunk_custom_pyq_markdown(md_text)
            logger.info(f"Extracted {len(raw_chunks)} questions via regex chunking.")
            
            if not raw_chunks:
                continue
                
            # Prepare for embedder
            final_chunks = []
            for c in raw_chunks:
                final_chunks.append({
                    "content": c["content"],
                    "metadata": {
                        "source_type": "PYQ",
                        "subject": subject,
                        "chapter": chapter_name,
                        "topic": None,
                        "year": "2025" # Arbitrary year for custom module questions
                    }
                })
            
            # 3. Embedding and storing
            logger.info(f"Embedding {len(final_chunks)} chunks for {chapter_name}...")
            embed_and_store(final_chunks)
            
        except Exception as e:
            logger.error(f"Failed processing {pdf_path.name}: {e}", exc_info=True)

    logger.info("DONE: All custom PDFs ingested.")
            
if __name__ == "__main__":
    main()
