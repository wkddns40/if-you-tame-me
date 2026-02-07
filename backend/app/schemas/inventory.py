from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


class InventoryItemCreate(BaseModel):
    user_id: UUID
    item_type: Optional[str] = Field(None, max_length=50)
    image_url: Optional[str] = None
    metadata: Optional[dict] = None


class InventoryItemResponse(BaseModel):
    item_id: UUID
    user_id: UUID
    item_type: Optional[str] = None
    image_url: Optional[str] = None
    metadata: Optional[dict] = None
    acquired_at: datetime
