from langchain_core.tools import tool

from backend.app.db.supabase_client import supabase


@tool
def add_to_shopping_list(item_name: str) -> dict:
    """Add an item to the shopping_list table."""
    result = supabase.table("shopping_list").insert({"item_name": item_name}).execute()
    return {"item_name": item_name, "added": True, "result": result.data}


@tool
def check_store_stock(item_name: str) -> dict:
    """Check whether a nearby store has an item in stock.

    Stub - will call the Google Places API in a future iteration.
    """
    return {"item_name": item_name, "in_stock": None, "store": None}


@tool
def place_order(item_name: str) -> dict:
    """Place a test-mode order for an item.

    Stub - will call Stripe test-mode checkout in a future iteration.
    """
    return {"item_name": item_name, "ordered": True, "order_id": None}


@tool
def send_notification(message: str) -> dict:
    """Send a notification message to the user.

    Stub - will push to the frontend in a future iteration. For now it
    just prints to stdout.
    """
    print(f"[notification] {message}")
    return {"message": message, "sent": True}
