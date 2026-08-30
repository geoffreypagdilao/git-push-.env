import os
import time
from datetime import datetime, timedelta, timezone

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

# If the LLM call fails (network blip, timeout, etc.), retry this many times
# before giving up and returning a graceful failure instead of raising —
# protects a live run from crashing outright on a transient error.
MAX_LLM_RETRIES = 1

# Skip re-running the AI on an item that was already notified about this
# recently — avoids re-asking the same question (and re-notifying) on every
# call if nothing's changed. Set to 0 to disable.
NOTIFICATION_COOLDOWN_MINUTES = 60


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
        .select("id, quantity, expiry_date, last_notified_at")
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
            "last_notified_at": None,
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
        "last_notified_at": row.get("last_notified_at"),
    }


def _recently_notified(last_notified_at) -> bool:
    """True if last_notified_at is within NOTIFICATION_COOLDOWN_MINUTES of now."""
    if not last_notified_at or NOTIFICATION_COOLDOWN_MINUTES <= 0:
        return False
    try:
        notified_time = datetime.fromisoformat(last_notified_at)
    except (TypeError, ValueError):
        return False
    return datetime.now(timezone.utc) - notified_time < timedelta(minutes=NOTIFICATION_COOLDOWN_MINUTES)


def _mark_notified(item_id: str) -> None:
    """Best-effort: stamp items.last_notified_at so the cooldown can apply
    next time. Never raises — a failure here shouldn't break the caller.
    """
    try:
        supabase.table("items").update({"last_notified_at": "now()"}).eq("id", item_id).execute()
    except Exception as exc:
        print(f"[warning] failed to update last_notified_at for {item_id}: {exc}")


def _log_decision(
    *,
    scope: str,
    item_name,
    autonomy_mode: str,
    context,
    tool_calls: list,
    final_message,
    succeeded: bool = True,
    error_message=None,
) -> None:
    """Best-effort: write one row to agent_decisions for auditability. Never
    raises — logging failures shouldn't break the caller's actual decision.
    """
    try:
        supabase.table("agent_decisions").insert(
            {
                "scope": scope,
                "item_name": item_name,
                "autonomy_mode": autonomy_mode,
                "context": context,
                "tool_calls": tool_calls,
                "final_message": final_message,
                "succeeded": succeeded,
                "error_message": error_message,
            }
        ).execute()
    except Exception as exc:
        print(f"[warning] failed to write agent_decisions log: {exc}")


def _invoke_with_retry(agent, payload: dict):
    """Calls agent.invoke(payload), retrying transient failures up to
    MAX_LLM_RETRIES times before raising, so one flaky call doesn't
    immediately crash the caller.
    """
    last_exc = None
    for attempt in range(MAX_LLM_RETRIES + 1):
        try:
            return agent.invoke(payload)
        except Exception as exc:
            last_exc = exc
            if attempt < MAX_LLM_RETRIES:
                print(f"[warning] agent invocation failed (attempt {attempt + 1}), retrying: {exc}")
                time.sleep(1)
    raise RuntimeError(f"Agent invocation failed after {MAX_LLM_RETRIES + 1} attempt(s): {last_exc}") from last_exc


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


def run_agent(item_name: str, autonomy_mode: str, force: bool = False) -> dict:
    """Run the inventory agent for a single item.

    autonomy_mode is either "suggest" (may stage the item and must notify,
    never orders) or "autopilot" (may stage, order, and must notify). A real
    tool-calling LLM agent (built via langchain.agents.create_agent) decides
    which of the bound tools to call and with what arguments — see
    agent/prompts.py for the rules it's instructed to follow.

    force=True bypasses the notification cooldown (see
    NOTIFICATION_COOLDOWN_MINUTES) and re-runs the AI even if this item was
    just checked — mainly useful for testing/demos.

    Every call writes a row to agent_decisions (best-effort — a logging
    failure never breaks the actual decision), and if the LLM call itself
    fails, this returns a graceful result with "error": True instead of
    raising, so one bad network call doesn't crash the caller.
    """
    if autonomy_mode not in ("suggest", "autopilot"):
        raise ValueError(f"Unknown autonomy_mode: {autonomy_mode!r}")

    context = _get_item_context(item_name)

    if not force and _recently_notified(context.get("last_notified_at")):
        skip_message = (
            f"Skipped {item_name} — already checked within the last "
            f"{NOTIFICATION_COOLDOWN_MINUTES} minutes, no need to re-run the AI."
        )
        print(f"[NOTIFICATION] {skip_message}")
        _log_decision(
            scope="single_item",
            item_name=item_name,
            autonomy_mode=autonomy_mode,
            context=context,
            tool_calls=[],
            final_message=skip_message,
            succeeded=True,
        )
        return {
            "item_name": item_name,
            "autonomy_mode": autonomy_mode,
            "context": context,
            "tool_calls": [],
            "final_message": skip_message,
            "skipped": True,
            "error": False,
        }

    user_message = (
        f"item_name: {item_name}\n"
        f"autonomy_mode: {autonomy_mode}\n"
        f"consumption_rate_days: {context['consumption_rate_days']}\n"
        f"days_until_depletion: {context['days_until_depletion']}\n"
        f"expiry_date: {context['expiry_date']}\n"
    )

    agent = create_agent(_get_llm(), TOOLS, system_prompt=SYSTEM_PROMPT)

    try:
        outcome = _invoke_with_retry(agent, {"messages": [{"role": "user", "content": user_message}]})
    except Exception as exc:
        fallback_message = f"Couldn't reach the AI to evaluate {item_name} — please try again shortly."
        print(f"[NOTIFICATION] {fallback_message}")
        _log_decision(
            scope="single_item",
            item_name=item_name,
            autonomy_mode=autonomy_mode,
            context=context,
            tool_calls=[],
            final_message=fallback_message,
            succeeded=False,
            error_message=str(exc),
        )
        return {
            "item_name": item_name,
            "autonomy_mode": autonomy_mode,
            "context": context,
            "tool_calls": [],
            "final_message": fallback_message,
            "error": True,
        }

    messages = outcome["messages"]
    tool_activity = _extract_tool_activity(messages)
    final_ai_messages = [m for m in messages if isinstance(m, AIMessage) and m.content]
    final_message = final_ai_messages[-1].content if final_ai_messages else None

    if context.get("item_id") and any(call["tool"] == "send_notification" for call in tool_activity):
        _mark_notified(context["item_id"])

    _log_decision(
        scope="single_item",
        item_name=item_name,
        autonomy_mode=autonomy_mode,
        context=context,
        tool_calls=tool_activity,
        final_message=final_message,
        succeeded=True,
    )

    return {
        "item_name": item_name,
        "autonomy_mode": autonomy_mode,
        "context": context,
        "tool_calls": tool_activity,
        "final_message": final_message,
        "error": False,
    }
