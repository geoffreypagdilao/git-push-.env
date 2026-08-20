from fastapi import FastAPI
from backend.app.routes import inventory, webhook

app = FastAPI(title="last-one-agent backend")

app.include_router(inventory.router)
app.include_router(webhook.router)

@app.get("/health")
def health():
    return {"status": "ok"}
