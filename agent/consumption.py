"""Deterministic consumption-pace math over inventory_log.

Plain queries + arithmetic, no LLM calls. The agent uses these numbers as
input context; it doesn't compute them itself.
"""

from datetime import datetime, timezone

from backend.app.db.supabase_client import supabase

MIN_DATA_POINTS = 2


def get_consumption_rate(item_id: str) -> float | None:
    """Average number of days between consecutive 'removed' events for an item.

    Returns None if there are fewer than MIN_DATA_POINTS 'removed' events
    logged for this item — not enough history to estimate a pace, so callers
    should treat that as "unknown" rather than guessing.
    """
    result = (
        supabase.table("inventory_log")
        .select("detected_at")
        .eq("item_id", item_id)
        .eq("event_type", "removed")
        .order("detected_at")
        .execute()
    )
    rows = result.data or []
    if len(rows) < MIN_DATA_POINTS:
        return None

    timestamps = [datetime.fromisoformat(row["detected_at"]) for row in rows]
    gaps_days = [
        (timestamps[i] - timestamps[i - 1]).total_seconds() / 86400
        for i in range(1, len(timestamps))
    ]
    return sum(gaps_days) / len(gaps_days)


def project_depletion(item_id: str, current_quantity: float) -> float | None:
    """Estimated number of days until this item's quantity hits 0.

    Returns None if the consumption rate is unknown (cold start) or if
    current_quantity is already 0 or less (nothing to project).
    """
    if current_quantity <= 0:
        return None

    rate = get_consumption_rate(item_id)
    if rate is None:
        return None

    # rate is days-between-removals; assume one unit removed per event.
    return rate * current_quantity
