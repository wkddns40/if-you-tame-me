from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Literal


class ChatLogCreate(BaseModel):
    companion_id: UUID
    sender: Literal["USER", "AI"]
    message: str


class ChatLogResponse(BaseModel):
    log_id: int
    companion_id: UUID
    sender: str
    message: str
    timestamp: datetime


class ChatMessage(BaseModel):
    """WebSocket incoming message."""
    message: str
