"""Build a local accuracy test set from COCO val2017.

    python -m cv.fetch_eval_set              # 40 images
    python -m cv.fetch_eval_set --n 100

Downloads real photos that humans annotated by hand, into cv/eval_set/ - which
is gitignored, so the images and answers stay on your machine and only this
script gets pushed. Anyone cloning the repo can rebuild the same set.

Ground truth is written to cv/eval_set/ground_truth.json in the format
cv/benchmark.py already reads, so:

    python -m cv.benchmark cv/eval_set --ground-truth cv/eval_set/ground_truth.json

Two honest caveats about using COCO for this:

1. It only annotates five produce classes - banana, apple, orange, broccoli,
   carrot. Anything else your detector correctly finds (lettuce, cucumber)
   would score as a false positive, so cv/benchmark.py must be told to ignore
   names outside that set. See --strict below.
2. Its *counts* for produce are unreliable. One image in the set is a plate of
   ~50 chopped carrot pieces annotated as `carrot: 1`. COCO is trustworthy for
   "is there a carrot in this photo" and not for "how many". Score presence
   here; score counts against your own photos, where you know the answer.
"""

import argparse
import json
import random
import sys
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ANNOTATION_URL = "http://images.cocodataset.org/annotations/annotations_trainval2017.zip"
IMAGE_URL = "http://images.cocodataset.org/val2017/{}"
DEFAULT_DIR = Path("cv/eval_set")

# The only produce COCO labels. Everything else in a fridge is unannotated.
PRODUCE = {"banana", "apple", "orange", "broccoli", "carrot"}

# A fridge drawer holds a handful of items, not a market stall. Very dense
# images are both unrepresentative and where COCO's counts break down.
MIN_INSTANCES = 1
MAX_INSTANCES = 8


def download(url, dest, label):
    if dest.exists():
        print(f"  {label}: already present, skipping")
        return
    print(f"  {label}: downloading...")
    dest.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, dest)


def build_truth(annotations_path):
    data = json.loads(Path(annotations_path).read_text())
    names = {c["id"]: c["name"] for c in data["categories"]}
    files = {i["id"]: i["file_name"] for i in data["images"]}

    per_image = defaultdict(Counter)
    crowded = set()
    for ann in data["annotations"]:
        name = names[ann["category_id"]]
        if name not in PRODUCE:
            continue
        # iscrowd marks a dense pile as one region - the count is meaningless.
        if ann.get("iscrowd"):
            crowded.add(ann["image_id"])
        else:
            per_image[ann["image_id"]][name] += 1

    usable = {
        files[i]: dict(c)
        for i, c in per_image.items()
        if i not in crowded and MIN_INSTANCES <= sum(c.values()) <= MAX_INSTANCES
    }
    return usable


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--n", type=int, default=40, help="how many images")
    parser.add_argument("--out", default=str(DEFAULT_DIR))
    parser.add_argument("--seed", type=int, default=0, help="same seed, same set")
    args = parser.parse_args()

    out = Path(args.out)
    images_dir = out / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    print("COCO val2017 produce eval set", flush=True)

    # Only fetch the 241MB archive if the file we actually need is missing.
    # Checking for the zip instead re-downloaded it on every run even when the
    # extracted annotations were already sitting there.
    ann_json = out / "instances_val2017.json"
    if not ann_json.exists():
        zip_path = out / "annotations.zip"
        download(ANNOTATION_URL, zip_path, "annotations (241MB, one time)")
        print("  extracting...", flush=True)
        with zipfile.ZipFile(zip_path) as z:
            with z.open("annotations/instances_val2017.json") as src:
                ann_json.write_bytes(src.read())
        zip_path.unlink()  # 241MB we no longer need
    else:
        print("  annotations already present", flush=True)

    truth = build_truth(ann_json)
    print(flush=True) or print(f"  {len(truth)} candidate images ({MIN_INSTANCES}-{MAX_INSTANCES} items each)")

    keys = sorted(truth)
    random.Random(args.seed).shuffle(keys)
    keys = keys[: args.n]
    subset = {k: truth[k] for k in keys}

    print(f"  fetching {len(subset)} images...", flush=True)
    for i, name in enumerate(subset, 1):
        dest = images_dir / name
        if not dest.exists():
            try:
                urllib.request.urlretrieve(IMAGE_URL.format(name), dest)
            except Exception as exc:
                print(f"    {name}: {exc}")
        if i % 10 == 0:
            print(f"    {i}/{len(subset)}", flush=True)

    have = {p.name for p in images_dir.iterdir() if p.is_file()}
    subset = {k: v for k, v in subset.items() if k in have}

    truth_path = out / "ground_truth.json"
    payload = {
        "_note": (
            "Auto-generated from COCO val2017 by cv/fetch_eval_set.py. Only "
            "banana/apple/orange/broccoli/carrot are annotated - score presence, "
            "not counts, and ignore other names your detector returns."
        ),
        "_classes": sorted(PRODUCE),
        **subset,
    }
    truth_path.write_text(json.dumps(payload, indent=1))

    totals = Counter()
    for counts in subset.values():
        totals.update(counts)
    print(f"\n  {len(subset)} images in {images_dir}/")
    print(f"  answers in {truth_path}")
    print(f"  instances by class: {dict(totals)}")
    print(f"\nScore against it:\n"
          f"  CV_BACKEND=hybrid python -m cv.benchmark {images_dir} \\\n"
          f"      --ground-truth {truth_path} --restrict-to-truth-classes --runs 1")
    return 0


if __name__ == "__main__":
    sys.exit(main())
