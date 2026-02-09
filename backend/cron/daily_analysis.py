"""
Daily Emotional Analysis Cron Job.

Fetches yesterday's chat logs for every companion,
sends them to gpt-4o-mini (JSON mode) for emotional analysis,
and upserts results into the Daily_Emotions table.

Usage:
    python -m cron.daily_analysis
"""

import asyncio
import json
from datetime import date, timedelta

from openai import AsyncOpenAI

from app.core.config import get_settings
from app.core.supabase import get_supabase_client
from app.core.prompts import ANALYST_PROMPT, SUMMARY_PROMPT

settings = get_settings()
openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


def fetch_yesterdays_logs(companion_id: str) -> list[dict]:
    """Fetch all chat logs from yesterday for a given companion."""
    sb = get_supabase_client()
    yesterday = date.today() - timedelta(days=1)
    start = f"{yesterday}T00:00:00+00:00"
    end = f"{yesterday}T23:59:59+00:00"

    result = (
        sb.table("Chat_Logs")
        .select("sender, message, timestamp")
        .eq("companion_id", companion_id)
        .gte("timestamp", start)
        .lte("timestamp", end)
        .order("timestamp")
        .execute()
    )
    return result.data or []


def get_all_companion_ids() -> list[str]:
    """Return all companion IDs from the database."""
    sb = get_supabase_client()
    result = sb.table("Companions").select("companion_id").execute()
    return [row["companion_id"] for row in (result.data or [])]


async def analyze_emotions(logs: list[dict]) -> dict:
    """Send chat logs to gpt-4o-mini with JSON mode and extract emotional analysis."""
    logs_text = "\n".join(
        f"[{log['sender']}] {log['message']}" for log in logs
    )

    response = await openai_client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": ANALYST_PROMPT},
            {"role": "user", "content": logs_text},
        ],
    )

    return json.loads(response.choices[0].message.content)


def upsert_daily_emotion(companion_id: str, analysis: dict) -> None:
    """Upsert the emotional analysis into Daily_Emotions."""
    sb = get_supabase_client()
    yesterday = date.today() - timedelta(days=1)

    row = {
        "date": str(yesterday),
        "companion_id": companion_id,
        "primary_emotion": analysis.get("primary_emotion", ""),
        "color_hex": analysis.get("color_hex", "#808080"),
        "summary_text": analysis.get("summary_text", ""),
        "key_quote": analysis.get("key_quote", ""),
    }

    sb.table("Daily_Emotions").upsert(row).execute()


def fetch_current_summary(companion_id: str) -> str:
    """Read existing summary from Companions table."""
    sb = get_supabase_client()
    result = (
        sb.table("Companions")
        .select("summary")
        .eq("companion_id", companion_id)
        .single()
        .execute()
    )
    return (result.data or {}).get("summary", "") or ""


async def generate_rolling_summary(
    current_summary: str, analysis: dict, logs: list[dict]
) -> str:
    """Call gpt-4o-mini to merge old summary + today's data into updated summary."""
    logs_text = "\n".join(
        f"[{log['sender']}] {log['message']}" for log in logs
    )
    emotion_text = json.dumps(analysis, ensure_ascii=False)

    prompt = SUMMARY_PROMPT.format(
        current_summary=current_summary or "(No existing summary)",
        emotion_analysis=emotion_text,
        todays_logs=logs_text,
    )

    response = await openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=300,
    )
    return response.choices[0].message.content.strip()


def update_companion_summary(companion_id: str, new_summary: str) -> None:
    """Write updated summary back to Companions table."""
    sb = get_supabase_client()
    sb.table("Companions").update({"summary": new_summary}).eq(
        "companion_id", companion_id
    ).execute()


async def run_daily_analysis():
    """Main entry point: analyze all companions."""
    companion_ids = get_all_companion_ids()
    print(f"[Daily Analysis] Processing {len(companion_ids)} companions...")

    for cid in companion_ids:
        logs = fetch_yesterdays_logs(cid)
        if not logs:
            print(f"  [{cid}] No logs yesterday, skipping.")
            continue

        print(f"  [{cid}] Analyzing {len(logs)} messages...")
        analysis = await analyze_emotions(logs)
        upsert_daily_emotion(cid, analysis)
        print(f"  [{cid}] Done -> {analysis.get('primary_emotion')} {analysis.get('color_hex')}")

        # Rolling summary generation
        current_summary = fetch_current_summary(cid)
        new_summary = await generate_rolling_summary(current_summary, analysis, logs)
        update_companion_summary(cid, new_summary)
        print(f"  [{cid}] Summary updated ({len(new_summary)} chars)")

    print("[Daily Analysis] Complete.")


if __name__ == "__main__":
    asyncio.run(run_daily_analysis())
