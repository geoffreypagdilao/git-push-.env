"""Standalone manual test for the hardening pass: retry safety, decision
logging, the autopilot order-cooldown guardrail, the notification cooldown,
and the whole-fridge daily sweep. Run from the repo root:

    python agent/test_new_features_manual.py

Assumes broccoli/carrots/spinach already exist (see test_agent_manual.py) —
run that first if this warns they're missing.
"""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from agent.daily_sweep import run_daily_sweep  # noqa: E402
from agent.langchain_agent import run_agent  # noqa: E402
from backend.app.db.supabase_client import supabase  # noqa: E402

REQUIRED_ITEMS = ["broccoli", "carrots", "spinach"]


def check_items_exist() -> bool:
    result = supabase.table("items").select("name").in_("name", REQUIRED_ITEMS).execute()
    found = {row["name"] for row in (result.data or [])}
    missing = [name for name in REQUIRED_ITEMS if name not in found]
    if missing:
        print(f"WARNING: missing from items table: {missing}")
        print("Run agent/test_agent_manual.py first to seed-check these.")
        return False
    return True


def section(title: str) -> None:
    print("\n" + "=" * 60)
    print(title.center(60, "="))
    print("=" * 60)


def test_notification_cooldown() -> None:
    section("Test 1: notification cooldown (repeat call, no force)")
    print("First call (force=True, so it always runs the AI):")
    first = run_agent("carrots", "autopilot", force=True)
    print(f"  skipped={first.get('skipped', False)}  error={first.get('error')}")

    print("\nSecond call, same item, immediately after, force=False:")
    second = run_agent("carrots", "autopilot")
    print(f"  skipped={second.get('skipped', False)}  error={second.get('error')}")
    print(f"  final_message: {second['final_message']}")
    if second.get("skipped"):
        print("  -> PASS: cooldown correctly skipped the repeat AI call.")
    else:
        print("  -> Did not skip — either cooldown disabled or last_notified_at wasn't set.")


def test_order_cooldown_guardrail() -> None:
    section("Test 2: autopilot order-cooldown guardrail")
    print("Placing a second autopilot order for carrots, force=True to bypass the *notification* cooldown")
    print("(this tests the separate ORDER cooldown enforced inside place_order itself):")
    result = run_agent("carrots", "autopilot", force=True)
    order_calls = [c for c in result["tool_calls"] if c["tool"] == "place_order"]
    if not order_calls:
        print("  -> AI didn't attempt to order this time (also a valid outcome if it judged no need).")
        return
    for call in order_calls:
        print(f"  place_order result: {call['result']}")
    if any('"skipped": true' in str(c["result"]).lower() or "skipped" in str(c["result"]) for c in order_calls):
        print("  -> PASS: guardrail correctly refused the duplicate order.")
    else:
        print("  -> Order went through — check timing/cooldown window.")


def test_daily_sweep() -> None:
    section("Test 3: whole-fridge daily sweep (suggest mode)")
    result = run_daily_sweep("suggest")
    print(f"Items considered: {result['items_considered']}")
    print("\nTool calls:")
    if not result["tool_calls"]:
        print("  (none)")
    for i, call in enumerate(result["tool_calls"], start=1):
        print(f"  {i}. {call['tool']}  args={call['args']}")
        print(f"     result: {call['result']}")
    print(f"\nFinal message:\n  {result['final_message']}")
    print(f"\nerror={result['error']}")


def main() -> None:
    if not check_items_exist():
        sys.exit(1)

    test_notification_cooldown()
    test_order_cooldown_guardrail()
    test_daily_sweep()


if __name__ == "__main__":
    main()
