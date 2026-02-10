from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.services.tts_manager import TTSManager

router = APIRouter()
tts_manager = TTSManager()

ALLOWED_VOICES = {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}


class SpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4096)
    voice_id: str = Field(default="shimmer")


@router.post("/chat/speak")
async def speak(request: SpeakRequest):
    """TTS with hash-based caching. Always returns audio URL."""
    voice = request.voice_id if request.voice_id in ALLOWED_VOICES else "shimmer"

    result = await tts_manager.get_or_create_speech(text=request.text, voice_id=voice)

    return JSONResponse({
        "audio_url": result.audio_url,
        "cache_hit": result.cache_hit,
    })
