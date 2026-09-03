"""Score the detector so accuracy work is measurable instead of anecdotal.

Two measures, deliberately separate:

**Consistency** needs no ground truth. Run the same image N times and see
whether the answer moves. This matters more than it sounds: agent/consumption.py
learns from the gaps between add/remove events, so a reading that wobbles
between 6 and 7 on an untouched drawer invents phantom events and poisons the
signal the agent reasons over. A detector that is consistently wrong is more
useful here than one that is erratically right.

**Accuracy** needs ground truth in cv/test_images/ground_truth.json:

    {"carrot.jpg": {"carrot": 7, "lettuce": 1, "cucumber": 2}}

Counts are scored with a tolerance, because exact counts of heaped produce are
not reliably obtainable - two people counting the same photo of a carrot pile
will disagree.

    python -m cv.benchmark --runs 3
    python -m cv.benchmark --backend yoloe --runs 5 --tolerance 0
"""

import argparse
import json
import statistics
import sys
import time
from pathlib import Path

import cv2

from cv.detector import Detector
from cv.eval_local import iter_images

GROUND_TRUTH_FILE = Path("cv/test_images/ground_truth.json")
DEFAULT_TOLERANCE = 1


def load_ground_truth(path=GROUND_TRUTH_FILE):
    path = Path(path)
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        print(f"warning: could not parse {path}: {exc}")
        return {}

    # Keys starting with _ are notes and deliberately-excluded images.
    return {
        name: {k: v for k, v in counts.items() if not k.startswith("_")}
        for name, counts in data.items()
        if not name.startswith("_") and isinstance(counts, dict)
    }


def score(predicted, truth, tolerance):
    """Compare one reading against truth.

    Item identity and count accuracy are reported separately - naming the
    right things and counting them are different failures with different fixes.
    """
    pred_names, true_names = set(predicted), set(truth)
    found = pred_names & true_names
    errors = {n: predicted[n] - truth[n] for n in found}
    return {
        "found": sorted(found),
        "missed": sorted(true_names - pred_names),
        "spurious": sorted(pred_names - true_names),
        "count_errors": {n: e for n, e in errors.items() if abs(e) > tolerance},
        "abs_error": sum(abs(e) for e in errors.values()),
    }


def consistency(readings):
    """How much did repeated readings of the same image disagree?"""
    names = sorted({n for r in readings for n in r})
    unstable = {}
    for name in names:
        values = [r.get(name, 0) for r in readings]
        if len(set(values)) > 1:
            unstable[name] = values
    return all(r == readings[0] for r in readings), unstable


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", nargs="?", default="cv/test_images")
    parser.add_argument("--backend", default=None, help="hybrid | yoloe | ollama")
    parser.add_argument("--runs", type=int, default=3, help="repeats per image")
    parser.add_argument("--tolerance", type=int, default=DEFAULT_TOLERANCE)
    parser.add_argument("--ground-truth", default=str(GROUND_TRUTH_FILE))
    parser.add_argument(
        "--restrict-to-truth-classes",
        action="store_true",
        help=(
            "Only score names the ground truth knows about. Required for COCO, "
            "which annotates just 5 produce classes - without this a correct "
            "'lettuce' detection counts as a false positive."
        ),
    )
    args = parser.parse_args()

    images = iter_images(args.target)
    if not images:
        print(f"No images in {args.target}")
        return 1

    truth = load_ground_truth(args.ground_truth)
    scorable = (
        {n for counts in truth.values() for n in counts}
        if args.restrict_to_truth_classes
        else None
    )
    if scorable:
        print(f"scoring only: {sorted(scorable)}")
    detector = Detector(backend=args.backend)
    print(f"backend={detector.backend_name}  runs={args.runs}  images={len(images)}")
    if truth:
        print(f"ground truth: {len(truth)} image(s), count tolerance +/-{args.tolerance}\n")
    else:
        print(f"no ground truth at {args.ground_truth} - consistency only\n")

    stable_count = 0
    failed_images = 0
    scored = []
    for path in images:
        frame = cv2.imread(str(path))
        if frame is None:
            print(f"{path.name}: unreadable, skipping")
            continue

        readings, times, failures = [], [], 0
        for _ in range(args.runs):
            start = time.time()
            try:
                readings.append(detector.detect(frame))  # flattened read()
            except RuntimeError as exc:
                failures += 1
                last_error = exc
            times.append(time.time() - start)

        # A failed run is not a reading. Counting empties as agreement would
        # score a dead Ollama as perfect consistency - the benchmark's job is
        # to catch that, not launder it.
        if not readings:
            print(f"{path.name}  [FAILED]  all {args.runs} runs errored")
            print(f"    {last_error}\n")
            failed_images += 1
            continue
        if failures:
            print(f"{path.name}: {failures}/{args.runs} runs failed")

        identical, unstable = consistency(readings)
        stable_count += identical and not failures
        flag = "stable" if identical and not failures else "UNSTABLE"
        print(f"{path.name}  [{flag}]  {statistics.mean(times):.1f}s avg")
        print(f"    reading: {readings[0]}")
        for name, values in unstable.items():
            print(f"    varies:  {name}: {values}")

        expected = truth.get(path.name)
        if expected:
            observed = readings[0]
            if scorable:
                observed = {k: v for k, v in observed.items() if k in scorable}
            result = score(observed, expected, args.tolerance)
            scored.append(result)
            print(f"    truth:   {expected}")
            if result["missed"]:
                print(f"    MISSED:   {result['missed']}")
            if result["spurious"]:
                print(f"    SPURIOUS: {result['spurious']}")
            if result["count_errors"]:
                print(f"    COUNTS:   {result['count_errors']} (beyond +/-{args.tolerance})")
            if not (result["missed"] or result["spurious"] or result["count_errors"]):
                print("    all correct")
        print()

    print(f"CONSISTENCY: {stable_count}/{len(images)} images identical across {args.runs} runs")
    if failed_images:
        print(f"FAILED:      {failed_images}/{len(images)} images produced no reading at all")
    if scored:
        found = sum(len(s["found"]) for s in scored)
        missed = sum(len(s["missed"]) for s in scored)
        spurious = sum(len(s["spurious"]) for s in scored)
        recall = found / (found + missed) if found + missed else 0
        precision = found / (found + spurious) if found + spurious else 0
        print(f"ITEM RECALL:    {recall:.0%}  ({found} found, {missed} missed)")
        print(f"ITEM PRECISION: {precision:.0%}  ({spurious} spurious)")
        print(f"COUNT ERROR:    {sum(s['abs_error'] for s in scored)} total off-by")
    return 1 if failed_images else 0


if __name__ == "__main__":
    sys.exit(main())
