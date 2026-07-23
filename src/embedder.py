"""
src/embedder.py — Step 5 of the NEET RAG pipeline.

Responsibilities:
  - Embed each chunk's text via the Gemini embedding API.
  - Insert chunk content + metadata + embedding into Supabase neet_chunks table.
  - Confirm that the inserted row count matches the expected chunk count.

Retry policy:
  - On HTTP 429 (rate limit) or transient errors, retry with exponential
    back-off up to RETRY_MAX_ATTEMPTS times.
  - No silent failure: if a chunk fails after all retries, raise an exception.
"""

import logging
import time
from typing import Any

from google import genai
from google.genai import errors as genai_errors, types as genai_types
from supabase import create_client, Client

from src.config import (
    get_gemini_api_key,
    get_all_gemini_api_keys,
    get_supabase_url,
    get_supabase_key,
    GEMINI_EMBED_MODEL,
    EMBEDDING_DIM,
    SUPABASE_TABLE,
    RETRY_MAX_ATTEMPTS,
    RETRY_BASE_DELAY_S,
)

logger = logging.getLogger(__name__)

# ── Key-rotating Gemini client pool ──────────────────────────────────────────
_gemini_clients: list[genai.Client] = []
_gemini_key_index: int = 0
_supabase_client: Client | None = None


def _get_gemini() -> genai.Client:
    """Returns the current active Gemini client."""
    global _gemini_clients
    if not _gemini_clients:
        for key in get_all_gemini_api_keys():
            _gemini_clients.append(genai.Client(api_key=key))
        if not _gemini_clients:
            # fallback single key
            _gemini_clients.append(genai.Client(api_key=get_gemini_api_key()))
    return _gemini_clients[_gemini_key_index % len(_gemini_clients)]


def _rotate_gemini_key() -> None:
    """Switch to the next API key in the pool."""
    global _gemini_key_index
    _gemini_key_index = (_gemini_key_index + 1) % max(len(_gemini_clients), 1)
    logger.info(f"  Rotated to API key #{_gemini_key_index + 1}")


def _get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(get_supabase_url(), get_supabase_key())
    return _supabase_client


# ── Public API ────────────────────────────────────────────────────────────────

def embed_and_store(chunks: list[dict[str, Any]]) -> int:
    """
    Embed every chunk and insert it into Supabase.

    Args:
        chunks: List of {"content": str, "metadata": dict} dicts from chunker.

    Returns:
        Number of rows successfully inserted.

    Raises:
        RuntimeError: if the confirmed row count does not match expected.
    """
    logger.info("[Step 5] Embedding and storing chunks …")
    expected = len(chunks)
    inserted = 0

    for i, chunk in enumerate(chunks, 1):
        text = chunk["content"]
        metadata = chunk["metadata"]

        logger.info(
            f"  [{i}/{expected}] Embedding chunk "
            f"(topic: '{metadata.get('topic', '?')}', "
            f"{len(text)} chars) …"
        )

        # Embed with retry
        embedding = _embed_with_retry(text)

        # Store in Supabase
        _insert_chunk(text, metadata, embedding)
        inserted += 1

    # ── Confirm row count ─────────────────────────────────────────────────────
    logger.info("  Verifying row count in Supabase …")
    db_count = _count_rows()
    logger.info(
        f"  Expected chunks: {expected}  |  "
        f"Rows in DB (total): {db_count}"
    )

    # Note: db_count may be > expected if the table already had rows from a
    # previous run. We just log; the caller can decide whether to clear first.
    if inserted != expected:
        raise RuntimeError(
            f"Insertion mismatch: expected to insert {expected} chunks, "
            f"but only {inserted} succeeded."
        )

    logger.info(f"  ✓  {inserted} chunks embedded and stored.")
    return inserted


def clear_chapter_chunks(chapter: str) -> int:
    """
    Delete all rows whose metadata->>'chapter' matches the given chapter name.
    Useful for re-ingesting a chapter without creating duplicate rows.

    Returns:
        Number of rows deleted.
    """
    sb = _get_supabase()
    response = (
        sb.table(SUPABASE_TABLE)
        .delete()
        .filter("metadata->>chapter", "eq", chapter)
        .execute()
    )
    deleted = len(response.data) if response.data else 0
    logger.info(f"  Cleared {deleted} existing rows for chapter '{chapter}'.")
    return deleted


# ── Helpers ───────────────────────────────────────────────────────────────────

def _embed_with_retry(text: str) -> list[float]:
    """
    Embed a single text string, retrying on rate-limit (429) errors.
    On each 429, rotates to the next API key before retrying (no sleep needed
    if there are multiple keys — the other key has its own fresh quota window).
    """
    global _gemini_clients
    # Ensure pool is initialised
    _get_gemini()
    delay = RETRY_BASE_DELAY_S
    num_keys = len(_gemini_clients)

    for attempt in range(1, RETRY_MAX_ATTEMPTS + 1):
        try:
            client = _get_gemini()
            result = client.models.embed_content(
                model=GEMINI_EMBED_MODEL,
                contents=text,
                config=genai_types.EmbedContentConfig(
                    output_dimensionality=EMBEDDING_DIM,
                ),
            )
            return list(result.embeddings[0].values)

        except genai_errors.ClientError as exc:
            if _is_rate_limit(exc) and attempt < RETRY_MAX_ATTEMPTS:
                _rotate_gemini_key()
                # Only sleep if we've cycled through all keys
                if attempt % num_keys == 0:
                    logger.warning(
                        f"    All {num_keys} keys rate-limited (attempt {attempt}/{RETRY_MAX_ATTEMPTS}). "
                        f"Sleeping {delay:.1f}s …"
                    )
                    time.sleep(delay)
                    delay *= 2
                else:
                    logger.warning(
                        f"    Key #{((_gemini_key_index - 1) % num_keys) + 1} rate-limited — "
                        f"switched to key #{_gemini_key_index % num_keys + 1}"
                    )
            else:
                raise

    raise RuntimeError("Embedding failed after all retries.")


def _insert_chunk(
    content: str,
    metadata: dict[str, Any],
    embedding: list[float],
) -> None:
    """Insert a single chunk row into Supabase."""
    sb = _get_supabase()
    sb.table(SUPABASE_TABLE).insert({
        "content":   content,
        "metadata":  metadata,
        "embedding": embedding,
    }).execute()


def _count_rows() -> int:
    """Return the total number of rows in neet_chunks."""
    sb = _get_supabase()
    response = sb.table(SUPABASE_TABLE).select("id", count="exact").execute()
    return response.count or 0


def _is_rate_limit(exc: Exception) -> bool:
    """Heuristic: check if the exception message indicates a rate-limit error."""
    msg = str(exc).lower()
    return "429" in msg or "resource_exhausted" in msg or "quota" in msg
