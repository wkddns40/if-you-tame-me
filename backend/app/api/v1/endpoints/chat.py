import json
import logging
from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from openai import AsyncOpenAI

from app.core.config import get_settings
from app.core.supabase import get_supabase_client
from app.core.prompts import (
    SYSTEM_PROMPT_TEMPLATE,
    MBTI_PROFILES,
    STYLE_PROFILES,
    ADAPTIVE_SYSTEM_PROMPT_TEMPLATE,
    MBTI_DISCOVERY_PROMPT,
    NAMING_GREETING,
    NAMING_PROMPT_MESSAGE,
    NAMING_CONFIRM_TEMPLATE,
    NAMING_SENTIMENT_PROMPT,
    NAMING_EXTRACT_PROMPT,
    USER_NAME_EXTRACT_PROMPT,
    SPONTANEOUS_NAMING_PROMPT,
)
from app.services.llm_engine import LLMEngine

logger = logging.getLogger(__name__)

router = APIRouter()
settings = get_settings()
openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

EMBED_MODEL = "text-embedding-3-small"
llm_engine = LLMEngine()


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


# ── Naming ceremony state ──
# Tracks companions that have been asked to be named (awaiting user's name input)
_naming_awaiting: set[str] = set()
# Tracks companions that have already been prompted (so we don't re-ask)
_naming_prompted: set[str] = set()


async def check_naming_sentiment(companion_id: str) -> float:
    """Quick sentiment analysis on recent messages. Returns 0.0-1.0."""
    try:
        sb = get_supabase_client()
        result = (
            sb.table("Chat_Logs")
            .select("sender, message")
            .eq("companion_id", companion_id)
            .order("timestamp", desc=True)
            .limit(10)
            .execute()
        )
        logs = result.data or []
        if not logs:
            return 0.5
        logs.reverse()
        lines = [f"{'User' if l['sender'] == 'USER' else 'AI'}: {l['message']}" for l in logs]
        prompt = NAMING_SENTIMENT_PROMPT.format(recent_messages="\n".join(lines))

        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=30,
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        result_data = json.loads(response.choices[0].message.content)
        return float(result_data.get("score", 0.5))
    except Exception as e:
        logger.warning("Sentiment check failed: %s", e)
        return 0.5


async def extract_user_name(message: str) -> str | None:
    """Extract the user's name/nickname from their message using GPT."""
    try:
        prompt = USER_NAME_EXTRACT_PROMPT.format(message=message)
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=30,
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        result_data = json.loads(response.choices[0].message.content)
        name = result_data.get("name", "NONE").strip()
        if name and name != "NONE":
            return name
        return None
    except Exception as e:
        logger.warning("User name extraction failed: %s", e)
        return None


async def extract_name_from_message(message: str) -> str | None:
    """Extract a name from the user's message using GPT."""
    try:
        prompt = NAMING_EXTRACT_PROMPT.format(message=message)
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=30,
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        result_data = json.loads(response.choices[0].message.content)
        name = result_data.get("name", "NONE").strip()
        if name and name != "NONE":
            return name
        return None
    except Exception as e:
        logger.warning("Name extraction failed: %s", e)
        return None


async def check_spontaneous_naming(companion_id: str, companion: dict, message: str) -> dict | None:
    """Check if the user is spontaneously naming the AI during conversation.
    Returns {name, confirmation} if detected, None otherwise."""
    # Only check if companion is still unnamed
    if companion.get("name", "") != "???":
        return None

    try:
        prompt = SPONTANEOUS_NAMING_PROMPT.format(message=message)
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=50,
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        result_data = json.loads(response.choices[0].message.content)

        if not result_data.get("is_naming", False):
            return None

        name = result_data.get("name", "NONE").strip()
        if not name or name == "NONE":
            return None

        # Update DB
        sb = get_supabase_client()
        sb.table("Companions").update(
            {"name": name}
        ).eq("companion_id", companion_id).execute()

        companion["name"] = name
        # Clear naming ceremony state since user named spontaneously
        _naming_awaiting.discard(companion_id)
        _naming_prompted.add(companion_id)

        confirmation = NAMING_CONFIRM_TEMPLATE.format(name=name)
        logger.info("Spontaneous naming for %s: %s", companion_id, name)
        return {"name": name, "confirmation": confirmation}
    except Exception as e:
        logger.warning("Spontaneous naming check failed: %s", e)
        return None


async def check_naming_event(companion_id: str, companion: dict) -> str | None:
    """Check if it's time for the naming ceremony (10+ AI turns, positive sentiment).
    Returns the naming prompt message if triggered, None otherwise."""
    # Skip if already named or already prompted
    if companion.get("name", "") != "???":
        return None
    if companion_id in _naming_prompted:
        return None

    ai_count = get_chat_count(companion_id)
    if ai_count < 10:
        return None

    # Check sentiment
    sentiment = await check_naming_sentiment(companion_id)
    logger.info("Naming sentiment for %s: %.2f", companion_id, sentiment)
    if sentiment < 0.7:
        return None

    _naming_prompted.add(companion_id)
    _naming_awaiting.add(companion_id)
    return NAMING_PROMPT_MESSAGE


async def process_naming(companion_id: str, companion: dict, user_message: str) -> dict | None:
    """Process a naming response from the user.
    Returns {name, confirmation} if successful, None otherwise."""
    if companion_id not in _naming_awaiting:
        return None

    extracted_name = await extract_name_from_message(user_message)
    if not extracted_name:
        return None

    # Update DB
    try:
        sb = get_supabase_client()
        sb.table("Companions").update(
            {"name": extracted_name}
        ).eq("companion_id", companion_id).execute()
    except Exception as e:
        logger.error("Failed to update companion name: %s", e)
        return None

    companion["name"] = extracted_name
    _naming_awaiting.discard(companion_id)

    confirmation = NAMING_CONFIRM_TEMPLATE.format(name=extracted_name)
    logger.info("Companion %s named: %s", companion_id, extracted_name)
    return {"name": extracted_name, "confirmation": confirmation}


def get_chat_count(companion_id: str) -> int:
    """Count AI messages for this companion."""
    try:
        sb = get_supabase_client()
        result = (
            sb.table("Chat_Logs")
            .select("log_id", count="exact")
            .eq("companion_id", companion_id)
            .eq("sender", "AI")
            .execute()
        )
        return result.count or 0
    except Exception as e:
        logger.warning("Failed to count chat logs: %s", e)
        return 0


def get_chat_history_for_discovery(companion_id: str, limit: int = 60) -> str:
    """Fetch recent chat history formatted for MBTI discovery analysis."""
    try:
        sb = get_supabase_client()
        result = (
            sb.table("Chat_Logs")
            .select("sender, message")
            .eq("companion_id", companion_id)
            .order("timestamp", desc=True)
            .limit(limit)
            .execute()
        )
        logs = result.data or []
        logs.reverse()
        lines = []
        for log in logs:
            role = "User" if log["sender"] == "USER" else "AI"
            lines.append(f"{role}: {log['message']}")
        return "\n".join(lines)
    except Exception as e:
        logger.warning("Failed to fetch chat history for discovery: %s", e)
        return ""


async def discover_personality(companion_id: str, companion: dict) -> str | None:
    """Analyze chat history and discover MBTI personality after 50+ turns.
    Returns announcement message if discovered, None otherwise."""
    tone_style = companion.get("tone_style", "")

    # Already discovered MBTI — skip
    if tone_style in MBTI_PROFILES:
        return None

    # Not yet at 50 AI turns — skip
    ai_count = get_chat_count(companion_id)
    if ai_count < 50:
        return None

    # Fetch chat history for analysis
    chat_history = get_chat_history_for_discovery(companion_id)
    if not chat_history:
        return None

    try:
        prompt = MBTI_DISCOVERY_PROMPT.format(chat_history=chat_history)
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.3,
            response_format={"type": "json_object"},
        )

        result = json.loads(response.choices[0].message.content)
        discovered_mbti = result.get("mbti", "").upper()

        if discovered_mbti not in MBTI_PROFILES:
            logger.warning("Invalid MBTI discovered: %s", discovered_mbti)
            return None

        # Update companion's tone_style in DB
        sb = get_supabase_client()
        sb.table("Companions").update(
            {"tone_style": discovered_mbti}
        ).eq("companion_id", companion_id).execute()

        # Update local companion dict so subsequent messages use the new profile
        companion["tone_style"] = discovered_mbti

        announcement = result.get("announcement", f"대화하다 보니 저는 어느새 {discovered_mbti}가 된 것 같아요.")
        logger.info("MBTI discovered for %s: %s", companion_id, discovered_mbti)
        return announcement

    except Exception as e:
        logger.error("MBTI discovery failed: %s", e, exc_info=True)
        return None


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

    tone_style = companion.get("tone_style", "empathetic")

    # Branch: discovered MBTI → full MBTI prompt, otherwise → adaptive style prompt
    if tone_style in MBTI_PROFILES:
        profile = MBTI_PROFILES[tone_style]
        prompt = SYSTEM_PROMPT_TEMPLATE.format(
            name=companion_name,
            relationship=companion.get("relationship_type", "friend"),
            mbti=tone_style,
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
    else:
        style = STYLE_PROFILES.get(tone_style, STYLE_PROFILES["empathetic"])
        prompt = ADAPTIVE_SYSTEM_PROMPT_TEMPLATE.format(
            name=companion_name,
            relationship=companion.get("relationship_type", "friend"),
            style_direction=style["direction"],
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

    # Look up user tier for smart routing
    user_tier = get_subscription_plan(companion.get("user_id", ""))

    # Send greeting on first connection if no prior messages exist
    first_turn_count = get_chat_count(str(companion_id))
    if first_turn_count == 0:
        greeting = NAMING_GREETING
        await websocket.send_json({"type": "greeting", "content": greeting})
        # Save greeting as AI message
        try:
            greeting_embedding = await get_embedding(greeting)
            save_chat_log(str(companion_id), "AI", greeting, greeting_embedding)
        except Exception as e:
            logger.warning("Failed to save greeting: %s", e)

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
                # 1.3. Extract user name from first message if not yet set
                just_set_user_name = False
                if not user_name:
                    extracted = await extract_user_name(user_message)
                    if extracted:
                        user_name = extracted
                        just_set_user_name = True
                        await websocket.send_json({
                            "type": "user_name_set",
                            "content": extracted,
                        })

                # 1.5. Check if user is responding to naming ceremony
                naming_result = await process_naming(str(companion_id), companion, user_message)
                if naming_result:
                    # Save user message
                    user_embedding = await get_embedding(user_message)
                    save_chat_log(str(companion_id), "USER", user_message, user_embedding)

                    # Send name_reveal first for frontend header animation
                    await websocket.send_json({
                        "type": "name_reveal",
                        "content": naming_result["name"],
                    })

                    # Send the confirmation as AI message
                    confirmation = naming_result["confirmation"]
                    await websocket.send_json({"type": "stream", "content": confirmation})
                    await websocket.send_json({
                        "type": "end",
                        "content": confirmation,
                        "intent": "naming",
                    })

                    # Save AI confirmation
                    ai_embedding = await get_embedding(confirmation)
                    save_chat_log(str(companion_id), "AI", confirmation, ai_embedding)
                    continue

                # 1.7. Check if user is spontaneously naming the AI
                # Skip if user just introduced themselves (to avoid confusing self-intro with AI naming)
                if not just_set_user_name:
                    spontaneous = await check_spontaneous_naming(
                        str(companion_id), companion, user_message
                    )
                    if spontaneous:
                        # Save user message
                        user_embedding = await get_embedding(user_message)
                        save_chat_log(str(companion_id), "USER", user_message, user_embedding)

                        # Send name_reveal first for frontend header animation
                        await websocket.send_json({
                            "type": "name_reveal",
                            "content": spontaneous["name"],
                        })

                        # Send confirmation as AI message
                        confirmation = spontaneous["confirmation"]
                        await websocket.send_json({"type": "stream", "content": confirmation})
                        await websocket.send_json({
                            "type": "end",
                            "content": confirmation,
                            "intent": "naming",
                        })

                        # Save AI confirmation
                        ai_embedding = await get_embedding(confirmation)
                        save_chat_log(str(companion_id), "AI", confirmation, ai_embedding)
                        continue

                # 2. Embed user message
                user_embedding = await get_embedding(user_message)

                # 3. Save user message with embedding
                save_chat_log(str(companion_id), "USER", user_message, user_embedding)

                # 4. Smart routing: decide model + context depth
                target_llm, recent_logs, router_result = await llm_engine.generate_response(
                    user_message, user_tier, str(companion_id)
                )
                model = router_result.model

                # 5. Hybrid retrieval: semantic + emotions (recent already from engine)
                semantic_logs = await search_relevant_logs_v2(
                    str(companion_id), user_embedding
                )
                emotions = get_recent_emotions(str(companion_id))

                # 6. Build system prompt with 3-source context + get generation params
                system_prompt = build_system_prompt(
                    companion, semantic_logs, recent_logs, emotions, user_name
                )
                tone_style = companion.get("tone_style", "empathetic")
                if tone_style in MBTI_PROFILES:
                    profile = MBTI_PROFILES[tone_style]
                else:
                    profile = STYLE_PROFILES.get(tone_style, STYLE_PROFILES["empathetic"])

                # 7. Stream AI response (model from smart router, params per MBTI)
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

                # 8. Signal stream end
                await websocket.send_json({
                    "type": "end",
                    "content": full_response,
                    "intent": router_result.intent,
                    "emotion_color": emotions[0]["color_hex"] if emotions else None,
                })

                # 9. Save AI response with embedding
                ai_embedding = await get_embedding(full_response)
                save_chat_log(str(companion_id), "AI", full_response, ai_embedding)

                # 10. Check for naming ceremony (after 10 AI turns, positive sentiment)
                naming_msg = await check_naming_event(str(companion_id), companion)
                if naming_msg:
                    await websocket.send_json({
                        "type": "naming_prompt",
                        "content": naming_msg,
                    })
                    # Save the naming prompt as AI message
                    try:
                        naming_embedding = await get_embedding(naming_msg)
                        save_chat_log(str(companion_id), "AI", naming_msg, naming_embedding)
                    except Exception:
                        pass

                # 11. Check for MBTI personality discovery (after 50 AI turns)
                announcement = await discover_personality(str(companion_id), companion)
                if announcement:
                    await websocket.send_json({
                        "type": "announcement",
                        "content": announcement,
                    })

            except Exception as e:
                logger.error("Chat processing error: %s", e, exc_info=True)
                # Send error as "end" so the frontend always shows a message
                await websocket.send_json(
                    {"type": "end", "content": "죄송해요, 잠시 문제가 생겼어요. 다시 말씀해 주시겠어요?"}
                )

    except WebSocketDisconnect:
        pass
