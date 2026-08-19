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

# ── Model names ───────────────────────────────────────────────────────────────
# UPDATE ONLY HERE — frontend fetches these via GET /api/v1/models
#
# LIVE-TESTED on 2026-08-19. Only verified working IDs are listed here.
# Gemini 3.x — stable, long deprecation cycle (safe to pin version numbers)
# Groq — llama-3.x deprecated Aug 16 2026. Use openai/* and qwen/* instead.
GEMINI_TEXT_MODEL: str = os.getenv("GEMINI_TEXT_MODEL", "gemini-3.6-flash")       # tested OK (switched from 3.7 due to 503s)
GEMINI_PRO_MODEL: str  = os.getenv("GEMINI_PRO_MODEL",  "gemini-3.1-pro-preview") # tested OK (quota limited)
GEMINI_EMBED_MODEL: str = "gemini-embedding-2"

# Fallback chains — tried in order on failure. All IDs below are live-tested.
PRO_FALLBACK_CHAIN = [
    GEMINI_PRO_MODEL,           # gemini-3.1-pro-preview ✅
    "gemini-3.6-flash",         # fast fallback              ✅
    "openai/gpt-oss-120b",      # Groq heavy model          ✅
    "openai/gpt-oss-20b",       # Groq light model          ✅
]

TEXT_FALLBACK_CHAIN = [
    GEMINI_TEXT_MODEL,          # gemini-3.6-flash          ✅
    "gemini-3.7-flash",         # try 3.7 if 3.6 fails      ✅
    "gemini-3.5-flash-lite",    # fastest/cheapest Gemini   ✅
    "openai/gpt-oss-20b",       # Groq last resort          ✅
]

# ── Frontend model menu — single source of truth ─────────────────────────────
FRONTEND_MODEL_MENU = [
    {
        "group": "Google (Gemini)",
        "options": [
            {"id": "gemini-3.6-flash",       "label": "Gemini 3.6 Flash",  "sub": "Stable · recommended"},
            {"id": "gemini-3.7-flash",       "label": "Gemini 3.7 Flash",  "sub": "Latest · currently busy"},
            {"id": "gemini-3.1-pro-preview", "label": "Gemini 3.1 Pro",    "sub": "Smartest · complex reasoning"},
            {"id": "gemini-3.5-flash-lite",  "label": "Gemini 3.5 Lite",   "sub": "Fastest · ultra lightweight"},
        ],
    },
    {
        "group": "Groq (Fast Inference)",
        "options": [
            {"id": "openai/gpt-oss-120b",  "label": "GPT-OSS 120B",   "sub": "Heavy · Groq inference"},
            {"id": "openai/gpt-oss-20b",   "label": "GPT-OSS 20B",    "sub": "Fast · Groq inference"},
            {"id": "qwen/qwen3.6-27b",     "label": "Qwen 3.6 27B",   "sub": "Reasoning · Groq inference"},
        ],
    },
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
