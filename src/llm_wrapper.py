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

import threading

# ── Lazy client pool (same rotation logic as embedder) ────────────────────────
_clients: list = []
_client_index: int = 0
_client_lock = threading.Lock()


def _get_client():
    global _clients
    with _client_lock:
        if not _clients:
            from google import genai
            for key in get_all_gemini_api_keys():
                _clients.append(genai.Client(api_key=key))
        return _clients[_client_index % len(_clients)]


def _rotate_client() -> None:
    global _client_index
    with _client_lock:
        _client_index = (_client_index + 1) % max(len(_clients), 1)


def _is_rate_limit(exc: Exception) -> bool:
    """
    Returns True ONLY for quota/key-specific errors where rotating to a
    different API key might succeed.

    429 / resource_exhausted / quota  → THIS key's quota is done, try next key ✓
    403 / permission_denied           → THIS key is invalid/dead, try next key ✓

    503 / unavailable / overloaded    → The MODEL itself is down globally.
                                        Rotating keys won't help at all.
                                        Let it raise so call_llm falls to next
                                        model in the fallback chain instead.
    """
    msg = str(exc).lower()
    return (
        "429" in msg or
        "resource_exhausted" in msg or
        "quota" in msg or
        "403" in msg or
        "permission_denied" in msg
    )


# ── Public interface ──────────────────────────────────────────────────────────

def _call_single_model(
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    context: str | None = None,
    max_retries: int = 5,
    base_delay: float = 2.0,
    attachment_data: str | None = None,
    attachment_mime_type: str | None = None,
) -> str:
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

    final_model = model_name
    
    # Auto-route to a Gemini model if there's an attachment (Groq doesn't support multimodal)
    if attachment_data and not final_model.startswith("gemini-"):
        final_model = "gemini-3.6-flash"

    # Route to Groq if requested
    if final_model.startswith(("llama-", "mixtral-", "gemma-", "qwen", "openai/")):
        from src.config import get_groq_api_key
        from groq import Groq
        import re as _re
        
        messages = [{"role": "system", "content": system_prompt}]
        messages.append({"role": "user", "content": full_user})
            
        client = Groq(api_key=get_groq_api_key())
        for attempt in range(1, max_retries + 1):
            try:
                response = client.chat.completions.create(
                    messages=messages,
                    model=final_model,
                )
                raw = response.choices[0].message.content.strip()
                # Strip <think>...</think> reasoning blocks (Qwen3, DeepSeek etc.)
                raw = _re.sub(r'<think>.*?</think>\s*', '', raw, flags=_re.DOTALL).strip()
                return raw
            except Exception as exc:
                if "429" in str(exc).lower() and attempt < max_retries:
                    logger.warning(f"[llm_wrapper] Groq rate-limited (attempt {attempt}/{max_retries}). Sleeping {delay:.1f}s …")
                    time.sleep(delay)
                    delay *= 2
                else:
                    raise
        raise RuntimeError(f"_call_single_model() failed after {max_retries} retries on Groq.")

    # Otherwise route to Gemini
    _get_client() # ensure clients are loaded
    gemini_max_retries = max(max_retries, len(_clients))
    
    for attempt in range(1, gemini_max_retries + 1):
        try:
            client = _get_client()
            response = client.models.generate_content(
                model=final_model,
                contents=contents,
                config=config,
            )
            _rotate_client()  # true round-robin: rotate after every successful call
            return response.text.strip()

        except Exception as exc:
            if _is_rate_limit(exc) and attempt < gemini_max_retries:
                _rotate_client()
                if attempt % len(_clients) == 0:
                    logger.warning(
                        f"[llm_wrapper] All keys rate-limited (attempt {attempt}/{gemini_max_retries}). "
                        f"Sleeping {delay:.1f}s …"
                    )
                    time.sleep(delay)
                    delay *= 2
                else:
                    logger.warning(
                        f"[llm_wrapper] Rate-limited — rotated to next key "
                        f"(attempt {attempt}/{gemini_max_retries})."
                    )
            else:
                raise

    raise RuntimeError(
        f"_call_single_model() failed after {gemini_max_retries} retries. "
        "Check your API quota or increase max_retries."
    )


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
    from src.config import PRO_FALLBACK_CHAIN, TEXT_FALLBACK_CHAIN, GEMINI_PRO_MODEL, GEMINI_TEXT_MODEL
    
    # Determine the fallback chain
    if model_name == GEMINI_PRO_MODEL:
        chain = PRO_FALLBACK_CHAIN
    else:
        # Start with the default text fallback chain
        chain = list(TEXT_FALLBACK_CHAIN)
        # If the user specifically requested a model, try it first
        if model_name:
            if model_name in chain:
                chain.remove(model_name)
            chain.insert(0, model_name)
            
    last_error = None
    for model in chain:
        try:
            return _call_single_model(
                model_name=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                context=context,
                max_retries=max_retries,
                base_delay=base_delay,
                attachment_data=attachment_data,
                attachment_mime_type=attachment_mime_type
            )
        except Exception as e:
            logger.warning(f"[llm_wrapper] Model '{model}' failed: {e}. Trying next fallback if available...")
            last_error = e
            
    raise RuntimeError(f"All models in fallback chain failed. Last error: {last_error}")
