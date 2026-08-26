"""Standalone manual test for the inventory agent — no pytest, no frontend,
no webhook, no webcam. Run from the repo root:

    python agent/test_agent_manual.py

Running a script directly puts *its own* directory on sys.path[0], not the
repo root, which breaks the `agent.` / `backend.` absolute imports used
throughout this codebase. The sys.path insert below fixes that so this file
can be run standalone instead of requiring `python -m agent.test_agent_manual`.
"""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from agent.langchain_agent import run_agent  # noqa: E402
from backend.app.db.supabase_client import supabase  # noqa: E402

REQUIRED_ITEMS = ["broccoli", "carrots", "spinach"]


def check_items_exist() -> bool:
    result = supabase.table("items").select("name").in_("name", REQUIRED_ITEMS).execute()
    found = {row["name"] for row in (result.data or [])}
    missing = [name for name in REQUIRED_ITEMS if name not in found]
    if missing:
        print(f"WARNING: missing from items table: {missing}")
        print("Not inserting test data automatically — add these rows yourself, then re-run.")
        return False
    print(f"Found required items in Supabase: {REQUIRED_ITEMS}")
    return True


def print_result(result: dict) -> None:
    print(f"\n{result['item_name']} / {result['autonomy_mode']}")
    print("-" * 60)

    print("Context:")
    for key, value in result["context"].items():
        print(f"    {key:<24} {value}")

    print("\nTool calls:")
    if not result["tool_calls"]:
        print("    (none)")
    for i, call in enumerate(result["tool_calls"], start=1):
        print(f"    {i}. {call['tool']}")
        print(f"       args:   {call['args']}")
        print(f"       result: {call['result']}")

    print("\nFinal message:")
    print(f"    {result['final_message']}")


def run_case(label: str, item_name: str, autonomy_mode: str) -> None:
    banner = f" {label}: run_agent({item_name!r}, {autonomy_mode!r}) "
    print("\n" + "=" * 60)
    print(banner.center(60, "="))
    print("=" * 60)
    result = run_agent(item_name, autonomy_mode)
    print_result(result)


def main() -> None:
    if not check_items_exist():
        sys.exit(1)

    run_case("Test A", "broccoli", "suggest")
    run_case("Test B", "carrots", "autopilot")
    run_case("Test C", "spinach", "suggest")


if __name__ == "__main__":
    main()
