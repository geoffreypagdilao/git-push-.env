"""Eyeball the detector on real images.

    python -m cv.eval_local cv/test_images
    python -m cv.eval_local cv/test_images --save --conf 0.15

Run from the repo root. ``--save`` writes annotated copies to
cv/eval_output/ so you can see what the model is actually latching onto -
the number in the terminal never tells you whether it boxed the onion or
the drawer handle.
"""

import argparse
import sys
from collections import Counter
from pathlib import Path

import cv2

from cv.detector import Detector
from cv.labels import PRODUCE_CLASSES, VALID_CATEGORIES, category_for

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
DEFAULT_OUTPUT_DIR = Path("cv/eval_output")

FONT = cv2.FONT_HERSHEY_SIMPLEX
FONT_SCALE = 0.5
FONT_THICKNESS = 1
CAPTION_PAD = 3
BOX_COLOR = (0, 200, 0)
CAPTION_TEXT_COLOR = (255, 255, 255)


def iter_images(target):
    path = Path(target)
    if path.is_file():
        return [path]
    if path.is_dir():
        return sorted(
            p for p in path.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES
        )
    raise FileNotFoundError(f"No such image or directory: {target}")


def draw_caption(out, text, x1, y1):
    """Draw a caption anchored to a box's top-left, always inside the frame.

    Detections that touch an edge - a pepper half out of shot, say - would
    otherwise have their label drawn off-canvas and lost. The filled backing
    matters too: thin green text over green produce is unreadable.
    """
    height, width = out.shape[:2]
    (text_w, text_h), baseline = cv2.getTextSize(text, FONT, FONT_SCALE, FONT_THICKNESS)
    box_w = text_w + 2 * CAPTION_PAD
    box_h = text_h + baseline + 2 * CAPTION_PAD

    left = min(max(x1, 0), max(width - box_w, 0))
    # Prefer sitting just above the box; drop inside it when there's no room.
    top = y1 - box_h
    if top < 0:
        top = min(max(y1, 0), max(height - box_h, 0))

    cv2.rectangle(out, (left, top), (left + box_w, top + box_h), BOX_COLOR, -1)
    cv2.putText(
        out,
        text,
        (left + CAPTION_PAD, top + CAPTION_PAD + text_h),
        FONT,
        FONT_SCALE,
        CAPTION_TEXT_COLOR,
        FONT_THICKNESS,
        cv2.LINE_AA,
    )


def annotate(frame, detections):
    out = frame.copy()
    # Draw the weakest last so the most confident caption ends up on top
    # where detections overlap.
    for det in sorted(detections, key=lambda d: d.confidence):
        x1, y1, x2, y2 = (int(v) for v in det.bbox)
        cv2.rectangle(out, (x1, y1), (x2, y2), BOX_COLOR, 2)
        draw_caption(out, f"{det.label} {det.confidence:.2f}", x1, y1)
    return out


def check_label_map():
    """Every label must resolve to a real shelf_life_lookup row."""
    bad = [
        item.canonical
        for item in PRODUCE_CLASSES
        if category_for(item.canonical) not in VALID_CATEGORIES
    ]
    if bad:
        print(f"FAIL: labels with no valid shelf-life category: {bad}")
        return False
    print(f"Label map OK: {len(PRODUCE_CLASSES)} classes -> {len(VALID_CATEGORIES)} categories")
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", help="image file or directory of images")
    parser.add_argument("--save", action="store_true", help="write annotated images")
    parser.add_argument("--conf", type=float, default=None, help="confidence threshold")
    parser.add_argument(
        "--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="where --save writes"
    )
    args = parser.parse_args()

    if not check_label_map():
        return 1

    images = iter_images(args.target)
    if not images:
        print(f"No images found in {args.target}")
        return 1

    detector = Detector(conf=args.conf)
    print(f"Backend: {detector.backend_name}\n")

    output_dir = Path(args.output_dir)
    if args.save:
        output_dir.mkdir(parents=True, exist_ok=True)

    totals = Counter()
    for image_path in images:
        frame = cv2.imread(str(image_path))
        if frame is None:
            print(f"{image_path.name}: could not read, skipping")
            continue

        detections = detector.detect_detailed(frame)
        print(f"{image_path.name}: {len(detections)} box(es)")
        for det in sorted(detections, key=lambda d: -d.confidence):
            print(
                f"    {det.label:<14} {det.confidence:.2f}  [{category_for(det.label)}]"
            )
        if not detections:
            print("    (nothing above threshold)")

        # Boxes and counts are different questions: one box can cover a bunch
        # of touching carrots, so the inventory count comes from detect().
        try:
            counts = detector.detect(frame)
        except RuntimeError as exc:
            print(f"    inventory count unavailable: {exc}")
            counts = {}
        # Structured reading: keeps observed counts apart from estimates.
        # Not printing the flat dict as well - it is derived from this, and
        # showing both invited the question of which number to believe.
        try:
            for r in detector.read(frame):
                extra = ""
                if r.unit != "discrete":
                    extra = f" ({r.count_visible} visible"
                    extra += ", floor)" if r.is_floor() else ")"
                print(f"      {r.sku_id:<14} x{r.best_count():<3} {r.unit:<10}"
                      f"{r.occlusion:<11}{extra}")
        except (RuntimeError, AttributeError):
            pass

        totals.update(counts or Counter(d.label for d in detections))

        if args.save:
            destination = output_dir / f"{image_path.stem}_annotated{image_path.suffix}"
            cv2.imwrite(str(destination), annotate(frame, detections))

    print(f"\nTotals across {len(images)} image(s):")
    if totals:
        for label, count in totals.most_common():
            print(f"    {label:<14} {count:>3}  [{category_for(label)}]")
    else:
        print("    nothing detected")

    if args.save:
        print(f"\nAnnotated images written to {output_dir}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
