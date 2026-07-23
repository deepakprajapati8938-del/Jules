"""
src/llm_wrapper.py — Central LLM call wrapper for Jules NEET Prep.

All Gemini text-generation calls in this project go through call_llm().
Never call the Gemini SDK directly in feature files — route every LLM
call through this function so a future provider swap is a one-file change.

Rule: core layer (this file) must NOT import from any feature module.
"""

import logging
import time

from src.config import GEMINI_TEXT_MODEL, get_all_gemini_api_keys

logger = logging.getLogger(__name__)

# ── Lazy client pool (same rotation logic as embedder) ────────────────────────
_clients: list = []
_client_index: int = 0


def _get_client():
    global _clients
    if not _clients:
        from google import genai
        for key in get_all_gemini_api_keys():
            _clients.append(genai.Client(api_key=key))
    return _clients[_client_index % len(_clients)]


def _rotate_client() -> None:
    global _client_index
    _client_index = (_client_index + 1) % max(len(_clients), 1)


def _is_rate_limit(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "429" in msg or "resource_exhausted" in msg or "quota" in msg


# ── Public interface ──────────────────────────────────────────────────────────

def call_llm(
    system_prompt: str,
    user_prompt: str,
    context: str | None = None,
    *,
    max_retries: int = 5,
    base_delay: float = 2.0,
    model_name: str | None = None,
    attachment_data: str | None = None,
    attachment_mime_type: str | None = None,
) -> str:
    """
    Single entry point for all text-generation LLM calls in this project.

    Args:
        system_prompt: Instructions / role for the model.
        user_prompt:   The user's actual message or task.
        context:       Optional retrieved context (e.g. NCERT chunks).
                       Injected between system and user prompt when provided.
        max_retries:   How many times to retry on rate-limit errors.
        base_delay:    Initial backoff delay in seconds (doubles each retry).
        model_name:    Optional override for the Gemini model (e.g., 'gemini-pro-latest').

    Returns:
        The model's text response as a plain string.

    Raises:
        RuntimeError: If all retries are exhausted.
        Exception:    Any non-rate-limit error is re-raised immediately.
    """
    import base64
    from google.genai import types as _types

    # Build the prompt content
    full_user = user_prompt
    if context:
        full_user = f"CONTEXT:\n{context}\n\n---\n\n{user_prompt}"

    parts = [_types.Part(text=full_user)]
    
    if attachment_data and attachment_mime_type:
        try:
            # Strip data URI scheme if present (e.g. data:image/jpeg;base64,...)
            if "," in attachment_data:
                b64_str = attachment_data.split(",", 1)[1]
            else:
                b64_str = attachment_data
            
            raw_bytes = base64.b64decode(b64_str)
            parts.append(_types.Part.from_bytes(data=raw_bytes, mime_type=attachment_mime_type))
        except Exception as e:
            print(f"Failed to attach file: {e}")

    contents = [
        _types.Content(
            role="user",
            parts=parts,
        )
    ]

    config = _types.GenerateContentConfig(
        system_instruction=system_prompt,
    )

    # Ensure pool is initialised
    _get_client()
    delay = base_delay

    final_model = model_name if model_name else GEMINI_TEXT_MODEL

    # Auto-route to Gemini if there's an attachment (Groq doesn't support multimodal)
    if attachment_data:
        final_model = "gemini-flash-latest"

    # Route to Groq if requested
    if final_model.startswith(("llama-", "mixtral-", "gemma-", "qwen", "moonshot", "openai/")):
        from src.config import get_groq_api_key
        from groq import Groq
        
        messages = [{"role": "system", "content": system_prompt}]
        messages.append({"role": "user", "content": full_user})
            
        client = Groq(api_key=get_groq_api_key())
        for attempt in range(1, max_retries + 1):
            try:
                response = client.chat.completions.create(
                    messages=messages,
                    model=final_model,
                )
                return response.choices[0].message.content.strip()
            except Exception as exc:
                if "429" in str(exc).lower() and attempt < max_retries:
                    logger.warning(f"[llm_wrapper] Groq rate-limited (attempt {attempt}/{max_retries}). Sleeping {delay:.1f}s …")
                    time.sleep(delay)
                    delay *= 2
                else:
                    raise
        raise RuntimeError(f"call_llm() failed after {max_retries} retries on Groq.")

    # Otherwise route to Gemini
    for attempt in range(1, max_retries + 1):
        try:
            client = _get_client()
            response = client.models.generate_content(
                model=final_model,
                contents=contents,
                config=config,
            )
            return response.text.strip()

        except Exception as exc:
            if _is_rate_limit(exc) and attempt < max_retries:
                _rotate_client()
                if attempt % len(_clients) == 0:
                    logger.warning(
                        f"[llm_wrapper] All keys rate-limited (attempt {attempt}/{max_retries}). "
                        f"Sleeping {delay:.1f}s …"
                    )
                    time.sleep(delay)
                    delay *= 2
                else:
                    logger.warning(
                        f"[llm_wrapper] Rate-limited — rotated to next key "
                        f"(attempt {attempt}/{max_retries})."
                    )
            else:
                raise

    raise RuntimeError(
        f"call_llm() failed after {max_retries} retries. "
        "Check your API quota or increase max_retries."
    )
