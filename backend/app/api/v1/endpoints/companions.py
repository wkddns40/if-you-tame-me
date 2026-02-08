from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.supabase import get_supabase_client

router = APIRouter()


class CompanionCreate(BaseModel):
    user_id: UUID
    name: str = Field(..., min_length=1, max_length=50)
    relationship_type: str = Field(default="friend", max_length=50)
    tone_style: str = Field(default="warm and caring", max_length=50)


@router.post("/companions")
def create_companion(payload: CompanionCreate):
    sb = get_supabase_client()
    result = (
        sb.table("Companions")
        .insert({
            "user_id": str(payload.user_id),
            "name": payload.name,
            "relationship_type": payload.relationship_type,
            "tone_style": payload.tone_style,
        })
        .execute()
    )
    return result.data[0]


@router.get("/companions/{companion_id}")
def get_companion(companion_id: UUID):
    sb = get_supabase_client()
    result = (
        sb.table("Companions")
        .select("*")
        .eq("companion_id", str(companion_id))
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Companion not found")
    return result.data


@router.get("/emotions/{companion_id}")
def get_emotions(companion_id: UUID):
    sb = get_supabase_client()
    result = (
        sb.table("Daily_Emotions")
        .select("*")
        .eq("companion_id", str(companion_id))
        .order("date", desc=True)
        .execute()
    )
    return result.data or []


@router.get("/inventory/{user_id}")
def get_inventory(user_id: UUID):
    sb = get_supabase_client()
    result = (
        sb.table("User_Inventory")
        .select("*")
        .eq("user_id", str(user_id))
        .order("acquired_at", desc=True)
        .execute()
    )
    return result.data or []
