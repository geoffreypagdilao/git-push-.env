from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routes import agent, inventory, preferences, recipe_feedback, recipes, shopping_list, webhook

app = FastAPI(title="last-one-agent backend")

# Dev-only: the Vite frontend runs on a different origin (localhost:517x).
# Wide open since this never runs anywhere but a local hackathon demo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(inventory.router)
app.include_router(shopping_list.router)
app.include_router(preferences.router)
app.include_router(recipe_feedback.router)
app.include_router(recipes.router)
app.include_router(webhook.router)
app.include_router(agent.router)

@app.get("/health")
def health():
    return {"status": "ok"}
