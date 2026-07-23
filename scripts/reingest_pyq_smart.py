"""
Smart ingestion script for NEET PYQ PDFs using Gemini File API.
Reads from data/pyq/<YYYY>_<Subject>.pdf
"""
import sys
import logging
import json
import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from google import genai
from google.genai import errors as genai_errors
from src.embedder import embed_and_store, _get_supabase
from src.config import get_all_gemini_api_keys

logging.basicConfig(level=logging.INFO, format='%(asctime)s  %(levelname)-8s  %(message)s', datefmt='%H:%M:%S')
logger = logging.getLogger(__name__)

# User specifically requested the good model
GEMINI_MODEL = "gemini-flash-latest"

def get_ncert_chapters(subject: str):
    """Fetch the list of valid NCERT chapters for a given subject."""
    client = _get_supabase()
    res = client.table("syllabus_config").select("chapter_name").eq("subject", subject).execute()
    return [row["chapter_name"] for row in res.data]

def _is_rate_limit(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "429" in msg or "resource_exhausted" in msg or "quota" in msg or "503" in msg or "unavailable" in msg

def process_pdf(pdf_path: Path, subject: str, year: int, chapters: list[str]) -> list[dict]:
    api_keys = get_all_gemini_api_keys()
    if not api_keys:
        raise RuntimeError("No Gemini API keys found.")

    prompt = f"""
    You are an expert NEET examiner. This PDF is a Previous Year Question (PYQ) paper for {subject}.
    It is likely dual-language (Hindi and English). I only want the ENGLISH version of the questions.
    Extract every single multiple-choice question from this paper. 
    
    For each question:
    1. Extract the clean question text (ignore Hindi garbage or OCR errors).
    2. Extract the 4 options (A, B, C, D).
    3. Identify the correct answer option (A, B, C, or D). If you cannot be 100% sure, make your best guess.
    4. Map the question to ONE of these NCERT chapters:
    {json.dumps(chapters)}

    Respond ONLY with a valid JSON array of objects. No markdown formatting, no backticks, just the raw JSON array.
    Format of each object:
    {{
        "question": "The text of the question...",
        "A": "Option A text",
        "B": "Option B text",
        "C": "Option C text",
        "D": "Option D text",
        "correct": "A",
        "chapter": "Exact Chapter Name from list"
    }}
    """
    
    for attempt in range(1, 10):
        key_index = (attempt - 1) % len(api_keys)
        current_key = api_keys[key_index]
        client = genai.Client(api_key=current_key)
        uploaded_file = None
        
        try:
            logger.info(f"[Attempt {attempt} | Key {key_index+1}] Uploading {pdf_path.name}...")
            uploaded_file = client.files.upload(file=str(pdf_path))
            
            while uploaded_file.state.name == 'PROCESSING':
                time.sleep(2)
                uploaded_file = client.files.get(name=uploaded_file.name)
                
            if uploaded_file.state.name == 'FAILED':
                raise RuntimeError("File processing failed on Gemini.")

            logger.info(f"[Attempt {attempt} | Key {key_index+1}] Generating content with {GEMINI_MODEL}...")
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[uploaded_file, prompt],
                config=genai.types.GenerateContentConfig(
                    temperature=0.1,
                    response_mime_type="application/json"
                )
            )
            
            try:
                text = response.text
                if not text:
                    raise RuntimeError("Empty response.text from Gemini")
                start_idx = text.find('[')
                end_idx = text.rfind(']') + 1
                json_str = text[start_idx:end_idx]
                questions = json.loads(json_str)
            except Exception as parse_err:
                logger.error(f"Failed to parse JSON. Error: {parse_err}. Response might be blocked by safety.")
                raise parse_err

            
            client.files.delete(name=uploaded_file.name)
            return questions
            
        except genai_errors.ClientError as exc:
            if uploaded_file:
                try:
                    client.files.delete(name=uploaded_file.name)
                except:
                    pass
                    
            if _is_rate_limit(exc):
                logger.warning(f"Rate limited on key {key_index+1}. Rotating key...")
                # If we've tried all keys, sleep for a bit to let quota reset
                if attempt % len(api_keys) == 0:
                    sleep_time = 30
                    logger.warning(f"All keys rate limited. Sleeping for {sleep_time}s...")
                    time.sleep(sleep_time)
            else:
                logger.error(f"ClientError: {exc}")
                raise
        except Exception as e:
            if uploaded_file:
                try:
                    client.files.delete(name=uploaded_file.name)
                except:
                    pass
            logger.error(f"Exception during extraction: {e}")
            raise
            
    raise RuntimeError(f"Failed to process {pdf_path.name} after 10 attempts.")

def main():
    data_dir = Path("data/pyq")
    if not data_dir.exists():
        logger.error(f"Directory {data_dir} does not exist.")
        sys.exit(1)
        
    pdf_files = list(data_dir.rglob("*.pdf"))
    if not pdf_files:
        sys.exit(0)
        
    logger.info(f"Found {len(pdf_files)} PYQ PDF files.")
    
    for pdf_path in pdf_files:
        filename = pdf_path.stem
        parts = filename.split('_')
        if len(parts) < 2:
            continue
        try:
            year = int(parts[0])
            subject = parts[1]
        except ValueError:
            continue
            
        logger.info(f"--- Processing: {pdf_path.name} ---")
        
        # Check if already processed
        client = _get_supabase()
        res = client.table("neet_chunks").select("id").eq("metadata->>source_type", "PYQ").eq("metadata->>filename", pdf_path.name).limit(1).execute()
        if res.data:
            logger.info(f"Skipping {pdf_path.name}, already in database.")
            continue
            
        chapters = get_ncert_chapters(subject)
        
        try:
            questions = process_pdf(pdf_path, subject, year, chapters)
            logger.info(f"Extracted {len(questions)} questions.")
            
            final_chunks = []
            for q in questions:
                final_chunks.append({
                    "content": q["question"],
                    "metadata": {
                        "source_type": "PYQ",
                        "subject": subject,
                        "chapter": q["chapter"],
                        "year": year,
                        "filename": pdf_path.name,
                        "options": {
                            "A": q.get("A", ""),
                            "B": q.get("B", ""),
                            "C": q.get("C", ""),
                            "D": q.get("D", "")
                        },
                        "correct_ans": q.get("correct", "A")
                    }
                })
                
            logger.info(f"Embedding and storing...")
            embed_and_store(final_chunks)
            
        except Exception as e:
            logger.error(f"Failed on {pdf_path.name}: {e}")

if __name__ == "__main__":
    main()
