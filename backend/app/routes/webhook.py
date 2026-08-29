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


def _shelf_life_days(category: str) -> int:
    result = (
        supabase.table("shelf_life_lookup")
        .select("typical_shelf_life_days")
        .eq("category", category)
        .single()
        .execute()
    )
    return result.data["typical_shelf_life_days"]


def _apply_event(entry: FrameItem) -> None:
    now = datetime.now(timezone.utc).isoformat()
    row = (
        supabase.table("items")
        .select("*")
        .eq("name", entry.name)
        .maybe_single()
        .execute()
        .data
    )

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
