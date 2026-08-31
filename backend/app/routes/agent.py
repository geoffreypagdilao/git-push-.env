from fastapi import APIRouter, HTTPException

from agent.daily_sweep import run_daily_sweep
from agent.langchain_agent import run_agent

router = APIRouter(prefix="/agent", tags=["agent"])


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
