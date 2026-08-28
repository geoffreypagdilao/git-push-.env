from fastapi import APIRouter
from pydantic import BaseModel

from backend.app.db.supabase_client import supabase

router = APIRouter(prefix="/recipe-feedback", tags=["recipe-feedback"])


class RecipeFeedbackCreate(BaseModel):
    recipe_title: str
    liked: bool
    ingredients_used: list[str] | None = None


@router.get("")
def list_feedback():
    result = (
        supabase.table("recipe_feedback")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return {"feedback": result.data}


@router.post("")
def add_feedback(feedback: RecipeFeedbackCreate):
    result = supabase.table("recipe_feedback").insert(feedback.model_dump()).execute()
    return result.data[0]
