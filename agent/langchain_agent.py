import os

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_core.messages import AIMessage, ToolMessage
from langchain_openai import ChatOpenAI

from agent.consumption import get_consumption_rate, project_depletion
from agent.prompts import SYSTEM_PROMPT
from agent.tools import add_to_shopping_list, place_order, send_notification
from backend.app.db.supabase_client import supabase

load_dotenv()

TOOLS = [add_to_shopping_list, place_order, send_notification]

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Overridable via env since OpenRouter model slugs change; defaults to the
# current Claude Sonnet model at time of writing.
DEFAULT_MODEL = "anthropic/claude-sonnet-5"


def _get_llm() -> ChatOpenAI:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set in the environment.")
    model = os.environ.get("OPENROUTER_MODEL", DEFAULT_MODEL)
    return ChatOpenAI(model=model, api_key=api_key, base_url=OPENROUTER_BASE_URL)


def _get_item_context(item_name: str) -> dict:
    """Look up item state directly from Supabase: id, quantity, expiry_date,
    plus derived consumption pace / depletion projection.

    Done inline here (rather than via a separate service module) since it's
    a single small read used only by run_agent to build the LLM's context —
    agent/consumption.py already owns the actual math, this just fetches the
    row and wires the two together.
    """
    result = (
        supabase.table("items")
        .select("id, quantity, expiry_date")
        .eq("name", item_name)
        .limit(1)
        .execute()
    )
    if not result.data:
        return {
            "item_id": None,
            "quantity": None,
            "expiry_date": "unknown",
            "consumption_rate_days": "unknown",
            "days_until_depletion": "unknown",
        }

    row = result.data[0]
    item_id = row["id"]
    quantity = row.get("quantity")

    rate = get_consumption_rate(item_id)
    depletion = project_depletion(item_id, quantity) if quantity is not None else None

    return {
        "item_id": item_id,
        "quantity": quantity,
        "expiry_date": row.get("expiry_date") or "unknown",
        "consumption_rate_days": round(rate, 1) if rate is not None else "unknown",
        "days_until_depletion": round(depletion, 1) if depletion is not None else "unknown",
    }


def _extract_tool_activity(messages: list) -> list[dict]:
    """Walk the agent's message list and pair each tool call with its result."""
    calls_by_id = {}
    for message in messages:
        if isinstance(message, AIMessage):
            for call in message.tool_calls or []:
                calls_by_id[call["id"]] = {"tool": call["name"], "args": call["args"], "result": None}
        elif isinstance(message, ToolMessage):
            if message.tool_call_id in calls_by_id:
                calls_by_id[message.tool_call_id]["result"] = message.content

    return list(calls_by_id.values())


def run_agent(item_name: str, autonomy_mode: str) -> dict:
    """Run the inventory agent for a single item.

    autonomy_mode is either "suggest" (may stage the item and must notify,
    never orders) or "autopilot" (may stage, order, and must notify). A real
    tool-calling LLM agent (built via langchain.agents.create_agent) decides
    which of the bound tools to call and with what arguments — see
    agent/prompts.py for the rules it's instructed to follow.
    """
    if autonomy_mode not in ("suggest", "autopilot"):
        raise ValueError(f"Unknown autonomy_mode: {autonomy_mode!r}")

    context = _get_item_context(item_name)

    user_message = (
        f"item_name: {item_name}\n"
        f"autonomy_mode: {autonomy_mode}\n"
        f"consumption_rate_days: {context['consumption_rate_days']}\n"
        f"days_until_depletion: {context['days_until_depletion']}\n"
        f"expiry_date: {context['expiry_date']}\n"
    )

    agent = create_agent(_get_llm(), TOOLS, system_prompt=SYSTEM_PROMPT)
    outcome = agent.invoke({"messages": [{"role": "user", "content": user_message}]})

    messages = outcome["messages"]
    tool_activity = _extract_tool_activity(messages)
    final_ai_messages = [m for m in messages if isinstance(m, AIMessage) and m.content]
    final_message = final_ai_messages[-1].content if final_ai_messages else None

    return {
        "item_name": item_name,
        "autonomy_mode": autonomy_mode,
        "context": context,
        "tool_calls": tool_activity,
        "final_message": final_message,
    }
