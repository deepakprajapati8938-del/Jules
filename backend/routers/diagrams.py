"""
backend/routers/diagrams.py — Phase 10 Interactive Artifacts
Endpoints for fetching diagrams and reviewing hotspots.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from supabase import Client
from backend.deps import get_supabase

router = APIRouter(prefix="/diagrams", tags=["diagrams"])

class HotspotOut(BaseModel):
    id: int
    diagram_id: int
    part_label: str
    x_pct: float
    y_pct: float
    explanation: str
    confidence: str
    reviewed: bool

class DiagramOut(BaseModel):
    id: int
    image_path: str
    caption: Optional[str] = None
    hotspots: List[HotspotOut] = []

@router.get("/unreviewed", response_model=List[DiagramOut])
def get_unreviewed_diagrams(sb: Client = Depends(get_supabase)):
    """Fetch diagrams that have unreviewed hotspots."""
    try:
        # Fetch hotspots that are unreviewed
        res = sb.table("diagram_hotspots").select("*, diagrams(id, image_path, caption)").eq("reviewed", False).execute()
        
        # Group by diagram
        diagrams_map = {}
        for row in (res.data or []):
            diag = row.get("diagrams")
            if not diag:
                continue
                
            diag_id = diag["id"]
            if diag_id not in diagrams_map:
                diagrams_map[diag_id] = DiagramOut(
                    id=diag_id,
                    image_path=diag.get("image_path", ""),
                    caption=diag.get("caption", ""),
                    hotspots=[]
                )
            
            diagrams_map[diag_id].hotspots.append(HotspotOut(
                id=row["id"],
                diagram_id=row["diagram_id"],
                part_label=row["part_label"],
                x_pct=row["x_pct"],
                y_pct=row["y_pct"],
                explanation=row["explanation"],
                confidence=row["confidence"],
                reviewed=row["reviewed"]
            ))
            
        return list(diagrams_map.values())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/hotspots/{hotspot_id}/approve")
def approve_hotspot(hotspot_id: int, sb: Client = Depends(get_supabase)):
    try:
        sb.table("diagram_hotspots").update({"reviewed": True}).eq("id", hotspot_id).execute()
        return {"status": "success"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.delete("/hotspots/{hotspot_id}")
def reject_hotspot(hotspot_id: int, sb: Client = Depends(get_supabase)):
    try:
        sb.table("diagram_hotspots").delete().eq("id", hotspot_id).execute()
        return {"status": "success"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
