import sys
from pathlib import Path
import json
import logging
import time

# Add project root to path so we can import src modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.embedder import _get_supabase
from src.llm_wrapper import call_llm

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert NEET curriculum analyzer.
Your task is to identify meaningful conceptual connections between topics in the NEET syllabus.

You will be given a specific "Topic A" from a "Chapter" and "Subject".
You must identify 2 to 4 other specific topics from the NEET syllabus that conceptually connect to or depend on Topic A. 
These connections can be from the same chapter, different chapters, or even different subjects (e.g., Physics to Chemistry).

Rules:
1. Only output valid JSON in the exact format shown below, nothing else. No markdown blocks.
2. Only include genuinely meaningful, specific connections — not generic ones like "requires basic understanding of physics".
3. Provide a clear, one-sentence relationship note explaining WHY they connect.

Expected Output Format:
[
  {
    "topic_b": "Name of the connected topic",
    "relationship_note": "One sentence explaining the connection."
  },
  ...
]
"""

def generate_concept_edges():
    client = _get_supabase()

    logger.info("Fetching distinct topics from neet_chunks...")
    
    # Supabase currently doesn't have a direct SELECT DISTINCT for JSONB fields in PostgREST easily without an RPC.
    # We will fetch all metadata and extract distinct topics in memory.
    # Note: neet_chunks has ~1858 rows, fetching all is fine.
    # Alternatively, we could fetch just the metadata.
    
    res = client.table("neet_chunks").select("metadata").execute()
    
    if not res.data:
        logger.error("No chunks found in neet_chunks. Please run NCERT ingestion first.")
        return

    # Extract distinct topics
    # We will store them as a tuple (subject, chapter, topic)
    unique_topics = set()
    for row in res.data:
        meta = row.get("metadata", {})
        topic = meta.get("topic")
        chapter = meta.get("chapter")
        subject = meta.get("subject")
        
        if topic and chapter and subject:
            unique_topics.add((subject, chapter, topic))

    logger.info(f"Found {len(unique_topics)} unique topics.")

    # Convert to list to iterate
    unique_topics = list(unique_topics)
    
    # For testing/demonstration, we might not want to run all 1000+ topics immediately.
    # Let's process them all but we will add basic resuming capability if needed.
    # First, let's get the topics already in concept_edges so we don't re-process them.
    
    existing_edges = client.table("concept_edges").select("topic_a").execute()
    processed_topics = set(row["topic_a"] for row in existing_edges.data)
    
    logger.info(f"Already processed {len(processed_topics)} topics.")
    
    topics_to_process = [t for t in unique_topics if t[2] not in processed_topics]
    logger.info(f"Topics left to process: {len(topics_to_process)}")

    for i, (subject, chapter, topic) in enumerate(topics_to_process):
        logger.info(f"Processing ({i+1}/{len(topics_to_process)}): {topic} (from {subject} - {chapter})")
        
        user_prompt = f"Subject: {subject}\nChapter: {chapter}\nTopic: {topic}\n\nList other topics this connects to in valid JSON format."
        
        try:
            response = call_llm(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                model_name="gemini-flash-latest" # Using flash for faster/cheaper batch processing
            )
            
            # Clean response (sometimes the model wraps in ```json ... ``` despite instructions)
            clean_response = response.strip()
            if clean_response.startswith("```json"):
                clean_response = clean_response[7:]
            if clean_response.startswith("```"):
                clean_response = clean_response[3:]
            if clean_response.endswith("```"):
                clean_response = clean_response[:-3]
            clean_response = clean_response.strip()
            
            try:
                connections = json.loads(clean_response)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse JSON for topic '{topic}'. LLM output: {response}")
                continue
                
            if not isinstance(connections, list):
                logger.error(f"Expected a JSON list for topic '{topic}', got {type(connections)}.")
                continue
                
            rows_to_insert = []
            for conn in connections:
                topic_b = conn.get("topic_b")
                note = conn.get("relationship_note")
                
                if topic_b and note:
                    rows_to_insert.append({
                        "topic_a": topic,
                        "topic_b": topic_b,
                        "relationship_note": note,
                        "reviewed": False
                    })
                    
            if rows_to_insert:
                try:
                    # Ignore conflicts (UNIQUE constraint on topic_a, topic_b)
                    client.table("concept_edges").upsert(rows_to_insert, on_conflict="topic_a, topic_b").execute()
                    logger.info(f"  Inserted {len(rows_to_insert)} edges.")
                except Exception as db_err:
                    logger.error(f"  DB Insert failed for topic '{topic}': {db_err}")
            else:
                logger.info(f"  No valid connections extracted.")
                
            # Sleep slightly to respect rate limits
            time.sleep(0.5)
            
        except Exception as e:
            logger.error(f"Error processing topic '{topic}': {e}")
            # Depending on the error, we might want to break or continue
            continue
            
    logger.info("Done generating concept edges.")

if __name__ == "__main__":
    generate_concept_edges()
