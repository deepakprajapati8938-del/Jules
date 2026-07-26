import os
import sys
import json
import logging
from pathlib import Path
from dotenv import load_dotenv

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from supabase import create_client, Client
from src.llm_wrapper import call_llm
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

logging.basicConfig(level=logging.INFO, format='%(asctime)s  %(levelname)-8s  %(message)s')
logger = logging.getLogger(__name__)

env_path = Path(__file__).parent.parent / ".env.local"
load_dotenv(dotenv_path=env_path)

# Setup Supabase
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not supabase_url or not supabase_key:
    logger.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env")
    sys.exit(1)
sb: Client = create_client(supabase_url, supabase_key)

# Setup Gemini (handled inside llm_wrapper, just check if it exists in env)
gemini_key = os.environ.get("GEMINI_API_KEY")
if not gemini_key:
    logger.error("GEMINI_API_KEY not found in .env")
    sys.exit(1)

PROMPT = """You are a helpful educational AI.
Read the following chunk from an NCERT textbook.
Extract 1 to 3 "Did You Know?" style interesting facts or highly important concept summaries from this text.
Return the output as a valid JSON array of strings. Do not include markdown formatting or the word json. Just the array.
If the text does not contain any interesting facts, return an empty array [].

Text:
{text}
"""

def main():
    logger.info("Fetching all chunks from neet_chunks...")
    # Fetch all chunks (we can loop with offset if over 1000, but for ~2000 we can just make two calls or increase limit)
    # Supabase default limit is 1000. Let's fetch all by paginating.
    all_chunks = []
    offset = 0
    limit = 1000
    while True:
        res = sb.table("neet_chunks").select("id, content, metadata").range(offset, offset + limit - 1).execute()
        data = res.data or []
        if not data:
            break
        all_chunks.extend(data)
        offset += limit
        
    if not all_chunks:
        logger.error("No chunks found in neet_chunks table.")
        return
        
    logger.info("Fetching already processed chapters to avoid wasting quota...")
    res_facts = sb.table("ncert_facts").select("chapter_name").execute()
    processed_chapters = set(d["chapter_name"] for d in (res_facts.data or []))
    logger.info(f"Found {len(processed_chapters)} already processed chapters. Will skip chunks from these.")
        
    logger.info(f"Found {len(all_chunks)} total chunks. Starting extraction with 4 workers...")
    
    total_extracted = 0
    
    def process_chunk(chunk, index):
        content = chunk.get("content", "")
        if len(content) < 100:
            return 0
            
        meta = chunk.get("metadata", {})
        subject = meta.get("subject", "Unknown")
        chapter = meta.get("chapter", "Unknown")
        
        if chapter in processed_chapters:
            return 0
        
        
        extracted = 0
        try:
            text_resp = call_llm(
                system_prompt="You are a helpful educational AI.",
                user_prompt=PROMPT.format(text=content),
                model_name="gemini-3.5-flash-lite",
                max_retries=10,
                base_delay=5.0
            )
            
            if text_resp.startswith("```json"):
                text_resp = text_resp[7:]
            if text_resp.endswith("```"):
                text_resp = text_resp[:-3]
                
            facts = json.loads(text_resp.strip())
            
            if facts and isinstance(facts, list):
                for fact in facts:
                    sb.table("ncert_facts").insert({
                        "subject": subject,
                        "chapter_name": chapter,
                        "fact_text": str(fact),
                        "fact_type": "did_you_know"
                    }).execute()
                    extracted += 1
                logger.info(f"[{index}/{len(all_chunks)}] Extracted {len(facts)} facts from chapter: {chapter}")
            else:
                logger.info(f"[{index}/{len(all_chunks)}] No facts extracted.")
                
        except Exception as e:
            logger.error(f"Failed to process chunk {chunk.get('id')}: {e}")
            
        time.sleep(4.2)
        return extracted
        
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(process_chunk, chunk, i+1): chunk for i, chunk in enumerate(all_chunks)}
        for future in as_completed(futures):
            total_extracted += future.result()
            
    logger.info(f"Extraction complete! Total facts inserted: {total_extracted}")

if __name__ == "__main__":
    main()
