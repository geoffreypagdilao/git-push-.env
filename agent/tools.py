from datetime import datetime, timedelta, timezone

from langchain_core.tools import tool

from backend.app.db.supabase_client import supabase

# Safety guardrail for autopilot: never auto-order the same item more than
# once within this window, even if the AI decides to. Enforced here in code
# rather than only in the prompt, so it can't be reasoned around.
ORDER_COOLDOWN_DAYS = 7


@tool
def add_to_shopping_list(item_name: str) -> dict:
    """Stage an item onto the shopping list so it shows up in the dashboard's cart.

    Use this whenever you decide an item needs to be restocked, regardless of
    autonomy_mode ("suggest" or "autopilot") — staging is not the same as
    ordering. Inserts a row into the shopping_list table with status='pending'.
    If a non-purchased row for this item already exists, returns that row
    instead of creating a duplicate (the dashboard only expects one active
    entry per item at a time).
    """
    existing = (
        supabase.table("shopping_list")
        .select("*")
        .eq("item_name", item_name)
        .neq("status", "purchased")
        .execute()
    )
    if existing.data:
        return {"item_name": item_name, "added": False, "already_staged": True, "result": existing.data}

    result = (
        supabase.table("shopping_list")
        .insert({"item_name": item_name, "status": "pending"})
        .execute()
    )
    return {"item_name": item_name, "added": True, "already_staged": False, "result": result.data}


@tool
def place_order(item_name: str) -> dict:
    """Confirm and pay for a staged item, completing the purchase.

    Only call this in "autopilot" mode, and only after the item has already
    been staged with add_to_shopping_list. This is the hackathon build's
    "Confirm & pay" action: there is no real payment processor or store
    integration (that scope was explicitly dropped, see the schema migration
    notes) — it simply flips the item's shopping_list row from
    pending/in_cart to status='purchased' and stamps confirmed_at. If no
    staged row exists for this item, it fails rather than guessing.

    Safety guardrail: this will refuse to order the same item twice within
    ORDER_COOLDOWN_DAYS, even if called — prevents runaway duplicate orders
    regardless of what the model decides.
    """
    pending = (
        supabase.table("shopping_list")
        .select("*")
        .eq("item_name", item_name)
        .neq("status", "purchased")
        .execute()
    )
    if not pending.data:
        return {
            "item_name": item_name,
            "ordered": False,
            "error": "No pending shopping_list row for this item — call add_to_shopping_list first.",
        }

    cutoff = (datetime.now(timezone.utc) - timedelta(days=ORDER_COOLDOWN_DAYS)).isoformat()
    recent_purchase = (
        supabase.table("shopping_list")
        .select("id")
        .eq("item_name", item_name)
        .eq("status", "purchased")
        .gte("confirmed_at", cutoff)
        .execute()
    )
    if recent_purchase.data:
        return {
            "item_name": item_name,
            "ordered": False,
            "skipped": True,
            "reason": f"Already auto-ordered within the last {ORDER_COOLDOWN_DAYS} days — skipping to prevent a duplicate order.",
        }

    row_id = pending.data[0]["id"]
    result = (
        supabase.table("shopping_list")
        .update({"status": "purchased", "confirmed_at": "now()"})
        .eq("id", row_id)
        .execute()
    )
    return {"item_name": item_name, "ordered": True, "result": result.data}


@tool
def send_notification(message: str) -> dict:
    """Notify the user about a decision or action taken on their inventory.

    Call this exactly once per run_agent invocation, after any staging/
    ordering actions are complete, so the user always knows what happened —
    in both "suggest" and "autopilot" modes. There is no real push channel
    yet (that's a future frontend integration), so this just logs clearly to
    stdout with a [NOTIFICATION] prefix for inspection in tests/demos.
    """
    print(f"[NOTIFICATION] {message}")
    return {"message": message, "sent": True}
