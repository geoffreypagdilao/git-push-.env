"""Whole-fridge reasoning: one AI call reasons about every tracked item at
once, instead of the isolated per-item calls in langchain_agent.run_agent.
Meant to be triggered on a schedule (e.g. a daily cron), not per detection
event — reuses the same tools and the same reliability machinery (retry,
decision logging) as the single-item path.
"""

from langchain.agents import create_agent

from agent.langchain_agent import (
    _extract_tool_activity,
    _get_item_context,
    _get_llm,
    _invoke_with_retry,
    _log_decision,
    _mark_notified,
)
from agent.prompts import SYSTEM_PROMPT_SWEEP
from agent.tools import add_to_shopping_list, place_order, send_notification
from backend.app.db.supabase_client import supabase

TOOLS = [add_to_shopping_list, place_order, send_notification]


def _get_all_item_names() -> list[str]:
    result = supabase.table("items").select("name").execute()
    return [row["name"] for row in (result.data or [])]


def run_daily_sweep(autonomy_mode: str) -> dict:
    """Review every tracked item in one AI call and act on whichever ones
    need it. Returns a structured result covering the whole sweep, not just
    one item — see agent/prompts.py:SYSTEM_PROMPT_SWEEP for the rules.
    """
    if autonomy_mode not in ("suggest", "autopilot"):
        raise ValueError(f"Unknown autonomy_mode: {autonomy_mode!r}")

    item_names = _get_all_item_names()
    contexts = {name: _get_item_context(name) for name in item_names}

    lines = [f"autonomy_mode: {autonomy_mode}", "", "Items in the fridge:"]
    for name, ctx in contexts.items():
        lines.append(
            f"- {name}: quantity={ctx['quantity']}, "
            f"consumption_rate_days={ctx['consumption_rate_days']}, "
            f"days_until_depletion={ctx['days_until_depletion']}, "
            f"expiry_date={ctx['expiry_date']}"
        )
    user_message = "\n".join(lines)

    agent = create_agent(_get_llm(), TOOLS, system_prompt=SYSTEM_PROMPT_SWEEP)

    try:
        outcome = _invoke_with_retry(agent, {"messages": [{"role": "user", "content": user_message}]})
    except Exception as exc:
        fallback_message = f"Daily sweep failed — couldn't reach the AI. ({exc})"
        print(f"[NOTIFICATION] {fallback_message}")
        _log_decision(
            scope="daily_sweep",
            item_name=None,
            autonomy_mode=autonomy_mode,
            context=contexts,
            tool_calls=[],
            final_message=fallback_message,
            succeeded=False,
            error_message=str(exc),
        )
        return {
            "autonomy_mode": autonomy_mode,
            "items_considered": item_names,
            "context": contexts,
            "tool_calls": [],
            "final_message": fallback_message,
            "error": True,
        }

    messages = outcome["messages"]
    tool_activity = _extract_tool_activity(messages)
    final_ai_messages = [
        m for m in messages if m.__class__.__name__ == "AIMessage" and getattr(m, "content", None)
    ]
    final_message = final_ai_messages[-1].content if final_ai_messages else None

    # Best-effort: mark any item that got an actionable tool call as
    # notified, so a single-item run_agent() call shortly after benefits
    # from the cooldown skip instead of re-asking the AI about the same
    # thing. Items only reasoned about (no action) aren't marked, since
    # there's no per-item signal for those in a single combined notification.
    for call in tool_activity:
        if call["tool"] in ("add_to_shopping_list", "place_order"):
            acted_item_name = call["args"].get("item_name")
            ctx = contexts.get(acted_item_name)
            if ctx and ctx.get("item_id"):
                _mark_notified(ctx["item_id"])

    _log_decision(
        scope="daily_sweep",
        item_name=None,
        autonomy_mode=autonomy_mode,
        context=contexts,
        tool_calls=tool_activity,
        final_message=final_message,
        succeeded=True,
    )

    return {
        "autonomy_mode": autonomy_mode,
        "items_considered": item_names,
        "context": contexts,
        "tool_calls": tool_activity,
        "final_message": final_message,
        "error": False,
    }
