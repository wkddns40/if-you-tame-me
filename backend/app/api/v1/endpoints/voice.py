from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from openai import AsyncOpenAI

from app.core.config import get_settings

router = APIRouter()
settings = get_settings()
openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

ALLOWED_VOICES = {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}


class SpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4096)
    voice_id: str = Field(default="shimmer")


@router.post("/chat/speak")
async def speak(request: SpeakRequest):
    """Convert text to speech using OpenAI TTS API. Returns an MP3 audio stream."""
    voice = request.voice_id if request.voice_id in ALLOWED_VOICES else "shimmer"

    response = await openai_client.audio.speech.create(
        model="tts-1",
        voice=voice,
        input=request.text,
    )

    async def audio_stream():
        async for chunk in response.response.aiter_bytes(1024):
            yield chunk

    return StreamingResponse(
        audio_stream(),
        media_type="audio/mpeg",
        headers={"Content-Disposition": "inline; filename=speech.mp3"},
    )
