"""Local vision-LLM backend, served by Ollama. Free, offline, no API key.

Why a VLM at all: YOLOE localises well but names badly. It boxed broccoli
perfectly and called it cabbage, reads romaine as 'kale', and needed hand-tuned
prompts per class before it would see a carrot. Every error left is a naming
error, and naming is what a VLM is good at.

Why Qwen3-VL specifically: it has a documented detection output - JSON entries
carrying ``box_2d`` as ``[x_min, y_min, x_max, y_max]`` scaled 0-1000 plus a
``label`` - so this is parsing a contract rather than coaxing prose.

Why local: no key, no rate limit, no cost, and frames from a camera pointed
into someone's kitchen never leave the machine.

This must NOT run per frame. At the capture script's 2s cadence that is 43,200
inferences a day; it is meant to run when the drawer contents change.
"""

import json
import os
import re
from dataclasses import replace

import requests

from cv.backends.base import Detection, encode_jpeg

# The -instruct variant, deliberately. The plain 'qwen3-vl:8b' tag is a
# reasoning model: it emits 6,700-15,900 characters of hidden `thinking` before
# answering, those tokens count against num_predict, and the budget is gone
# before a single character of content appears - so roughly half of all calls
# returned an empty string with done_reason='length'. `think: false` is
# ignored. The instruct variant does not think, which is the actual fix.
DEFAULT_MODEL = "qwen3-vl:8b-instruct"
DEFAULT_HOST = "http://localhost:11434"
DEFAULT_TIMEOUT_SECONDS = 180

# Qwen3-VL emits box coordinates on a fixed 0-1000 grid, independent of the
# real image size.
BOX_SCALE = 1000.0

PROMPT = """Detect every fruit and vegetable in this photo of a fridge produce drawer.

Return JSON: {"objects": [{"label": "carrot", "box_2d": [x_min, y_min, x_max, y_max]}]}

- One entry per individual item. Three carrots means three entries.
- Coordinates on a 0-1000 grid.
- Only produce you can actually see. Not packaging, containers, shelves or drawers.
- Produce inside a transparent bag or punnet still counts.
- Plain everyday name, lowercase and singular.
- Return {"objects": []} if there is no produce."""

# Deliberately plain text, not JSON. Constraining this call with
# format:"json" measurably degraded accuracy - on a crop of romaine beside
# some carrots, the JSON form answered "carrot" while the same model asked in
# plain text answered "lettuce" three times out of three. Naming one thing is
# a one-word answer; the JSON wrapper buys nothing and costs correctness.
#
# Note also that no real produce name appears as an example here. An earlier
# version used {"name": "carrot"} to show the format, and the model anchored
# on it and answered "carrot" for unrelated crops.
CLASSIFY_PROMPT = """What fruit or vegetable is this? Answer with just its name, \
lowercase singular. If several are visible, name the one that fills most of the \
frame. If it is not a fruit or vegetable, answer none."""

# Two images, not one. The first is the tight crop (detail); the second is the
# whole shelf with that item outlined in red (context). Scale relative to
# neighbours is the main thing separating an apple from a tomato from a
# radish, and a tight crop throws exactly that away.
CLASSIFY_CONTEXT_PROMPT = """The first image is a close-up of one item. The second \
shows the same item outlined in red on the shelf it came from.

What fruit or vegetable is the outlined item? Use the second image to judge its \
size next to the things around it.

Answer with just the name, lowercase singular. If it is not a fruit or \
vegetable, answer none. If you genuinely cannot tell, answer unknown."""

# Counting deliberately asks for no coordinates. Generating box coordinates is
# what made whole-frame detection slow and flaky (37-186s, ~half the calls
# empty); naming and counting the same frame takes under a second and returned
# identical results 3/3 on both test photos. The database wants {item: count},
# not geometry, so this is the call that actually feeds it.
COUNT_PROMPT = """List every fruit and vegetable you can see and how many of each.
One per line, format: name x count
Use plain lowercase singular names. Nothing else."""

# The richer reading. Three deliberate differences from COUNT_PROMPT:
#
# 1. It asks for occlusion, so an estimate can never be mistaken for an
#    observation downstream. A strawberry punnet's visible count is a floor,
#    not a total, and the pipeline has to know which it is holding.
# 2. It never asks for the counting unit. That is read off the taxonomy in
#    cv/labels.py instead, so classification and counting logic cannot drift
#    apart - and the model cannot decide a coriander bunch is 200 leaves.
# 3. It offers `unknown`, and says outright that it is preferred to a guess.
#    A VLM asked "what is this" will always answer something; an inventory
#    that is silently wrong is worse than one that admits a gap.
COUNT_PROMPT_V2 = """List every fruit and vegetable in this fridge photo.

One item per line, exactly: name ; count ; occlusion

- name: singular lowercase. Use one of these where it fits: {vocab}
        If it is produce but not on that list, use your own short name.
        If you cannot tell what it is, write: unknown
- count: how many you can actually SEE. For a bag, bunch or container,
        count the individual items visible through or on top of it.
- occlusion: none    - you can see the whole thing
             partial - some are hidden behind others or inside a container
             truncated - it is cut off by the edge of the photo

Say nothing else. No totals, no commentary.

Example of the format only - do not copy these items:
  <fruit name> ; 4 ; none
  <vegetable name> ; 12 ; partial"""

# A plausible produce name is one or two words. Anything longer is the model
# explaining itself rather than answering, and should not become an item name.
MAX_NAME_WORDS = 3

# A drawer holding more than this of one item is far more likely to be a
# misread digit than a real count.
MAX_PLAUSIBLE_COUNT = 99


class NoReading(RuntimeError):
    """The model returned nothing usable.

    Deliberately distinct from "no produce found". An empty detection list
    means the drawer is empty; if a failed call also returned an empty list,
    a stalled model would look exactly like someone emptying the drawer, and
    every item would be logged as removed.
    """


class OllamaVlmBackend:
    # Qwen reports each item once, so there is nothing for the IoU/containment
    # pass to merge - and running it would collapse genuine duplicates (three
    # carrots share a label and often overlap).
    needs_dedupe = False

    def __init__(self, model=None, conf=0.25, host=None, timeout=None):
        self.model = model or os.environ.get("CV_OLLAMA_MODEL", DEFAULT_MODEL)
        self.host = (host or os.environ.get("OLLAMA_HOST", DEFAULT_HOST)).rstrip("/")
        self.timeout = timeout or float(
            os.environ.get("CV_OLLAMA_TIMEOUT", DEFAULT_TIMEOUT_SECONDS)
        )
        # Kept for interface parity with the detector backends. A VLM returns
        # no calibrated score, so nothing is filtered on it.
        self.conf = conf

    def predict(self, frame):
        """Detect and name everything in the frame. Raises NoReading."""
        height, width = frame.shape[:2]
        content = self._chat(PROMPT, frame, num_predict=2048)
        return _parse_response(content, width, height)

    def classify(self, crop, context=None):
        """Name the single item in ``crop``, or None if it is not produce.

        Pass ``context`` - the full frame with this item outlined - to let the
        model judge scale. Without it a red blob is ambiguous between apple,
        tomato and radish; scale next to known neighbours is what separates
        them, and cropping is what destroyed it.
        """
        images = [crop] if context is None else [crop, context]
        prompt = CLASSIFY_PROMPT if context is None else CLASSIFY_CONTEXT_PROMPT
        try:
            content = self._chat(prompt, images, num_predict=40, json_format=False)
        except NoReading:
            return None
        name = _clean_name(content)
        # Abstention is a real answer; do not let it become an item name.
        return None if name in ("unknown", "ambiguous") else name

    def read(self, frame, vocabulary=None, samples=None, agreement=None):
        """Full Readings for the frame: counts, occlusion, container, unit.

        With ``samples`` > 1 the frame is read several times and only items
        the runs agree on are kept. This is not belt-and-braces: the items the
        model gets *wrong* are measurably the ones it is unstable about. On a
        real fridge photo every correct item repeated identically across three
        runs, while a misread blurry fruit flipped between 'radish' and
        'tomato' - so disagreement is a usable proxy for "do not trust this".

        Cheaper signals were tried first and did not work. Blur does not
        separate right from wrong (the model names heavily-blurred cucumbers
        correctly and sharper red spheres wrongly), and asking the model to
        answer `unknown` when unsure does not work either - told explicitly not
        to guess, it guessed anyway, three times out of three.

        Raises NoReading.
        """
        samples = samples or int(os.environ.get("CV_VLM_SAMPLES", 1))
        if samples > 1:
            return self._read_consensus(frame, vocabulary, samples, agreement)
        return self._read_once(frame, vocabulary)

    def _read_consensus(self, frame, vocabulary, samples, agreement=None):
        """Read repeatedly; keep what the runs agree on."""
        from collections import Counter

        needed = agreement or (samples // 2 + 1)
        runs = []
        for _ in range(samples):
            try:
                runs.append(self._read_once(frame, vocabulary))
            except NoReading:
                continue
        if not runs:
            raise NoReading(f"{self.model} produced no usable reading in {samples} tries")

        seen = Counter(r.sku_id for run in runs for r in run)
        kept = []
        for sku, hits in seen.items():
            if hits < needed:
                continue
            # Median count across the runs that saw it - one outlier run
            # should not move the number.
            counts = sorted(r.count_visible for run in runs for r in run if r.sku_id == sku)
            example = next(r for run in runs for r in run if r.sku_id == sku)
            kept.append(
                replace(
                    example,
                    count_visible=counts[len(counts) // 2],
                    confidence=hits / len(runs),
                )
            )
        return kept

    def _read_once(self, frame, vocabulary=None):
        from cv.labels import PRODUCE_CLASSES

        vocab = ", ".join(
            sorted(vocabulary or [c.canonical for c in PRODUCE_CLASSES])
        )
        content = self._chat(
            COUNT_PROMPT_V2.format(vocab=vocab),
            frame,
            num_predict=400,
            json_format=False,
        )
        return _parse_readings(content)

    def count(self, frame):
        """``{name: count}`` for the whole frame. Raises NoReading.

        This is the authoritative count. YOLOE cannot separate touching
        items - it proposed 3 boxes for 7 carrots, and stayed at 4 even at
        conf=0.04 - whereas asking here returned 6 consistently.
        """
        content = self._chat(COUNT_PROMPT, frame, num_predict=200, json_format=False)
        return _parse_counts(content)

    def _chat(self, prompt, image, num_predict, attempts=2, json_format=True):
        images = image if isinstance(image, list) else [image]
        """One vision call, retried once. Raises NoReading if nothing usable."""
        payload = {
            "model": self.model,
            "stream": False,
            "options": {
                # Ollama defaults to 0.8, which is noise on an extraction
                # task. Low but non-zero.
                "temperature": 0.2,
                "num_predict": num_predict,
            },
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                    "images": [encode_jpeg(i) for i in images],
                }
            ],
        }
        if json_format:
            payload["format"] = "json"

        last_reason = None
        for _ in range(attempts):
            try:
                response = requests.post(
                    f"{self.host}/api/chat", json=payload, timeout=self.timeout
                )
                response.raise_for_status()
            except requests.ConnectionError as exc:
                raise RuntimeError(
                    f"Could not reach Ollama at {self.host}. Is it running? "
                    f"Start it with 'ollama serve'."
                ) from exc

            body = response.json()
            content = (body.get("message") or {}).get("content") or ""
            if content.strip():
                return content

            # Empty content with done_reason='length' is the signature of a
            # thinking model burning its whole budget before answering. Worth
            # one retry; if the model is the wrong variant it will not recover.
            last_reason = body.get("done_reason")

        raise NoReading(
            f"{self.model} returned no usable content "
            f"(done_reason={last_reason!r}). If this repeats, check the model "
            f"is an -instruct variant: reasoning variants spend the whole "
            f"num_predict budget on hidden thinking."
        )


def _parse_readings(content):
    """Parse 'name ; count ; occlusion' lines into Readings.

    The counting unit is looked up rather than parsed: a bundle or container
    is one unit however many individual items are visible inside it, and that
    rule belongs to the taxonomy, not to whatever the model felt like saying.
    """
    from cv.backends.base import (
        OCCLUSION_NONE,
        OCCLUSION_PARTIAL,
        OCCLUSION_TRUNCATED,
        Reading,
    )
    from cv.labels import BUNDLE, CONTAINER, unit_for

    valid_occ = {
        "none": OCCLUSION_NONE,
        "partial": OCCLUSION_PARTIAL,
        "truncated": OCCLUSION_TRUNCATED,
        "full": "full",
    }

    readings = []
    for line in (content or "").splitlines():
        line = re.sub(r"^\s*(?:[-*\u2022]|\d+[.)])\s*", "", line).strip()
        parts = [p.strip().lower() for p in line.split(";")]
        if len(parts) < 2:
            continue

        name = _clean_name(parts[0])
        # Abstention is a first-class answer, not a parse failure - but an
        # unnamed item must not enter inventory.
        if not name or name in ("unknown", "ambiguous"):
            continue

        digits = re.search(r"\d+", parts[1])
        if not digits:
            continue
        visible = int(digits.group())
        if not 0 < visible <= MAX_PLAUSIBLE_COUNT:
            continue

        occ = valid_occ.get(parts[2].strip()) if len(parts) > 2 else OCCLUSION_NONE
        occ = occ or OCCLUSION_NONE

        unit = unit_for(name)
        container = None
        if unit in (BUNDLE, CONTAINER):
            # One bunch, one punnet. The visible count stays in count_visible.
            container = {"type": "bunch" if unit == BUNDLE else "container",
                         "count": 1}

        readings.append(
            Reading(
                sku_id=name,
                unit=unit,
                count_visible=visible,
                container=container,
                occlusion=occ,
            )
        )
    return readings


def _parse_counts(content):
    """Read 'name x count' lines into a dict, skipping anything unparseable.

    The model is asked for one item per line but will sometimes bullet the
    list, number it, drop the 'x', or add a closing sentence. Take the
    trailing integer as the count and whatever precedes it as the name.
    """
    counts = {}
    for line in (content or "").splitlines():
        # Strip bullets, dashes and list numbering.
        line = re.sub(r"^\s*(?:[-*•]|\d+[.)])\s*", "", line).strip()
        match = re.match(r"^(.+?)[\sx×:=]+(\d+)\s*$", line, re.IGNORECASE)
        if not match:
            continue

        name = _clean_name(match.group(1))
        if not name:
            continue

        count = int(match.group(2))
        if not 0 < count <= MAX_PLAUSIBLE_COUNT:
            continue

        counts[name] = counts.get(name, 0) + count
    return counts


def _clean_name(content):
    """Pull a produce name out of a free-text reply, or None."""
    line = (content or "").strip().splitlines()[0] if (content or "").strip() else ""
    name = line.strip().strip(".,!\"'").lower()
    if not name or name in {"none", "n/a", "nothing", "unknown"}:
        return None
    if len(name.split()) > MAX_NAME_WORDS:
        return None
    return name


def _parse_response(content, width, height):
    """Turn the model's JSON into Detections, skipping anything malformed.

    A local 8B will occasionally wrap the list differently or emit a short
    box. One bad frame must not kill the capture loop, so bad entries are
    dropped rather than raised on.
    """
    try:
        data = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return []

    entries = _extract_entries(data)

    detections = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        label = entry.get("label") or entry.get("name")
        box = entry.get("box_2d") or entry.get("bbox") or entry.get("box")
        if not label or not isinstance(box, (list, tuple)) or len(box) != 4:
            continue

        try:
            x1, y1, x2, y2 = (float(v) for v in box)
        except (TypeError, ValueError):
            continue

        # Models sometimes emit corners in the wrong order; a transposed box
        # still annotates without erroring, so normalise rather than trust it.
        x1, x2 = sorted((x1, x2))
        y1, y2 = sorted((y1, y2))
        if x2 <= x1 or y2 <= y1:
            continue

        detections.append(
            Detection(
                label=str(label).strip().lower(),
                # No calibrated score exists. A flat, obviously-nominal value
                # is more honest than inventing one.
                confidence=1.0,
                bbox=(
                    _clamp(x1, width),
                    _clamp(y1, height),
                    _clamp(x2, width),
                    _clamp(y2, height),
                ),
            )
        )
    return detections


def _extract_entries(data):
    """Find the list of objects, whichever shape the model wrapped it in."""
    if isinstance(data, list):
        return data
    if not isinstance(data, dict):
        return []

    for key in ("objects", "items", "detections", "produce", "results"):
        value = data.get(key)
        if isinstance(value, list):
            return value

    # Single unwrapped object.
    if "label" in data or "name" in data:
        return [data]
    return []


def _clamp(value, limit):
    """0-1000 grid coordinate -> pixels, held inside the frame."""
    return max(0.0, min(value * limit / BOX_SCALE, float(limit)))
