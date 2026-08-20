import os

from dotenv import load_dotenv

from agent.tools import (
    add_to_shopping_list,
    check_store_stock,
    place_order,
    send_notification,
)

load_dotenv()

TOOLS = [add_to_shopping_list, check_store_stock, place_order, send_notification]


def _get_llm():
    # --- Real LLM client goes here once an API key is available ---
    # from langchain_anthropic import ChatAnthropic
    # return ChatAnthropic(model="claude-opus-4-5", api_key=os.environ["ANTHROPIC_API_KEY"])
    raise NotImplementedError("No LLM configured yet - set ANTHROPIC_API_KEY and implement _get_llm().")


def run_agent(item_name: str, autonomy_mode: str) -> dict:
    """Run the shopping agent for a single item.

    autonomy_mode is either "suggest" (check stock and notify the user) or
    "autopilot" (place the order and notify the user).

    This currently branches with plain if/else instead of letting an LLM
    pick tools, since no LLM is wired up yet (see _get_llm above). Once a
    key is available, swap this for a real LangChain agent executor (e.g.
    create_tool_calling_agent) built from TOOLS.
    """
    if autonomy_mode not in ("suggest", "autopilot"):
        raise ValueError(f"Unknown autonomy_mode: {autonomy_mode!r}")

    if autonomy_mode == "suggest":
        stock_result = check_store_stock.invoke(item_name)
        send_notification.invoke(f"{item_name} is running low. Store stock: {stock_result}")
        return {"action": "suggest", "item_name": item_name, "stock": stock_result}

    order_result = place_order.invoke(item_name)
    send_notification.invoke(f"Auto-ordered {item_name}. Result: {order_result}")
    return {"action": "autopilot", "item_name": item_name, "order": order_result}
