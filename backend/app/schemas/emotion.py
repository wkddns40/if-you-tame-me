from pydantic import BaseModel, Field
from uuid import UUID
from datetime import date, datetime
from typing import Optional


class DailyEmotionCreate(BaseModel):
    date: date
    companion_id: UUID
    primary_emotion: Optional[str] = Field(None, max_length=50)
    color_hex: Optional[str] = Field(None, max_length=7)
    summary_text: Optional[str] = None
    key_quote: Optional[str] = None


class DailyEmotionResponse(BaseModel):
    date: date
    companion_id: UUID
    primary_emotion: Optional[str] = None
    color_hex: Optional[str] = None
    summary_text: Optional[str] = None
    key_quote: Optional[str] = None
    created_at: datetime
