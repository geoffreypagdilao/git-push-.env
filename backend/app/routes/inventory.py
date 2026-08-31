from datetime import date, datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.app.db.supabase_client import supabase

router = APIRouter(prefix="/inventory", tags=["inventory"])


class ItemCreate(BaseModel):
    name: str
    category: str = "uncategorized"
    quantity: float = 0
    unit: str = "pcs"
    expiry_date: date | None = None


class ItemUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    quantity: float | None = None
    unit: str | None = None
    expiry_date: date | None = None


@router.get("")
def list_items():
    result = supabase.table("items").select("*").order("name").execute()
    return {"items": result.data}


@router.get("/{item_id}")
def get_item(item_id: str):
    result = supabase.table("items").select("*").eq("id", item_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Item not found")
    return result.data


@router.post("")
def create_item(item: ItemCreate):
    payload = item.model_dump(mode="json", exclude_none=True)
    result = supabase.table("items").insert(payload).execute()
    return result.data[0]


@router.patch("/{item_id}")
def update_item(item_id: str, item: ItemUpdate):
    payload = item.model_dump(mode="json", exclude_unset=True)
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")
    payload["updated_at"] = datetime.utcnow().isoformat()
    result = supabase.table("items").update(payload).eq("id", item_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Item not found")
    return result.data[0]


@router.delete("/{item_id}")
def delete_item(item_id: str):
    result = supabase.table("items").delete().eq("id", item_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"deleted": True}


@router.get("/{item_id}/log")
def get_item_log(item_id: str):
    result = (
        supabase.table("inventory_log")
        .select("*")
        .eq("item_id", item_id)
        .order("detected_at", desc=True)
        .execute()
    )
    return {"log": result.data}
