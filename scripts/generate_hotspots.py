"""
scripts/generate_hotspots.py — Phase 10 Interactive Artifacts
Extracts parts/labels from Phase 3 diagrams using Gemini Vision and creates interactive hotspots.
"""
import os
import sys
import json
import base64
import logging
from dotenv import load_dotenv
from supabase import create_client, Client

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import get_supabase_url, get_supabase_key
from src.llm_wrapper import call_llm

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_supabase() -> Client:
    url = get_supabase_url()
    key = get_supabase_key()
    return create_client(url, key)

def main():
    sb = get_supabase()
    
    # Fetch diagrams that don't have hotspots yet
    try:
        res = sb.table("diagrams").select("id, image_path, caption").execute()
        diagrams = res.data or []
    except Exception as e:
        logger.error(f"Failed to fetch diagrams: {e}")
        return

    if not diagrams:
        logger.info("No diagrams found. Phase 3 might be deferred or not run.")
        return

    # Check which ones already have hotspots
    try:
        res_hotspots = sb.table("diagram_hotspots").select("diagram_id").execute()
        existing_ids = {row["diagram_id"] for row in (res_hotspots.data or [])}
    except Exception as e:
        logger.error(f"diagram_hotspots table might not exist: {e}")
        existing_ids = set()

    prompt = """You are a NEET UG visual assistant.
Analyze this diagram and its caption. 
First, determine if this image has multiple distinguishable labeled parts worth making interactive. Simple graphs or single-concept illustrations do not need this.
If NO, output {"has_parts": false} and nothing else.
If YES, identify each visually distinguishable labeled part.
For each part, provide:
- part_label: string (e.g. "Nucleus")
- x_pct: float (0-100, horizontal position from left edge)
- y_pct: float (0-100, vertical position from top edge)
- explanation: a short (1-2 sentence) explanation of this part, grounded in NEET context.
- confidence: "high" or "low" (low if position is uncertain or parts overlap)

Output ONLY valid JSON in this format:
{
  "has_parts": true,
  "parts": [
    {
      "part_label": "...",
      "x_pct": 50.5,
      "y_pct": 20.0,
      "explanation": "...",
      "confidence": "high"
    }
  ]
}
"""

    for diagram in diagrams:
        if diagram["id"] in existing_ids:
            continue
            
        logger.info(f"Processing diagram {diagram['id']}")
        
        # We need the image data
        image_path = diagram.get("image_path")
        if not image_path or not os.path.exists(image_path):
            logger.warning(f"Image not found at {image_path}, skipping.")
            continue
            
        with open(image_path, "rb") as f:
            b64_img = base64.b64encode(f.read()).decode("utf-8")
            
        mime = "image/jpeg"
        if image_path.lower().endswith(".png"):
            mime = "image/png"
            
        try:
            res_text = call_llm(
                system_prompt="You are a precise data extraction assistant.",
                user_prompt=f"{prompt}\n\nCaption: {diagram.get('caption', '')}",
                attachment_data=b64_img,
                attachment_mime_type=mime,
                model_name="gemini-flash-latest",
                max_retries=2
            )
            
            cleaned = res_text.strip()
            if cleaned.startswith("```json"): cleaned = cleaned[7:]
            if cleaned.startswith("```"): cleaned = cleaned[3:]
            if cleaned.endswith("```"): cleaned = cleaned[:-3]
            
            data = json.loads(cleaned.strip())
            
            if data.get("has_parts") and data.get("parts"):
                parts = data["parts"]
                for p in parts:
                    sb.table("diagram_hotspots").insert({
                        "diagram_id": diagram["id"],
                        "part_label": p["part_label"],
                        "x_pct": float(p["x_pct"]),
                        "y_pct": float(p["y_pct"]),
                        "explanation": p["explanation"],
                        "confidence": p["confidence"],
                        "reviewed": False
                    }).execute()
                logger.info(f"Inserted {len(parts)} hotspots for diagram {diagram['id']}")
            else:
                logger.info(f"Diagram {diagram['id']} skipped (no distinguishable parts).")
                
        except Exception as e:
            logger.error(f"Error processing diagram {diagram['id']}: {e}")

if __name__ == "__main__":
    main()
