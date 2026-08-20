from fastapi import APIRouter

router = APIRouter()

@router.post("/webhook/frame")
def receive_frame():
    return {"received": True}
