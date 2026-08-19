"""
backend/routers/models.py — GET /api/v1/models

Single source of truth for the chat model menu.
Frontend fetches this on load — no hardcoded model lists in any .tsx file.

To add/remove/rename a model in the UI:
  → Edit FRONTEND_MODEL_MENU in src/config.py
  → Done. No frontend code change needed.
"""
from fastapi import APIRouter
from src.config import FRONTEND_MODEL_MENU, GEMINI_TEXT_MODEL

router = APIRouter(prefix="/models", tags=["models"])


@router.get("")
def get_models():
    """Return the model menu groups and the default model id."""
    return {
        "default": GEMINI_TEXT_MODEL,
        "groups": FRONTEND_MODEL_MENU,
    }
