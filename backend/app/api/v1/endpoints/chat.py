import json
import logging
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from openai import AsyncOpenAI

from app.core.config import get_settings
from app.core.supabase import get_supabase_client
from app.core.prompts import SYSTEM_PROMPT_TEMPLATE

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


def build_system_prompt(companion: dict, context_logs: list[dict], user_name: str = "") -> str:
    """Build the system prompt with companion persona and RAG context."""
    display_name = user_name or "친구"
    context_str = ""
    if context_logs:
        lines = []
        for log in context_logs:
            speaker = display_name if log['sender'] == 'USER' else companion.get('name', 'Companion')
            msg = log['message'].replace("[USER]", display_name).replace("[user]", display_name)
            lines.append(f"{speaker}: {msg}")
        context_str = "\n".join(lines)
    else:
        context_str = "(No prior conversations yet)"

    prompt = SYSTEM_PROMPT_TEMPLATE.format(
        name=companion.get("name", "Companion"),
        relationship=companion.get("relationship_type", "friend"),
        tone=companion.get("tone_style", "warm and caring"),
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

    # Determine model tier
    plan = get_subscription_plan(companion["user_id"])
    model = "gpt-4o" if plan == "SOULMATE" else "gpt-4o-mini"

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

            print(f"[DEBUG] Received user_name={user_name!r}, message={user_message[:50]!r}")

            try:
                # 2. Embed user message
                user_embedding = await get_embedding(user_message)

                # 3. Save user message with embedding
                save_chat_log(str(companion_id), "USER", user_message, user_embedding)

                # 4. RAG: Search relevant past logs
                relevant_logs = await search_relevant_logs(
                    str(companion_id), user_embedding
                )

                # 5. Build system prompt with context
                system_prompt = build_system_prompt(companion, relevant_logs, user_name)

                # 6. Stream AI response
                stream = await openai_client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
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
