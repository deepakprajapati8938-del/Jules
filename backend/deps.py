"""
backend/deps.py — Shared FastAPI dependency injection.
"""
from functools import lru_cache
from src.embedder import _get_supabase as _get_sb_client


@lru_cache(maxsize=1)
def get_supabase():
    """Return (and cache) the Supabase client for use in route handlers."""
    return _get_sb_client()
