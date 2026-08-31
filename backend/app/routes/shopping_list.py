from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.app.db.supabase_client import supabase

router = APIRouter(prefix="/shopping-list", tags=["shopping-list"])


class ShoppingListItemCreate(BaseModel):
    item_id: str | None = None
    item_name: str
    store_link: str | None = None


class ShoppingListStatusUpdate(BaseModel):
    status: str  # 'pending' | 'in_cart' | 'purchased'


@router.get("")
def list_shopping_list(status: str | None = None):
    query = supabase.table("shopping_list").select("*")
    if status:
        query = query.eq("status", status)
    result = query.order("staged_at", desc=True).execute()
    return {"shopping_list": result.data}


@router.post("")
def stage_item(item: ShoppingListItemCreate):
    # avoid duplicate cart entries for the same item while one is still open
    if item.item_id:
        existing = (
            supabase.table("shopping_list")
            .select("*")
            .eq("item_id", item.item_id)
            .neq("status", "purchased")
            .execute()
        )
        if existing.data:
            return existing.data[0]

    result = supabase.table("shopping_list").insert(item.model_dump(exclude_none=True)).execute()
    return result.data[0]


@router.patch("/{entry_id}")
def update_status(entry_id: str, update: ShoppingListStatusUpdate):
    if update.status not in ("pending", "in_cart", "purchased"):
        raise HTTPException(status_code=400, detail="Invalid status")

    payload = {"status": update.status}
    if update.status == "purchased":
        payload["confirmed_at"] = datetime.utcnow().isoformat()

    result = supabase.table("shopping_list").update(payload).eq("id", entry_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Shopping list entry not found")
    return result.data[0]


@router.delete("/{entry_id}")
def remove_entry(entry_id: str):
    result = supabase.table("shopping_list").delete().eq("id", entry_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Shopping list entry not found")
    return {"deleted": True}
