from fastapi import APIRouter

from backend.app.db.supabase_client import supabase

router = APIRouter()


@router.get("/inventory")
def get_inventory():
    result = supabase.table("items").select("*").order("name").execute()
    return {"items": result.data}
