from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from backend.app.db.supabase_client import supabase

router = APIRouter()


class FrameItem(BaseModel):
    name: str
    category: str
    event_type: Literal["added", "removed"]


class FramePayload(BaseModel):
    items: list[FrameItem]


# Fallback when a category has no shelf_life_lookup row; mirrors the
# 'uncategorized' row seeded in the initial schema.
DEFAULT_SHELF_LIFE_DAYS = 7


def _shelf_life_days(category: str) -> int:
    # NOTE: don't use .single()/.maybe_single() here — with the installed
    # postgrest, .execute() returns None (not a response) on zero rows, so
    # .data then raises AttributeError.
    resp = (
        supabase.table("shelf_life_lookup")
        .select("typical_shelf_life_days")
        .eq("category", category)
        .limit(1)
        .execute()
    )
    row = resp.data[0] if resp.data else None
    return row["typical_shelf_life_days"] if row else DEFAULT_SHELF_LIFE_DAYS


def _normalize_name(name: str) -> str:
    """Canonical form for matching a detected label against items.name:
    trim surrounding whitespace and lowercase. Deliberately does NOT do
    singular/plural stemming or fuzzy matching."""
    return name.strip().lower()


def _find_item_by_name(name: str) -> dict | None:
    """Look up an existing item by normalized name. The items table is a
    single household's fridge (tens of rows), so scanning it and comparing
    normalized names in Python is simpler and more correct than trying to
    express the normalization in the query. Also avoids the
    .maybe_single()-returns-None-on-zero-rows crash."""
    target = _normalize_name(name)
    resp = supabase.table("items").select("*").execute()
    for row in resp.data or []:
        if _normalize_name(row["name"]) == target:
            return row
    return None


def _apply_event(entry: FrameItem) -> None:
    now = datetime.now(timezone.utc).isoformat()
    row = _find_item_by_name(entry.name)

    if entry.event_type == "added":
        quantity_delta = 1
        if row is None:
            expiry_date = date.today() + timedelta(days=_shelf_life_days(entry.category))
            inserted = (
                supabase.table("items")
                .insert(
                    {
                        "name": entry.name,
                        "category": entry.category,
                        "quantity": 1,
                        "expiry_date": expiry_date.isoformat(),
                    }
                )
                .execute()
            )
            item_id = inserted.data[0]["id"]
        else:
            item_id = row["id"]
            supabase.table("items").update(
                {
                    "quantity": row["quantity"] + 1,
                    "last_seen_at": now,
                    "updated_at": now,
                }
            ).eq("id", item_id).execute()
    else:
        if row is None:
            return
        quantity_delta = -1
        item_id = row["id"]
        supabase.table("items").update(
            {
                "quantity": max(row["quantity"] - 1, 0),
                "last_seen_at": now,
                "updated_at": now,
            }
        ).eq("id", item_id).execute()

    supabase.table("inventory_log").insert(
        {
            "item_id": item_id,
            "event_type": entry.event_type,
            "quantity_delta": quantity_delta,
        }
    ).execute()


@router.post("/webhook/frame")
def receive_frame(payload: FramePayload):
    for entry in payload.items:
        _apply_event(entry)
    return {"received": True}
