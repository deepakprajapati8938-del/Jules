"""
src/retriever.py — Step 6 of the NEET RAG pipeline.

Responsibilities:
  - retrieve(): embed a question, query Supabase for the top-k most similar
    chunks, return them with similarity scores.
  - answer(): retrieve chunks, build a grounded prompt, call the Gemini text
    model, and return the final answer.

Grounding policy (enforced in the system prompt):
  - If the answer IS in the retrieved context → answer ONLY from context.
  - If the answer is NOT in the context → answer from general knowledge BUT
    prefix the response with the FALLBACK_TAG.
  - Never blend the two silently.
"""

import logging
import time
from dataclasses import dataclass
from typing import Any

from google import genai
from google.genai import errors as genai_errors, types as genai_types
from supabase import create_client, Client

from src.config import (
    get_gemini_api_key,
    get_supabase_url,
    get_supabase_key,
    GEMINI_EMBED_MODEL,
    EMBEDDING_DIM,
    SUPABASE_RPC_FN,
    DEFAULT_TOP_K,
    DEFAULT_SIMILARITY_THRESHOLD,
    RETRY_MAX_ATTEMPTS,
    RETRY_BASE_DELAY_S,
)
from src.llm_wrapper import call_llm

logger = logging.getLogger(__name__)

# The exact tag the model must prepend when falling back to general knowledge
FALLBACK_TAG = "[NOT FROM NCERT — GENERAL KNOWLEDGE]"


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class RetrievedChunk:
    id: int
    content: str
    metadata: dict[str, Any]
    similarity: float


@dataclass
class AnswerResult:
    question: str
    chunks: list[RetrievedChunk]
    answer: str
    fallback_applied: bool   # True if FALLBACK_TAG appears in the answer
    widget_html: str | None = None


# ── Lazy singletons ───────────────────────────────────────────────────────────
_gemini_client: genai.Client | None = None
_supabase_client: Client | None = None


def _get_gemini() -> genai.Client:
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=get_gemini_api_key())
    return _gemini_client


def _get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(get_supabase_url(), get_supabase_key())
    return _supabase_client


# ── Public API ────────────────────────────────────────────────────────────────

def retrieve(
    question: str,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
) -> list[RetrievedChunk]:
    """
    Embed the question and retrieve the top-k most similar chunks from
    Supabase via the match_neet_chunks RPC function.

    Args:
        question: The user's question string.
        top_k:    Maximum number of chunks to retrieve.
        threshold: Minimum cosine similarity score (0–1) to include a chunk.

    Returns:
        List of RetrievedChunk objects, ordered by descending similarity.
    """
    embedding = _embed_question(question)

    sb = _get_supabase()
    response = sb.rpc(SUPABASE_RPC_FN, {
        "query_embedding": embedding,
        "match_threshold": threshold,
        "match_count":     top_k,
    }).execute()

    chunks = []
    for row in (response.data or []):
        chunks.append(RetrievedChunk(
            id=row["id"],
            content=row["content"],
            metadata=row["metadata"],
            similarity=row["similarity"],
        ))
    return chunks


def answer(
    question: str,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
    attachment_data: str | None = None,
    attachment_mime_type: str | None = None,
    require_graph: bool = False
) -> AnswerResult:
    """
    Full RAG cycle: retrieve chunks → build prompt → generate answer.

    Args:
        question: The user's question string.
        top_k:    Maximum chunks to retrieve.
        threshold: Minimum similarity to include a chunk.

    Returns:
        AnswerResult with chunks, answer text, and fallback_applied flag.
    """
    chunks = retrieve(question, top_k=top_k, threshold=threshold)
    is_interactive = require_graph
    
    raw_answer = _generate_answer(
        question, 
        chunks, 
        attachment_data=attachment_data, 
        attachment_mime_type=attachment_mime_type,
        is_interactive=is_interactive
    )
    
    answer_text = raw_answer
    widget_html = None
    
    if is_interactive:
        import re
        match = re.search(r'```widget_html\n(.*?)\n```', raw_answer, re.DOTALL | re.IGNORECASE)
        if match:
            widget_html = match.group(1).strip()
            answer_text = raw_answer[:match.start()].strip() + "\n" + raw_answer[match.end():].strip()
        else:
            # Sometimes LLM might not add the language tag or uses json
            if "```html" in raw_answer and "<!DOCTYPE html>" in raw_answer:
                match = re.search(r'```html\n(.*?)\n```', raw_answer, re.DOTALL | re.IGNORECASE)
                if match:
                    widget_html = match.group(1).strip()
                    answer_text = raw_answer[:match.start()].strip() + "\n" + raw_answer[match.end():].strip()

    fallback_applied = FALLBACK_TAG in answer_text

    return AnswerResult(
        question=question,
        chunks=chunks,
        answer=answer_text,
        fallback_applied=fallback_applied,
        widget_html=widget_html,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_interactive_category(question: str) -> bool:
    """Classify if the question warrants an interactive numerical/graph widget."""
    prompt = """Analyze this student question and determine if it falls into one of these 4 specific categories that require a numerical/graph interactive widget:
1. Kinematics (velocity-time, position-time graphs; v = u + at, etc.)
2. Simple circuits (Ohm's law, V = IR, series/parallel resistance)
3. Basic projectile motion (no air resistance)
4. Titration curves (pH vs. volume added, weak/strong acid-base)

Respond ONLY with 'YES' if it fits one of these categories, or 'NO' if it does not."""
    
    try:
        response = call_llm(
            system_prompt="You are a classifier for educational content.",
            user_prompt=prompt + "\n\nQuestion: " + question,
            model_name="gemini-flash-latest",
            max_retries=2,
            base_delay=1.0
        )
        return "YES" in response.upper()
    except Exception as e:
        logger.warning(f"Classification failed: {e}")
        return False


def _embed_question(question: str) -> list[float]:
    """Embed a question string with retry on rate limits."""
    client = _get_gemini()
    delay = RETRY_BASE_DELAY_S

    for attempt in range(1, RETRY_MAX_ATTEMPTS + 1):
        try:
            result = client.models.embed_content(
                model=GEMINI_EMBED_MODEL,
                contents=question,
                config=genai_types.EmbedContentConfig(
                    output_dimensionality=EMBEDDING_DIM,
                ),
            )
            return list(result.embeddings[0].values)

        except genai_errors.ClientError as exc:
            if _is_rate_limit(exc) and attempt < RETRY_MAX_ATTEMPTS:
                logger.warning(
                    f"Rate limit on embed (attempt {attempt}). "
                    f"Retrying in {delay:.1f}s …"
                )
                time.sleep(delay)
                delay *= 2
            else:
                raise

    raise RuntimeError("Question embedding failed after all retries.")


def _generate_answer(
    question: str,
    chunks: list[RetrievedChunk],
    attachment_data: str | None = None,
    attachment_mime_type: str | None = None,
    is_interactive: bool = False
) -> str:
    """
    Build the grounding prompt and call the LLM via call_llm() to generate
    an answer. Grounding policy: answer from context if present, else fall
    back to general knowledge with FALLBACK_TAG prefix.
    """
    system_prompt = f"""You are a precise study assistant for NEET UG exam preparation.
You are given excerpts from an NCERT textbook chapter. Use them to answer the student's question.

Rules you MUST follow:
1. If the answer to the question is clearly present in the provided context excerpts:
   - Answer ONLY using information from those excerpts.
   - Do NOT add information from general knowledge.
   - Be accurate and detailed in your answer based on the context.

2. If the answer is NOT present in the provided context excerpts:
   - You MAY answer from your general knowledge.
   - You MUST begin your entire response with this exact tag on its own line:
     {FALLBACK_TAG}
   - After the tag, provide a helpful general-knowledge answer.

3. Never blend NCERT content and general knowledge into one answer without the tag.
   If ANY part of your answer goes beyond the context, the tag must appear.
4. Be concise and exam-focused.
"""

    if is_interactive:
        system_prompt += """
ARTIFACTS (Jules Canvas):
You MUST provide your response in two parts:
1. First, a plain-text explanation to the student's question, following the grounding rules above.
2. Second, a self-contained HTML/JS snippet implementing an interactive component (e.g. using Chart.js via CDN).

Output the widget EXACTLY inside a markdown code block labeled `widget_html` like this:
```widget_html
<!DOCTYPE html>
<html>
... your HTML code here ...
</html>
```

  * IMPORTANT UI RULES: It MUST use a dark mode glassmorphism aesthetic (Background: #08090c, Text: white/gray, Accents: #8b5cf6 violet). 
  * It MUST fit perfectly inside its container without ANY scrollbars (use `box-sizing: border-box`, `overflow: hidden`, `height: 100%`, `margin: 0`). 
  * CRITICAL FOR MOBILE: The layout MUST be fully responsive. If you place controls and a graph side-by-side, you MUST use CSS media queries (e.g., `@media (max-width: 600px)`) to switch to a vertical stacked layout (`flex-direction: column`) so the graph is NEVER cut off on narrow screens.
  * Controls (sliders/buttons) must be sleek, highly visible, and fully interactive (DO NOT use pointer-events: none on sliders).

Your HTML script MUST include this exact pattern at the end to signal readiness:
```javascript
try {
  // ... widget rendering logic ...
  window.parent.postMessage({ type: 'widget-ready' }, '*');
} catch (e) {
  window.parent.postMessage({ type: 'widget-error', message: String(e) }, '*');
}
```
"""
    else:
        system_prompt += """
ARTIFACTS (Jules Canvas):
When the user asks you to build, visualize, simulate, or create an interactive tool (e.g. a study planner, a physics simulation, or a math graph), you MUST generate a self-contained HTML/JS/CSS widget.
Output the widget exactly like this:
```jules-artifact
<artifact-title>Title of Widget</artifact-title>
<!DOCTYPE html>
<html>
... your full html code with inline css/js ...
</html>
```
Use modern, beautiful styling (dark mode, glassmorphism, #8b5cf6 violet accents)."""

    if chunks:
        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            topic = chunk.metadata.get("topic", "")
            context_parts.append(
                f"--- Excerpt {i} (topic: {topic}, similarity: {chunk.similarity:.3f}) ---\n"
                f"{chunk.content}"
            )
        context_block = "\n\n".join(context_parts)
    else:
        context_block = "(No relevant excerpts found in the NCERT chapter.)"

    user_prompt = f"STUDENT QUESTION: {question}"

    return call_llm(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        context=f"CONTEXT EXCERPTS FROM NCERT:\n\n{context_block}",
        attachment_data=attachment_data,
        attachment_mime_type=attachment_mime_type
    )


def _is_rate_limit(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "429" in msg or "resource_exhausted" in msg or "quota" in msg
