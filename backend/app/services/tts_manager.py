"""
TTS Manager — Hash-based caching for OpenAI TTS.

Cache hit  → return stored audio URL, bump access_count.
Cache miss → call OpenAI TTS, upload to Supabase Storage, persist in TTS_Cache.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass

from openai import AsyncOpenAI

from app.core.config import get_settings
from app.core.supabase import get_supabase_client

logger = logging.getLogger(__name__)

STORAGE_BUCKET = "tts-audio"


@dataclass
class TTSResult:
    audio_url: str
    cache_hit: bool
    duration_ms: int | None


class TTSManager:
    def __init__(self):
        settings = get_settings()
        self._openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    # ── public ───────────────────────────────────────────────
    async def get_or_create_speech(
        self,
        text: str,
        voice_id: str = "shimmer",
        model: str = "tts-1",
    ) -> TTSResult:
        """Return cached audio if available, otherwise generate and cache."""
        text_hash = self._make_hash(text, voice_id)

        # 1. Cache lookup
        cached = self._cache_lookup(text_hash)
        if cached:
            self._bump_access(text_hash)
            logger.info("TTS cache HIT  hash=%s", text_hash[:12])
            return TTSResult(
                audio_url=cached["audio_url"],
                cache_hit=True,
                duration_ms=cached.get("duration_ms"),
            )

        # 2. Generate via OpenAI TTS
        logger.info("TTS cache MISS hash=%s — generating", text_hash[:12])
        audio_bytes = await self._generate_speech(text, voice_id, model)

        # 3. Upload to Supabase Storage
        storage_path = f"{voice_id}/{text_hash}.mp3"
        audio_url = self._upload_to_storage(storage_path, audio_bytes)

        # 4. Insert cache record
        self._insert_cache(text_hash, voice_id, audio_url)

        return TTSResult(audio_url=audio_url, cache_hit=False, duration_ms=None)

    # ── internals ────────────────────────────────────────────
    @staticmethod
    def _make_hash(text: str, voice_id: str) -> str:
        """SHA-256 of (text + voice_id)."""
        raw = f"{text}|{voice_id}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @staticmethod
    def _cache_lookup(text_hash: str) -> dict | None:
        try:
            sb = get_supabase_client()
            result = (
                sb.table("TTS_Cache")
                .select("audio_url, duration_ms")
                .eq("text_hash", text_hash)
                .maybe_single()
                .execute()
            )
            return result.data if result and result.data else None
        except Exception as e:
            logger.warning("TTS cache lookup failed: %s", e)
            return None

    @staticmethod
    def _bump_access(text_hash: str) -> None:
        try:
            sb = get_supabase_client()
            # Increment access_count and refresh last_accessed_at via raw SQL-like update
            row = (
                sb.table("TTS_Cache")
                .select("access_count")
                .eq("text_hash", text_hash)
                .single()
                .execute()
            )
            new_count = (row.data.get("access_count", 0) + 1) if row.data else 1
            sb.table("TTS_Cache").update(
                {"access_count": new_count, "last_accessed_at": "now()"}
            ).eq("text_hash", text_hash).execute()
        except Exception as e:
            logger.warning("TTS cache bump failed: %s", e)

    async def _generate_speech(
        self, text: str, voice_id: str, model: str
    ) -> bytes:
        response = await self._openai.audio.speech.create(
            model=model,
            voice=voice_id,
            input=text,
        )
        return response.content

    @staticmethod
    def _upload_to_storage(path: str, data: bytes) -> str:
        sb = get_supabase_client()
        sb.storage.from_(STORAGE_BUCKET).upload(
            path,
            data,
            file_options={"content-type": "audio/mpeg", "upsert": "true"},
        )
        return sb.storage.from_(STORAGE_BUCKET).get_public_url(path)

    @staticmethod
    def _insert_cache(text_hash: str, voice_id: str, audio_url: str) -> None:
        try:
            sb = get_supabase_client()
            sb.table("TTS_Cache").insert(
                {
                    "text_hash": text_hash,
                    "voice_id": voice_id,
                    "audio_url": audio_url,
                }
            ).execute()
        except Exception as e:
            logger.warning("TTS cache insert failed: %s", e)
