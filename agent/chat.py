"""Conversational fridge assistant. Unlike run_agent (single-item,
single-shot decision) this is multi-turn and free-text — the user drives
what gets asked, not a scheduled/triggered event. Stateless on the server:
the frontend keeps the message history and resends it each turn, the same
"no persistent agent object" philosophy already used everywhere else in
agent/.

Reuses add_to_shopping_list from tools.py rather than duplicating it; adds
one new read-only tool (get_fridge_status) so the model answers inventory
questions from real data instead of guessing. Deliberately does NOT expose
place_order — ordering only happens through the dedicated autopilot sweep,
not from a casual chat message.
"""

from langchain.agents import create_agent
from langchain_core.messages import AIMessage
from langchain_core.tools import tool

from agent.consumption import project_depletion
from agent.langchain_agent import _extract_tool_activity, _get_llm, _invoke_with_retry
from agent.tools import add_to_shopping_list
from backend.app.db.supabase_client import supabase

# Cheapest model that passed a real tool-calling test across all four chat
# capabilities (inventory Q&A, shopping actions, substitutions, "should I
# restock" reasoning) — ~12x cheaper than claude-haiku-4.5 and, in that same
# test, google/gemini-2.5-flash-lite incorrectly refused to answer a
# legitimate substitution question, so it was ruled out despite being cheap.
CHAT_MODEL = "deepseek/deepseek-v4-flash"

SYSTEM_PROMPT_CHAT = """You are yoink!'s fridge assistant, in a chat — this
is multi-turn conversation, not a single scheduled decision.

You can:
- Answer questions about what's in the fridge, what's expiring, or how much
  of something is left. Always call get_fridge_status first for these —
  never guess or make up fridge contents.
- Add an item to the shopping list when the user explicitly asks for it —
  call add_to_shopping_list.
- Suggest ingredient substitutions or general cooking help from your own
  knowledge — no tool needed, and don't refuse this just because it's not
  strictly about the current fridge contents.
- Reason about whether anything needs restocking (e.g. "should I restock
  anything?") by calling get_fridge_status and judging from
  days_until_depletion and expiry_date: a comfortable buffer needs no
  action; low stock, unknown consumption history, or a near expiry date is
  worth flagging, and stage it with add_to_shopping_list if that seems
  like what the user wants.

You never place orders or call any purchasing tool — that only happens
through the dedicated autopilot sweep, not from chat. Keep replies short
and conversational, not a wall of text.

Never use an em dash (—) anywhere in your reply. Use a period, comma, or
parentheses instead.
"""


@tool
def get_fridge_status() -> dict:
    """Look up everything currently tracked in the fridge: name, quantity,
    unit, expiry date, and days until it depletes at the learned
    consumption pace (null if there isn't enough history yet). Call this
    for ANY question about fridge contents, what's expiring, or how much of
    something is left — never guess.
    """
    items = supabase.table("items").select("id, name, quantity, unit, expiry_date").execute().data or []
    out = []
    for item in items:
        depletion = project_depletion(item["id"], float(item["quantity"] or 0))
        out.append(
            {
                "name": item["name"],
                "quantity": item["quantity"],
                "unit": item["unit"],
                "expiry_date": item["expiry_date"],
                "days_until_depletion": round(depletion, 1) if depletion is not None else None,
            }
        )
    return {"items": out}


TOOLS = [get_fridge_status, add_to_shopping_list]


def chat(messages: list[dict]) -> dict:
    """One turn of the fridge chat. `messages` is the full conversation
    history so far (list of {role, content}) — the caller (frontend) owns
    and resends it each turn.

    Returns {"reply": str, "tool_calls": [...], "error": bool}. Never
    raises — a failed LLM call returns a graceful fallback message instead,
    matching the rest of agent/'s style.
    """
    agent = create_agent(_get_llm(model=CHAT_MODEL), TOOLS, system_prompt=SYSTEM_PROMPT_CHAT)

    try:
        outcome = _invoke_with_retry(agent, {"messages": messages})
    except Exception as exc:  # noqa: BLE001 — same graceful-failure style as run_agent
        return {
            "reply": "Sorry, I couldn't reach the AI just now — please try again in a moment.",
            "tool_calls": [],
            "error": True,
            "message": str(exc),
        }

    result_messages = outcome["messages"]
    tool_activity = _extract_tool_activity(result_messages)
    final_ai_messages = [m for m in result_messages if isinstance(m, AIMessage) and m.content]
    reply = final_ai_messages[-1].content if final_ai_messages else "I'm not sure how to answer that."

    # The prompt asks the model to never use an em dash, but that's not
    # reliably followed (verified: still showed up in testing) — enforced
    # here in code instead, same "don't just prompt it, guarantee it"
    # pattern as the rest of agent/ (see e.g. the order-cooldown guardrail).
    reply = reply.replace("—", ", ")

    return {"reply": reply, "tool_calls": tool_activity, "error": False}
