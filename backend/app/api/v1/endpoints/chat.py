import json
import logging
from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from openai import AsyncOpenAI

from app.core.config import get_settings
from app.core.supabase import get_supabase_client
from app.core.prompts import SYSTEM_PROMPT_TEMPLATE, MBTI_PROFILES

logger = logging.getLogger(__name__)

router = APIRouter()
settings = get_settings()
openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

EMBED_MODEL = "text-embedding-3-small"


async def get_embedding(text: str) -> list[float]:
    """Generate embedding vector for the given text."""
    response = await openai_client.embeddings.create(
        model=EMBED_MODEL,
        input=text,
    )
    return response.data[0].embedding


def get_companion(companion_id: str) -> dict | None:
    """Fetch companion profile from Supabase."""
    sb = get_supabase_client()
    result = (
        sb.table("Companions")
        .select("*")
        .eq("companion_id", companion_id)
        .single()
        .execute()
    )
    return result.data


def get_subscription_plan(user_id: str) -> str:
    """Get the user's subscription plan. Defaults to FREE."""
    try:
        sb = get_supabase_client()
        result = (
            sb.table("Subscriptions")
            .select("plan_type")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if result and result.data:
            return result.data["plan_type"]
    except Exception:
        pass
    return "FREE"


async def search_relevant_logs(
    companion_id: str, query_embedding: list[float], top_k: int = 5
) -> list[dict]:
    """Find top-k relevant past chat logs via cosine similarity (Supabase RPC)."""
    try:
        sb = get_supabase_client()
        result = sb.rpc(
            "match_chat_logs",
            {
                "query_embedding": query_embedding,
                "target_companion_id": companion_id,
                "match_count": top_k,
            },
        ).execute()
        return result.data or []
    except Exception as e:
        logger.warning("RAG search failed (skipping): %s", e)
        return []


async def search_relevant_logs_v2(
    companion_id: str, query_embedding: list[float], top_k: int = 8
) -> list[dict]:
    """Recency-weighted semantic search via match_chat_logs_v2."""
    try:
        sb = get_supabase_client()
        result = sb.rpc(
            "match_chat_logs_v2",
            {
                "query_embedding": query_embedding,
                "target_companion_id": companion_id,
                "match_count": top_k,
            },
        ).execute()
        return result.data or []
    except Exception as e:
        logger.warning("RAG v2 search failed, falling back to v1: %s", e)
        return await search_relevant_logs(companion_id, query_embedding, top_k)


def get_recent_logs(companion_id: str, count: int = 6) -> list[dict]:
    """Fetch most recent messages for conversational continuity."""
    try:
        sb = get_supabase_client()
        result = sb.rpc(
            "get_recent_chat_logs",
            {
                "target_companion_id": companion_id,
                "msg_count": count,
            },
        ).execute()
        # Results come newest-first; reverse to chronological order
        logs = result.data or []
        logs.reverse()
        return logs
    except Exception as e:
        logger.warning("Recent logs fetch failed: %s", e)
        return []


def get_recent_emotions(companion_id: str, days: int = 3) -> list[dict]:
    """Fetch recent daily emotions for emotional state context."""
    try:
        sb = get_supabase_client()
        start_date = str(date.today() - timedelta(days=days))
        result = (
            sb.table("Daily_Emotions")
            .select("date, primary_emotion, color_hex, summary_text")
            .eq("companion_id", companion_id)
            .gte("date", start_date)
            .order("date", desc=True)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.warning("Emotions fetch failed: %s", e)
        return []


def save_chat_log(
    companion_id: str, sender: str, message: str, embedding: list[float] | None = None
) -> None:
    """Persist a chat message to Supabase."""
    try:
        sb = get_supabase_client()
        row = {
            "companion_id": companion_id,
            "sender": sender,
            "message": message,
        }
        if embedding:
            row["embedding"] = embedding
        sb.table("Chat_Logs").insert(row).execute()
    except Exception as e:
        logger.warning("Failed to save chat log: %s", e)


def build_system_prompt(
    companion: dict,
    semantic_logs: list[dict],
    recent_logs: list[dict],
    emotions: list[dict],
    user_name: str = "",
) -> str:
    """Build the system prompt with companion persona and hybrid RAG context."""
    display_name = user_name or "친구"
    companion_name = companion.get("name", "Companion")

    def format_log(log: dict) -> str:
        speaker = display_name if log["sender"] == "USER" else companion_name
        msg = log["message"].replace("[USER]", display_name).replace("[user]", display_name)
        return f"{speaker}: {msg}"

    # --- Build 3 context sections ---
    sections = []

    # 1. Recent conversation (last few messages) for continuity
    if recent_logs:
        recent_ids = {log["log_id"] for log in recent_logs}
        lines = [format_log(log) for log in recent_logs]
        sections.append("Recent conversation (last few messages):\n" + "\n".join(lines))
    else:
        recent_ids = set()
        sections.append("(No prior conversations yet)")

    # 2. Related past memories (semantic, deduplicated against recent)
    if semantic_logs:
        past_lines = []
        for log in semantic_logs:
            if log["log_id"] not in recent_ids:
                past_lines.append(format_log(log))
        if past_lines:
            sections.append("Related past memories:\n" + "\n".join(past_lines))

    # 3. Recent emotional state
    if emotions:
        emo_lines = []
        for emo in emotions:
            emo_lines.append(
                f"{emo['date']}: {emo['primary_emotion']} — {emo.get('summary_text', '')}"
            )
        sections.append("Recent emotional state:\n" + "\n".join(emo_lines))

    context_str = "\n\n".join(sections)

    mbti = companion.get("tone_style", "ENFJ")
    profile = MBTI_PROFILES.get(mbti, MBTI_PROFILES["ENFJ"])

    prompt = SYSTEM_PROMPT_TEMPLATE.format(
        name=companion_name,
        relationship=companion.get("relationship_type", "friend"),
        mbti=mbti,
        mbti_label=profile["label"],
        core=profile["core"],
        length=profile["length"],
        do_rules=profile["do"],
        dont_rules=profile["dont"],
        examples=profile["examples"],
        summary=companion.get("summary", ""),
        context_logs=context_str,
        user_name=display_name,
    )
    # Final safety: replace any remaining [USER] placeholders in the entire prompt
    prompt = prompt.replace("[USER]", display_name).replace("[user]", display_name).replace("[User]", display_name)
    return prompt


@router.websocket("/ws/{companion_id}")
async def chat_websocket(websocket: WebSocket, companion_id: UUID):
    await websocket.accept()

    # Load companion profile
    companion = get_companion(str(companion_id))
    if not companion:
        await websocket.send_json({"error": "Companion not found"})
        await websocket.close()
        return

    # Use gpt-4o for all users to ensure rich personality expression
    model = "gpt-4o"

    try:
        while True:
            # 1. Receive user message
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                user_message = payload.get("message", data)
                user_name = payload.get("user_name", "")
            except json.JSONDecodeError:
                user_message = data
                user_name = ""

            try:
                # 2. Embed user message
                user_embedding = await get_embedding(user_message)

                # 3. Save user message with embedding
                save_chat_log(str(companion_id), "USER", user_message, user_embedding)

                # 4. Hybrid retrieval: semantic + recent + emotions
                semantic_logs = await search_relevant_logs_v2(
                    str(companion_id), user_embedding
                )
                recent_logs = get_recent_logs(str(companion_id))
                emotions = get_recent_emotions(str(companion_id))

                # 5. Build system prompt with 3-source context + get MBTI generation params
                system_prompt = build_system_prompt(
                    companion, semantic_logs, recent_logs, emotions, user_name
                )
                mbti = companion.get("tone_style", "ENFJ")
                profile = MBTI_PROFILES.get(mbti, MBTI_PROFILES["ENFJ"])

                # 6. Stream AI response (max_tokens & temperature per MBTI)
                stream = await openai_client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    max_tokens=profile.get("max_tokens", 120),
                    temperature=profile.get("temperature", 0.8),
                    stream=True,
                )

                full_response = ""
                async for chunk in stream:
                    delta = chunk.choices[0].delta
                    if delta.content:
                        full_response += delta.content
                        await websocket.send_json(
                            {"type": "stream", "content": delta.content}
                        )

                # 7. Signal stream end
                await websocket.send_json({"type": "end", "content": full_response})

                # 8. Save AI response with embedding
                ai_embedding = await get_embedding(full_response)
                save_chat_log(str(companion_id), "AI", full_response, ai_embedding)

            except Exception as e:
                logger.error("Chat processing error: %s", e, exc_info=True)
                # Send error as "end" so the frontend always shows a message
                await websocket.send_json(
                    {"type": "end", "content": "죄송해요, 잠시 문제가 생겼어요. 다시 말씀해 주시겠어요?"}
                )

    except WebSocketDisconnect:
        pass
