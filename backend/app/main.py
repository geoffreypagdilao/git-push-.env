from fastapi import FastAPI
from backend.app.routes import inventory, preferences, recipe_feedback, shopping_list, webhook

app = FastAPI(title="last-one-agent backend")

app.include_router(inventory.router)
app.include_router(shopping_list.router)
app.include_router(preferences.router)
app.include_router(recipe_feedback.router)
app.include_router(webhook.router)

@app.get("/health")
def health():
    return {"status": "ok"}
