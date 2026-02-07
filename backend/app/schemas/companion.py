from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


class CompanionCreate(BaseModel):
    user_id: UUID
    name: str = Field(max_length=50)
    relationship_type: Optional[str] = Field(None, max_length=50)
    tone_style: Optional[str] = Field(None, max_length=50)


class CompanionUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=50)
    relationship_type: Optional[str] = Field(None, max_length=50)
    tone_style: Optional[str] = Field(None, max_length=50)
    summary: Optional[str] = None
    active_traits: Optional[dict] = None


class CompanionResponse(BaseModel):
    companion_id: UUID
    user_id: UUID
    name: str
    relationship_type: Optional[str] = None
    tone_style: Optional[str] = None
    summary: str = ""
    active_traits: dict = {}
    created_at: datetime
