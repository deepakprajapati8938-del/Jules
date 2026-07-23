"""
backend/routers/saves.py — Save/Favorites CRUD.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Literal, Optional
from supabase import Client

from backend.deps import get_supabase

router = APIRouter(prefix="/saves", tags=["saves"])

ValidItemType = Literal["message", "diagram", "answer", "image"]
ValidCategory = Literal["notes", "revision", "favorites", "read_later"]

class SavedItem(BaseModel):
    id: int
    item_type: ValidItemType
    source_reference: str
    category: ValidCategory
    created_at: str

class CreateSave(BaseModel):
    item_type: ValidItemType
    source_reference: str
    category: ValidCategory

@router.post("", response_model=SavedItem)
def create_save(body: CreateSave, sb: Client = Depends(get_supabase)):
    res = sb.table("saved_items").insert(body.model_dump()).execute()
    return SavedItem(**res.data[0])

@router.get("", response_model=list[SavedItem])
def list_saves(
    category: Optional[ValidCategory] = Query(default=None),
    sb: Client = Depends(get_supabase),
):
    q = sb.table("saved_items").select("*").order("created_at", desc=True)
    if category:
        q = q.eq("category", category)
    res = q.execute()
    return [SavedItem(**r) for r in (res.data or [])]

@router.delete("/{item_id}")
def delete_save(item_id: int, sb: Client = Depends(get_supabase)):
    sb.table("saved_items").delete().eq("id", item_id).execute()
    return {"deleted": item_id}
