"""
src/config.py — Central configuration for the NEET Phase 1 RAG pipeline.

Loads environment variables from .env and exposes typed constants used
throughout the pipeline.

API credentials (GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are
read lazily — only when first accessed — so the PDF-only steps (Steps 1–3) can
run without a .env file present.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the project root (one level above src/)
_PROJECT_ROOT = Path(__file__).parent.parent
load_dotenv(_PROJECT_ROOT / ".env.local")


def _require(key: str) -> str:
    """Read a required env var, raise a clear error if missing."""
    val = os.environ.get(key)
    if not val:
        raise EnvironmentError(
            f"Required environment variable '{key}' is not set. "
            f"Copy .env.example to .env and fill in the value."
        )
    return val


# ── Gemini (lazy) ─────────────────────────────────────────────────────────────
def get_gemini_api_key() -> str:
    """Returns the last key (for backwards compat). Use get_all_gemini_api_keys() for rotation."""
    keys = _require("GEMINI_API_KEY").split(",")
    return keys[-1].strip()

def get_all_gemini_api_keys() -> list[str]:
    """Returns all configured Gemini API keys for round-robin rotation."""
    return [k.strip() for k in _require("GEMINI_API_KEY").split(",") if k.strip()]

# ── Groq (lazy) ─────────────────────────────────────────────────────────────
def get_groq_api_key() -> str:
    return _require("GROQ_API_KEY")

# Current non-deprecated models (as of July 2026)
GEMINI_TEXT_MODEL: str = "gemini-flash-latest"     # text generation (confirmed working)
GEMINI_PRO_MODEL: str = os.getenv("GEMINI_PRO_MODEL", "gemini-2.5-pro")  # heavy reasoning
GEMINI_EMBED_MODEL: str = "gemini-embedding-2"  # embeddings

PRO_FALLBACK_CHAIN = [
    GEMINI_PRO_MODEL,
    "gemini-flash-latest",
    "openai/gpt-oss-120b",
    "qwen/qwen3.6-27b",
    "llama-3.3-70b-versatile"
]

TEXT_FALLBACK_CHAIN = [
    GEMINI_TEXT_MODEL,
    "gemini-2.5-flash-lite",
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b",
    "llama-3.1-8b-instant"
]

# Output dimensionality (Matryoshka reduction)
EMBEDDING_DIM: int = 768

# ── Supabase (lazy) ───────────────────────────────────────────────────────────
def get_supabase_url() -> str:
    return _require("SUPABASE_URL")

def get_supabase_key() -> str:
    return _require("SUPABASE_SERVICE_ROLE_KEY")

SUPABASE_TABLE: str = "neet_chunks"
SUPABASE_RPC_FN: str = "match_neet_chunks"

# ── Retrieval ─────────────────────────────────────────────────────────────────
DEFAULT_TOP_K: int = 5
DEFAULT_SIMILARITY_THRESHOLD: float = 0.4   # cosine similarity lower bound

# ── Retry / back-off ─────────────────────────────────────────────────────────
RETRY_MAX_ATTEMPTS: int = 5
RETRY_BASE_DELAY_S: float = 2.0   # seconds; doubles on each retry (exponential)

# ── PDF ingestion ─────────────────────────────────────────────────────────────
# Minimum characters per page to classify a PDF page as text-based (not scanned)
SCANNED_PAGE_CHAR_THRESHOLD: int = 50

# Markdown output directory (relative to project root)
OUTPUT_DIR: Path = _PROJECT_ROOT / "output"
try:
    OUTPUT_DIR.mkdir(exist_ok=True)
except (OSError, PermissionError):
    pass  # Serverless environments (e.g. Vercel) have read-only filesystems
