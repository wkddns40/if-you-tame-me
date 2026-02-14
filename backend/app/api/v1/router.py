from fastapi import APIRouter

from app.api.v1.endpoints import chat, companions, store

router = APIRouter()

router.include_router(chat.router, tags=["chat"])
router.include_router(companions.router, tags=["companions"])
router.include_router(store.router, tags=["store"])
