from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from agent.chat import chat as run_chat
from agent.daily_sweep import run_daily_sweep
from agent.langchain_agent import run_agent

router = APIRouter(prefix="/agent", tags=["agent"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


@router.post("/run/{item_name}")
def run_item(item_name: str, mode: str = "suggest", force: bool = False):
    if mode not in ("suggest", "autopilot"):
        raise HTTPException(status_code=400, detail="mode must be 'suggest' or 'autopilot'")
    return run_agent(item_name, mode, force=force)


@router.post("/sweep")
def sweep(mode: str = "suggest"):
    if mode not in ("suggest", "autopilot"):
        raise HTTPException(status_code=400, detail="mode must be 'suggest' or 'autopilot'")
    return run_daily_sweep(mode)


@router.post("/chat")
def chat(req: ChatRequest):
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages must not be empty")
    return run_chat([m.model_dump() for m in req.messages])
