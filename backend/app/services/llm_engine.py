import logging

from langchain_openai import ChatOpenAI
from app.core.router import classify_intent, RouterResult
from app.core.supabase import get_supabase_client

logger = logging.getLogger(__name__)


class LLMEngine:
    def __init__(self):
        self._models: dict[str, ChatOpenAI] = {}

    def _get_llm(self, model: str, temperature: float = 0.7) -> ChatOpenAI:
        """Return a cached ChatOpenAI instance for the given model name."""
        if model not in self._models:
            self._models[model] = ChatOpenAI(
                model=model, temperature=temperature, streaming=True
            )
        return self._models[model]

    async def generate_response(
        self, user_input: str, user_tier: str, companion_id: str, **kwargs
    ) -> tuple[ChatOpenAI, list[dict], RouterResult]:
        """
        Classify intent via Smart Router, select model & k, fetch recent logs.

        Returns (target_llm, recent_history, router_result).
        """

        # FREE 유저는 항상 저비용 모델, SOULMATE만 라우팅 수행
        if user_tier == "SOULMATE":
            router_result = await classify_intent(user_input)
        else:
            router_result = RouterResult(
                intent="casual_chat",
                model="gpt-4o-mini",
                k=3,
                reason="FREE tier — default to mini",
            )

        target_llm = self._get_llm(router_result.model)
        logger.info(
            "Router → intent=%s  model=%s  k=%d  reason=%s",
            router_result.intent,
            router_result.model,
            router_result.k,
            router_result.reason,
        )

        recent_history = await self.get_recent_chat_history(
            companion_id, limit=router_result.k
        )

        return target_llm, recent_history, router_result

    async def get_recent_chat_history(
        self, companion_id: str, limit: int = 3
    ) -> list[dict]:
        """Fetch recent chat history with dynamic limit for context compression."""
        try:
            sb = get_supabase_client()
            result = sb.rpc(
                "get_recent_chat_logs",
                {
                    "target_companion_id": companion_id,
                    "msg_count": limit,
                },
            ).execute()
            logs = result.data or []
            logs.reverse()
            return logs
        except Exception:
            return []
