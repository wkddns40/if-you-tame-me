"""
Smart Router — Intent-based model & retrieval switching.

Classifies user messages into 4 categories and returns
the optimal (model, k) pair for each.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ── Intent → Config mapping ─────────────────────────────────
INTENT_CONFIG: dict[str, dict] = {
    "deep_emotional": {"model": "gpt-4o", "k": 8},
    "casual_chat":    {"model": "gpt-4o-mini", "k": 3},
    "memory_recall":  {"model": "gpt-4o", "k": 10},
    "simple_question": {"model": "gpt-4o-mini", "k": 2},
}

DEFAULT_INTENT = "casual_chat"

# ── Router LLM (cheapest & fastest) ─────────────────────────
ROUTER_LLM = ChatOpenAI(model="gpt-4o-mini", temperature=0, max_tokens=50)


# ── Schemas ──────────────────────────────────────────────────
class _RouteSchema(BaseModel):
    intent: str = Field(
        description="One of: deep_emotional, casual_chat, memory_recall, simple_question"
    )
    reason: str = Field(description="One-line reason for classification")


@dataclass
class RouterResult:
    intent: str       # "deep_emotional" | "casual_chat" | "memory_recall" | "simple_question"
    model: str        # "gpt-4o" | "gpt-4o-mini"
    k: int            # Retrieval count for RAG search
    reason: str       # Classification rationale (for debugging)


# ── Classification prompt ────────────────────────────────────
_parser = JsonOutputParser(pydantic_object=_RouteSchema)

_prompt = ChatPromptTemplate.from_template(
    """Classify the user message into exactly one intent.

[Intent definitions]
- deep_emotional : 감정적 깊이가 필요한 대화 (고민, 위로, 진지한 감정 표현, 힘든 이야기)
- casual_chat    : 일상적 대화, 가벼운 인사, 짧은 리액션, 잡담
- memory_recall  : 과거 기억을 참조하는 대화 ("지난번에", "전에 말했던", "그때", "기억나?")
- simple_question: 단순 질문, 사실 확인, 짧은 응답이 예상되는 질문

[User message]
{input}

{format_instructions}"""
)

_chain = _prompt | ROUTER_LLM | _parser


# ── Public API ───────────────────────────────────────────────
async def classify_intent(message: str) -> RouterResult:
    """Classify a user message and return the routing decision."""
    try:
        result = await _chain.ainvoke({
            "input": message,
            "format_instructions": _parser.get_format_instructions(),
        })
        intent = result.get("intent", DEFAULT_INTENT)
        if intent not in INTENT_CONFIG:
            intent = DEFAULT_INTENT
        reason = result.get("reason", "")
    except Exception as e:
        logger.warning("Router classification failed, falling back to %s: %s", DEFAULT_INTENT, e)
        intent = DEFAULT_INTENT
        reason = "fallback due to error"

    cfg = INTENT_CONFIG[intent]
    return RouterResult(
        intent=intent,
        model=cfg["model"],
        k=cfg["k"],
        reason=reason,
    )


# ── Backward-compatible wrapper ──────────────────────────────
async def route_traffic(user_input: str) -> bool:
    """Legacy API: returns True if the request needs gpt-4o."""
    result = await classify_intent(user_input)
    return result.model == "gpt-4o"
