from fastapi import APIRouter

router = APIRouter()

# Endpoint modules will be included here as they are implemented
# e.g.:
# from app.api.v1.endpoints import chat, store, speak
# router.include_router(chat.router, tags=["chat"])
# router.include_router(store.router, tags=["store"])
# router.include_router(speak.router, tags=["speak"])
