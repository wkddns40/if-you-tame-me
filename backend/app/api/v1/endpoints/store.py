from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import AsyncOpenAI

from app.core.config import get_settings
from app.core.supabase import get_supabase_client

router = APIRouter()
settings = get_settings()
openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


class CrystallizeRequest(BaseModel):
    companion_id: UUID
    user_id: UUID


class CrystallizeResponse(BaseModel):
    item_id: str
    image_url: str
    emotion: str
    color_hex: str


def get_monthly_emotions(companion_id: str) -> list[dict]:
    """Fetch this month's daily emotions for the companion."""
    sb = get_supabase_client()
    from datetime import date
    today = date.today()
    month_start = today.replace(day=1)

    result = (
        sb.table("Daily_Emotions")
        .select("*")
        .eq("companion_id", companion_id)
        .gte("date", str(month_start))
        .lte("date", str(today))
        .order("date")
        .execute()
    )
    return result.data or []


async def generate_dalle_prompt(emotions: list[dict]) -> tuple[str, str, str]:
    """Use gpt-4o to craft a DALL-E prompt from the monthly emotion summary.

    Returns (dalle_prompt, dominant_emotion, dominant_color).
    """
    summary_lines = []
    color_counts: dict[str, int] = {}
    emotion_counts: dict[str, int] = {}

    for e in emotions:
        summary_lines.append(
            f"{e['date']}: {e.get('primary_emotion', '?')} ({e.get('color_hex', '#808080')}) - {e.get('summary_text', '')}"
        )
        color = e.get("color_hex", "#808080")
        emotion = e.get("primary_emotion", "neutral")
        color_counts[color] = color_counts.get(color, 0) + 1
        emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1

    dominant_color = max(color_counts, key=color_counts.get) if color_counts else "#808080"
    dominant_emotion = max(emotion_counts, key=emotion_counts.get) if emotion_counts else "neutral"
    summary_text = "\n".join(summary_lines)

    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a creative art director. Given an emotional summary of a month, "
                    "craft a single DALL-E image prompt for a magical gemstone that represents "
                    "these emotions. Output ONLY the prompt text, nothing else."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Monthly emotional data:\n{summary_text}\n\n"
                    f"Dominant color: {dominant_color}\n"
                    f"Dominant emotion: {dominant_emotion}\n\n"
                    "Create a prompt for: A high-end 3D render of a jewelry gem. "
                    f"The core color is {dominant_color}. It should feel {dominant_emotion}. "
                    "Magical, glowing, cinematic lighting."
                ),
            },
        ],
    )

    dalle_prompt = response.choices[0].message.content.strip()
    return dalle_prompt, dominant_emotion, dominant_color


async def generate_gem_image(dalle_prompt: str) -> str:
    """Call DALL-E 3 to generate the gem image. Returns the image URL."""
    response = await openai_client.images.generate(
        model="dall-e-3",
        prompt=dalle_prompt,
        size="1024x1024",
        quality="hd",
        n=1,
    )
    return response.data[0].url


def save_to_inventory(user_id: str, image_url: str, metadata: dict) -> str:
    """Save the generated gem to User_Inventory. Returns the item_id."""
    sb = get_supabase_client()
    result = (
        sb.table("User_Inventory")
        .insert({
            "user_id": user_id,
            "item_type": "MEMORY_GEM",
            "image_url": image_url,
            "metadata": metadata,
        })
        .execute()
    )
    return result.data[0]["item_id"]


@router.post("/store/crystallize", response_model=CrystallizeResponse)
async def crystallize(request: CrystallizeRequest):
    """Generate a Memory Gem from this month's emotional analysis."""
    emotions = get_monthly_emotions(str(request.companion_id))
    if not emotions:
        raise HTTPException(
            status_code=400,
            detail="No emotional data found for this month. Chat more first!",
        )

    # 1. Generate DALL-E prompt via gpt-4o
    dalle_prompt, emotion, color = await generate_dalle_prompt(emotions)

    # 2. Generate gem image via DALL-E 3
    image_url = await generate_gem_image(dalle_prompt)

    # 3. Save to inventory
    item_id = save_to_inventory(
        str(request.user_id),
        image_url,
        {
            "emotion": emotion,
            "color_hex": color,
            "dalle_prompt": dalle_prompt,
            "source_days": len(emotions),
        },
    )

    return CrystallizeResponse(
        item_id=item_id,
        image_url=image_url,
        emotion=emotion,
        color_hex=color,
    )
