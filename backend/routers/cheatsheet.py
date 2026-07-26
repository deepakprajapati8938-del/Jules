from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from typing import Optional
from pydantic import BaseModel

from backend.deps import get_supabase
from src.llm_wrapper import call_llm
from src.config import GEMINI_PRO_MODEL

router = APIRouter(prefix="/cheatsheet", tags=["cheatsheet"])

class CheatSheetResponse(BaseModel):
    chapter_name: str
    content: str

@router.get("", response_model=CheatSheetResponse)
def generate_cheatsheet(chapter_name: str, sb: Client = Depends(get_supabase)):
    """
    Generate a 1-page quick-revision cheat-sheet for a specific chapter
    by summarizing all its chunks via Gemini.
    """
    # Convert "Cell - The Unit of Life" to "%Cell%The%Unit%of%Life%" for a robust match
    pattern = "%" + "%".join([w for w in chapter_name.replace("-", " ").split() if w.strip()]) + "%"
    
    # Supabase ilike on jsonb field metadata->>chapter
    res = sb.table("neet_chunks").select("content").ilike("metadata->>chapter", pattern).execute()
    chunks = res.data or []

    # 2. Concatenate content
    if not chunks:
        # If no chunks match (e.g. they are stored under generic names like "Chapter1"),
        # we still proceed and let the LLM generate the cheat sheet from its own robust knowledge base.
        full_text = ""
    else:
        full_text = "\n\n".join([c["content"] for c in chunks])

    # 3. Call LLM
    system_prompt = """You are an expert NEET UG study assistant. 
Your task is to generate a highly concise, 1-page quick-revision "Cheat Sheet" from the provided NCERT chapter content.

Rules:
1. Extract ONLY key formulas, important laws, crucial definitions, and high-yield bullet points.
2. Structure it clearly using Markdown (headers, bullet points, bold text for emphasis).
3. Do not include conversational filler.
4. Keep it exam-focused and easy to scan the night before a test.
5. If the provided context is too short, generate the cheat sheet based on your general knowledge for that specific NEET chapter, but prioritize the provided context.
6. LANGUAGE RULE: You MUST respond in English or Hinglish (Hindi written in English alphabet). NEVER use pure Hindi or the Devanagari script (e.g. never write 'गैल्वेनोमीटर').
"""
    
    try:
        cheat_sheet_content = call_llm(
            system_prompt=system_prompt,
            user_prompt=f"Generate a cheat sheet for the chapter: {chapter_name}",
            context=full_text,
            model_name=GEMINI_PRO_MODEL
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Error: {str(e)}")
        
    return CheatSheetResponse(chapter_name=chapter_name, content=cheat_sheet_content)
