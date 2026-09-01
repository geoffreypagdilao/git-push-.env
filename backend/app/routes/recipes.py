from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from agent.recipes import fetch_healthy_recipes, generate_recipe_image, generate_recipes

router = APIRouter(prefix="/recipes", tags=["recipes"])


class RecipeImageRequest(BaseModel):
    title: str
    blurb: str = ""
    ingredients: list[str] = []


@router.get("")
def get_recipes(count: int = 3, mode: str = "pantry"):
    if mode not in ("pantry", "healthy"):
        raise HTTPException(status_code=400, detail="mode must be 'pantry' or 'healthy'")
    if mode == "healthy":
        # Real TheMealDB lookups, not an LLM call — see fetch_healthy_recipes.
        return fetch_healthy_recipes()
    return generate_recipes(count, mode)


@router.post("/image")
def get_recipe_image(req: RecipeImageRequest):
    return generate_recipe_image(req.title, req.blurb, req.ingredients)
