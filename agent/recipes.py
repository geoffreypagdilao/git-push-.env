"""Recipe suggestions from current stock, prioritizing near-expiry items.

Unlike langchain_agent.run_agent / daily_sweep.run_daily_sweep, this is a
straight generation task — no tools, no decide-and-act loop — so it's just
one structured-output LLM call. See forxp.md §10.6 for the original scoping.
"""

import os
from datetime import date

import httpx
from pydantic import BaseModel, Field

from agent.langchain_agent import _get_llm
from agent.prompts import SYSTEM_PROMPT_RECIPES, SYSTEM_PROMPT_RECIPES_HEALTHY
from backend.app.db.supabase_client import supabase

MAX_LLM_RETRIES = 1

# Recipe generation is pure structured output (no tool-calling), so pantry
# mode (no hard constraints to follow) doesn't need the heavier model
# langchain_agent uses for actual decisions — measured ~44% faster (13.8s vs
# 24.7s for 4 recipes) with equally coherent output. Healthy mode has a hard
# "mix fridge + non-fridge ingredients" rule that Haiku only follows ~75% of
# the time even when reinforced in the prompt (measured); Sonnet followed it
# 3/3 in the same test, so it stays on the slower model where correctness
# actually matters more than speed.
MODEL_BY_MODE = {
    "pantry": "anthropic/claude-haiku-4.5",
    "healthy": "anthropic/claude-sonnet-5",
}

MODE_PROMPTS = {
    "pantry": SYSTEM_PROMPT_RECIPES,
    "healthy": SYSTEM_PROMPT_RECIPES_HEALTHY,
}

OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
# Cheapest image-output model on OpenRouter as of writing (checked against
# the live /models pricing endpoint — gemini-3.1-flash-lite-image runs
# ~15-20% below gemini-2.5-flash-image on both prompt and completion rates).
IMAGE_MODEL = "google/gemini-3.1-flash-lite-image"
MAX_IMAGE_RETRIES = 1


class RecipeIngredient(BaseModel):
    name: str
    qty: str
    pantry: bool = Field(default=False, description="True if a common pantry staple, not expected to be tracked stock")


class Recipe(BaseModel):
    title: str
    blurb: str
    skill: str
    minutes: int
    serves: int
    kcal: int
    ingredients: list[RecipeIngredient]
    steps: list[str]


class RecipeList(BaseModel):
    recipes: list[Recipe]


def _get_stock_context() -> list[dict]:
    """Current tracked items, soonest-to-expire first (nulls last)."""
    result = supabase.table("items").select("name, quantity, unit, expiry_date").execute()
    items = result.data or []

    def sort_key(item):
        return (item["expiry_date"] is None, item["expiry_date"])

    return sorted(items, key=sort_key)


def _get_preferences() -> dict:
    result = supabase.table("preferences").select("dietary_restrictions, cuisine_preferences").limit(1).execute()
    if result.data:
        return result.data[0]
    return {"dietary_restrictions": [], "cuisine_preferences": []}


def _days_until(expiry_date) -> str:
    if not expiry_date:
        return "unknown"
    delta = (date.fromisoformat(expiry_date) - date.today()).days
    return str(delta)


def generate_recipes(count: int = 3, mode: str = "pantry") -> dict:
    """Suggest `count` recipes.

    mode="pantry" (default): built tightly around current stock, prioritizing
    near-expiry items. mode="healthy": prioritizes nutritional balance and
    variety, and may reach for 1-3 ingredients not currently tracked.

    Returns {"recipes": [...], "error": bool, ...}. Never raises — a missing
    stock list or a failed LLM call returns a graceful empty/error result
    instead of crashing the caller, matching the rest of agent/'s style.
    """
    if mode not in MODE_PROMPTS:
        raise ValueError(f"Unknown recipe mode: {mode!r}")

    stock = _get_stock_context()

    if not stock:
        return {"recipes": [], "error": False, "message": "No tracked items yet — nothing to build a recipe around."}

    prefs = _get_preferences()

    lines = ["Current stock (soonest-to-expire first):"]
    for item in stock:
        lines.append(
            f"- {item['name']}: {item['quantity']} {item['unit']}, "
            f"expires in {_days_until(item['expiry_date'])} days"
        )
    lines.append("")
    lines.append(f"dietary_restrictions: {prefs.get('dietary_restrictions') or 'none'}")
    lines.append(f"cuisine_preferences: {prefs.get('cuisine_preferences') or 'none'}")
    lines.append("")
    lines.append(f"Suggest {count} recipes.")
    if mode == "healthy":
        # Repeated close to the actual request, not just in the system
        # prompt — faster/smaller models follow constraints more reliably
        # when they're reinforced near the generation point.
        lines.append(
            "Reminder: EVERY recipe must use at least 2 ingredients from the stock "
            "listed above, AND at least 1 ingredient not listed above (pantry staples "
            "like oil/salt/spices don't count either way). No exceptions."
        )
    user_message = "\n".join(lines)

    llm = _get_llm(max_tokens=4096, model=MODEL_BY_MODE[mode]).with_structured_output(RecipeList)
    system_prompt = MODE_PROMPTS[mode]

    last_exc = None
    for attempt in range(MAX_LLM_RETRIES + 1):
        try:
            result: RecipeList = llm.invoke(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ]
            )
            return {"recipes": [r.model_dump() for r in result.recipes], "error": False}
        except Exception as exc:  # noqa: BLE001 — mirrors langchain_agent's retry-then-graceful-fail pattern
            last_exc = exc
            if attempt < MAX_LLM_RETRIES:
                continue

    return {
        "recipes": [],
        "error": True,
        "message": f"Couldn't generate recipes right now — please try again shortly. ({last_exc})",
    }


def generate_recipe_image(title: str, blurb: str, ingredient_names: list[str]) -> dict:
    """One AI photo of a recipe, built from its own title/blurb/ingredients —
    called lazily per-recipe by the frontend, not as part of generate_recipes,
    since a photo per suggestion would be 4x the image-gen cost for recipes
    the user may never open.

    Returns {"image": "data:image/...;base64,..." | None, "error": bool}.
    """
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        return {"image": None, "error": True, "message": "OPENROUTER_API_KEY is not set."}

    prompt = (
        f'A simple, appetizing food photograph of "{title}". {blurb} '
        f"Visible ingredients: {', '.join(ingredient_names) or 'as described'}. "
        "Shot from directly overhead — a flat-lay / bird's-eye view straight down at the "
        "plate, camera perpendicular to the table, not an angled or side-on shot. "
        "Natural lighting, on a plate or board, minimal styling, no text or watermarks."
    )

    last_exc = None
    for attempt in range(MAX_IMAGE_RETRIES + 1):
        try:
            resp = httpx.post(
                OPENROUTER_CHAT_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": IMAGE_MODEL, "messages": [{"role": "user", "content": prompt}]},
                timeout=60,
            )
            resp.raise_for_status()
            message = resp.json()["choices"][0]["message"]
            images = message.get("images") or []
            if not images:
                # Model occasionally answers with text only, no image — worth
                # a retry rather than immediately giving up.
                raise RuntimeError("No image came back.")
            return {"image": images[0]["image_url"]["url"], "error": False}
        except Exception as exc:  # noqa: BLE001 — same graceful-failure style as the rest of agent/
            last_exc = exc
            if attempt < MAX_IMAGE_RETRIES:
                continue

    return {"image": None, "error": True, "message": f"Couldn't generate an image right now. ({last_exc})"}
