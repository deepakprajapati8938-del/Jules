from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from supabase import Client
import random

from backend.deps import get_supabase

router = APIRouter(prefix="/facts", tags=["facts"])

class FactOut(BaseModel):
    id: int
    subject: str
    chapter_name: str
    fact_text: str
    fact_type: str

from datetime import datetime, timedelta, timezone

@router.get("/random", response_model=list[FactOut])
def get_random_facts(count: int = Query(1, ge=1, le=10), sb: Client = Depends(get_supabase)):
    """Fetch N random facts from the ncert_facts table, prioritizing today's studied concept."""
    # 1. Determine recent chapter studied
    recent_chapter = None
    try:
        session_res = sb.table("study_sessions").select("chapter_name, created_at").order("created_at", desc=True).limit(1).execute()
        if session_res.data:
            created_at_str = session_res.data[0]["created_at"]
            # Check if it was within the last 48 hours to be considered "current"
            # Note: Supabase timestamp is usually ISO 8601
            dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - dt < timedelta(hours=48):
                recent_chapter = session_res.data[0]["chapter_name"]
    except Exception:
        pass

    q = sb.table("ncert_facts").select("*")
    if recent_chapter:
        q = q.eq("chapter_name", recent_chapter)
        
    res = q.limit(200).execute()
    facts = res.data or []
    
    if not facts and recent_chapter:
        # Fallback to any random fact if recent chapter has no facts
        res = sb.table("ncert_facts").select("*").limit(200).execute()
        facts = res.data or []

    if not facts:
        # Final fallback if table is empty
        return [
            FactOut(
                id=0, subject="Biology", chapter_name="General", 
                fact_text="Did you know? The human brain is well protected by the skull, covered by cranial meninges.", 
                fact_type="did_you_know"
            )
        ]
        
    random.shuffle(facts)
    sample = facts[:count]
    return [FactOut(**f) for f in sample]

@router.get("/flashcards", response_model=list[FactOut])
def get_flashcards(subject: Optional[str] = None, chapter: Optional[str] = None, sb: Client = Depends(get_supabase)):
    """Fetch exactly 10 facts. Prioritizes recently studied/marked chapters, fills rest randomly."""
    recent_chapter = chapter
    
    if not recent_chapter:
        # Check recent study sessions
        try:
            session_res = sb.table("study_sessions").select("chapter_name, created_at").order("created_at", desc=True).limit(1).execute()
            if session_res.data:
                recent_chapter = session_res.data[0]["chapter_name"]
        except Exception:
            pass
            
        # If no session, check recent confidence updates
        if not recent_chapter:
            try:
                conf_res = sb.table("confidence").select("chapter_name, updated_at").order("updated_at", desc=True).limit(1).execute()
                if conf_res.data:
                    recent_chapter = conf_res.data[0]["chapter_name"]
            except Exception:
                pass

    facts = []
    
    # 1. Fetch from recent/target chapter
    if recent_chapter:
        q = sb.table("ncert_facts").select("*").eq("chapter_name", recent_chapter)
        if subject:
            q = q.eq("subject", subject)
        res = q.limit(10).execute()
        facts = res.data or []

    # 2. If we need more to reach 10, fill with random facts
    if len(facts) < 10:
        needed = 10 - len(facts)
        q = sb.table("ncert_facts").select("*")
        if subject:
            q = q.eq("subject", subject)
        if recent_chapter and len(facts) > 0:
            q = q.neq("chapter_name", recent_chapter) # avoid exact duplicates from same chapter
            
        # Fetch a pool and shuffle to get random selection
        res = q.limit(100).execute()
        extra_facts = res.data or []
        random.shuffle(extra_facts)
        facts.extend(extra_facts[:needed])

    if not facts:
        # Fallback if empty database
        return [
            FactOut(
                id=0, subject=subject or "General", chapter_name=recent_chapter or "General", 
                fact_text="No flashcards found. Keep studying!", 
                fact_type="flashcard_concept"
            )
        ]
        
    random.shuffle(facts) # Final shuffle so primary chapter cards are mixed in
    selected_facts = facts[:10]
    
    # Translate facts to engaging Hinglish using ultra-fast LLM
    try:
        import json
        from src.llm_wrapper import call_llm
        
        system_prompt = (
            "You are a fun, friendly NEET tutor. Rewrite the following JSON array of NCERT facts "
            "into engaging 'Hinglish' (a conversational mix of Hindi and English, written in Latin script). "
            "Keep the core scientific terms exact and intact (don't translate biology/chemistry terms), "
            "but make the phrasing conversational and interesting so it doesn't feel like a boring textbook. "
            "Return ONLY a valid JSON array of strings containing the rewritten facts in the exact same order."
        )
        user_prompt = json.dumps([f["fact_text"] for f in selected_facts])
        
        response_text = call_llm(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            model_name="gemini-3.5-flash-lite",
            max_retries=2
        )
        
        cleaned_text = response_text.replace("```json", "").replace("```", "").strip()
        hinglish_texts = json.loads(cleaned_text)
        
        if len(hinglish_texts) == len(selected_facts):
            for i, f in enumerate(selected_facts):
                f["fact_text"] = hinglish_texts[i]
    except Exception as e:
        import logging
        logging.error(f"Failed to translate flashcards to Hinglish: {e}")
        # On failure, it will gracefully fallback to the original English text
        
    return [FactOut(**f) for f in selected_facts]
