from pydantic import BaseModel
from uuid import UUID
from typing import Literal, Optional


class SubscriptionCreate(BaseModel):
    user_id: UUID
    plan_type: Literal["FREE", "SOULMATE"] = "FREE"


class SubscriptionUpdate(BaseModel):
    plan_type: Optional[Literal["FREE", "SOULMATE"]] = None
    is_active: Optional[bool] = None


class SubscriptionResponse(BaseModel):
    user_id: UUID
    plan_type: str = "FREE"
    is_active: bool = True
