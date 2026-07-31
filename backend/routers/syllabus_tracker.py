from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import os
from pathlib import Path
import re
from supabase import Client
from backend.deps import get_supabase

router = APIRouter(prefix="/syllabus", tags=["syllabus"])

class ToggleProgressRequest(BaseModel):
    chapter_name: str
    topic_name: str = "" # empty string means chapter-level completion
    is_completed: bool

class TopicProgress(BaseModel):
    name: str
    is_completed: bool

class ChapterProgress(BaseModel):
    name: str
    is_completed: bool
    topics: List[TopicProgress]

class SubjectProgress(BaseModel):
    name: str
    chapters: List[ChapterProgress]

def normalize_name(s: str) -> str:
    """Normalize chapter name for robust matching between DB and Markdown."""
    if not s:
        return ""
    return re.sub(r'[^a-z0-9]', '', s.lower())

CHAPTER_ALIASES = {
    # Chemistry
    normalize_name("Redox Reaction"): normalize_name("Redox Reactions"),
    normalize_name("Hydrocarbon"): normalize_name("Hydrocarbons"),
    normalize_name("Atomic Structure"): normalize_name("Structure Of Atom"),
    normalize_name("Organic Chemistry: GOC"): normalize_name("Organic Chemistry Some Basic Principles"),
    normalize_name("Organic Chemistry: IUPAC Nomenclature"): normalize_name("Organic Chemistry Some Basic Principles"),
    normalize_name("Organic Chemistry: Isomerism"): normalize_name("Organic Chemistry Some Basic Principles"),
    
    # Physics
    normalize_name("Work, Energy & Power"): normalize_name("Work Energy And Power"),
    normalize_name("Centre of mass and System of Particles"): normalize_name("Centre Of Mass And Rotational Motion"),
    normalize_name("Rotational Motion"): normalize_name("Centre Of Mass And Rotational Motion"),
    
    # Botany
    normalize_name("Sexual Reproduction in Flowering Plant"): normalize_name("Sexual Reproduction In Flowering Plants"),
    normalize_name("Principle of Inheritance and Variation"): normalize_name("Principles Of Inheritance"),
    normalize_name("Organisms and Population"): normalize_name("Organisms And Populations"),
    
    # Zoology
    normalize_name("Structural Organization in Animals"): normalize_name("Structural Organisation In Animals"),
    normalize_name("Excretory Products & their Elimination"): normalize_name("Excretory Products"),
    normalize_name("Chemical Coordination & Integration"): normalize_name("Chemical Coordination"),
    normalize_name("Human Health and Diseases"): normalize_name("Human Health And Disease"),
    normalize_name("Biotechnology: Principles & Processes"): normalize_name("Biotechnology Principles"),
    normalize_name("Biotechnology and its Applications"): normalize_name("Biotechnology Applications"),
}

def clean_topic_name(t: str) -> str:
    # Remove markdown bold/italics
    t = re.sub(r'[*_]{1,3}', '', t)
    # Remove "CHAPTER X: " or "CHAPTER X "
    t = re.sub(r'(?i)^chapter\s+\d+\s*:?\s*', '', t)
    # Remove numbering like "8.1 " or "8.1.1 "
    t = re.sub(r'^\d+(\.\d+)+\s*', '', t)
    # Remove specific artifacts
    t = re.sub(r'(?i)\s*/\s*Reprint\s*\d{4}-\d{2}', '', t)
    # Sometimes it comes as "Topic / Subtopic", just take the first part
    t = t.split(' / ')[0]
    t = t.strip()
    # If it's ALL CAPS, convert to Title Case for better readability
    if t.isupper():
        t = t.title()
    return t

def is_junk_topic(t: str) -> bool:
    t_lower = t.lower().strip()

    # Too short to be a real topic
    if len(t.strip()) < 4:
        return True

    # Exact junk words
    junk_exact = {'exercises', 'summary', 'biology', 'chemistry', 'physics', 'reprint',
                  'figure', 'table', 'appendix', 'introduction', 'conclusion', 'index',
                  'contents', 'preface', 'notes', 'answers', 'problems', 'solutions',
                  'mathematics', 'unit', 'intext questions'}
    if t_lower in junk_exact:
        return True

    # Contains equation/formula operators — these are chemical equations or math, not topic names
    formula_chars = ['=', '→', '⇌', '±', '≡', '∝', '∞', '√', '∑', '∫', '°']
    if any(c in t for c in formula_chars):
        return True

    # Chemical/math formula pattern: contains digits mixed with uppercase letters (e.g. Cr2O7, S2O3, H2SO4)
    # Real topic names don't look like this
    if re.search(r'[A-Z][a-z]?\d', t):
        return True

    # Ion/electrode notation (e.g. Hg2+/Hg, Fe3+) — must end with + or - at a word boundary
    if re.search(r'[A-Za-z]\d+[\+\-]+\b', t):
        return True

    # Looks like a problem/unit/example reference (e.g. "Problem 7.7", "Unit 7", "Example 3")
    if re.match(r'(?i)^(problem|unit|example|intext|exercise|question|table|fig|note)\s*[\d.]+', t):
        return True

    # Looks like a pure math expression or variable (e.g. "X + Yz → Xz + Y")
    if re.search(r'\b[A-Z]\s*[\+\-\*\/]\s*[A-Z]', t):
        return True

    # Contains keywords that signal it's a page artifact, not a topic
    junk_substrings = ['reprint', 'figure ', 'ncert', 'www.', 'http', 'page ', '©', 'board of']
    if any(j in t_lower for j in junk_substrings):
        return True

    return False

def parse_roadmap():
    roadmap_path = Path(__file__).parent.parent.parent / "neet_2027_roadmap.md"
    subjects = []
    current_subject = None
    
    if not roadmap_path.exists():
        # Fallback if file not found
        return []

    with open(roadmap_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith("## "):
                # Extract subject name (remove emojis)
                subject_name = re.sub(r'[🟢🔵🔴🟠]', '', line[3:]).strip()
                current_subject = {"name": subject_name, "chapters": []}
                subjects.append(current_subject)
            elif line.startswith("- [") and current_subject is not None:
                chapter_name = line[5:].strip()
                current_subject["chapters"].append({
                    "name": chapter_name,
                    "is_completed": False,
                    "topics": []
                })
    return subjects

@router.get("/tracker", response_model=List[SubjectProgress])
def get_syllabus_tracker(supabase: Client = Depends(get_supabase)):
    # 1. Parse Roadmap
    roadmap = parse_roadmap()

    # 2. Fetch Topics from neet_chunks
    try:
        chunks_res = supabase.table("neet_chunks").select("metadata").execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    db_topics = {} # normalized_chapter -> set(original_topic_name)
    for row in chunks_res.data:
        meta = row.get("metadata", {})
        ch = meta.get("chapter")
        topic = meta.get("topic")
        # Ensure it's not a root heading masquerading as a topic
        if ch and topic and topic.strip() != ch.strip():
            norm_ch = normalize_name(ch)
            if norm_ch not in db_topics:
                db_topics[norm_ch] = set()
            # Clean up the topic name
            clean_topic = clean_topic_name(topic)
            if clean_topic and not is_junk_topic(clean_topic):
                db_topics[norm_ch].add(clean_topic)

    # 3. Fetch User Progress
    try:
        progress_res = supabase.table("user_syllabus_progress").select("*").execute()
    except Exception as e:
        # If table doesn't exist yet, we'll just ignore progress
        progress_res = type('obj', (object,), {'data': []})
        
    # Map progress: (norm_chapter, norm_topic) -> is_completed
    progress_map = {}
    for row in progress_res.data:
        ch = normalize_name(row.get("chapter_name", ""))
        top = normalize_name(row.get("topic_name", ""))
        progress_map[(ch, top)] = row.get("is_completed", False)

    # 4. Merge Everything
    for subj in roadmap:
        for chap in subj["chapters"]:
            norm_ch = normalize_name(chap["name"])
            db_ch = CHAPTER_ALIASES.get(norm_ch, norm_ch)
            
            # Set chapter completion
            chap["is_completed"] = progress_map.get((norm_ch, ""), False)
            
            # Populate topics
            topics = sorted(list(db_topics.get(db_ch, [])))
            chap["topics"] = [
                {
                    "name": t,
                    "is_completed": progress_map.get((norm_ch, normalize_name(t)), False)
                }
                for t in topics
            ]
            
    return roadmap

@router.post("/tracker/toggle")
def toggle_progress(req: ToggleProgressRequest, supabase: Client = Depends(get_supabase)):
    # Upsert the completion state
    try:
        res = supabase.table("user_syllabus_progress").upsert({
            "chapter_name": req.chapter_name,
            "topic_name": req.topic_name,
            "is_completed": req.is_completed
        }, on_conflict="chapter_name,topic_name").execute()
        return {"status": "success", "data": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
