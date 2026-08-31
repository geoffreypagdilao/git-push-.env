from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel

from backend.app.db.supabase_client import supabase

router = APIRouter(prefix="/preferences", tags=["preferences"])


class PreferencesUpdate(BaseModel):
    dietary_restrictions: list[str] | None = None
    cuisine_preferences: list[str] | None = None


@router.get("")
def get_preferences():
    result = supabase.table("preferences").select("*").limit(1).execute()
    if result.data:
        return result.data[0]
    # single-household assumption: no row yet means defaults
    return {"dietary_restrictions": [], "cuisine_preferences": []}


@router.put("")
def update_preferences(update: PreferencesUpdate):
    existing = supabase.table("preferences").select("id").limit(1).execute()
    payload = update.model_dump(exclude_none=True)
    payload["updated_at"] = datetime.utcnow().isoformat()

    if existing.data:
        result = (
            supabase.table("preferences")
            .update(payload)
            .eq("id", existing.data[0]["id"])
            .execute()
        )
    else:
        result = supabase.table("preferences").insert(payload).execute()

    return result.data[0]
