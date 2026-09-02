"""The contract every detector backend implements.

Keeping this narrow - one method, one return type - is what lets the
zero-shot YOLOE backend and a later fine-tuned backend swap without any
caller changing.
"""

import base64
from dataclasses import dataclass
from typing import List, Optional, Protocol, Tuple

import cv2

MAX_EDGE_PX = 1024


@dataclass(frozen=True)
class Detection:
    """One box the detector proposed. Geometry only - the name is a guess."""

    label: str  # canonical name, see cv/labels.py
    confidence: float
    bbox: Tuple[float, float, float, float]  # xyxy, pixels


# How much of the item the camera can actually see. Kept explicit because an
# estimate must never masquerade as an observation.
OCCLUSION_NONE = "none"
OCCLUSION_PARTIAL = "partial"
OCCLUSION_FULL = "full"
OCCLUSION_TRUNCATED = "truncated"  # cut off by the frame edge


@dataclass(frozen=True)
class Reading:
    """What the pipeline believes about one kind of produce in one frame.

    Deliberately not a single integer. The system holds three different kinds
    of knowledge and collapsing them at this layer destroys the provenance
    downstream logic needs:

    - ``count_visible``   instances actually seen. Defensible and auditable.
    - ``count_estimated`` a (low, high) range, only when occlusion hides some.
    - ``container``       e.g. {"type": "punnet", "count": 1} - a punnet of
                          strawberries is 1 punnet *and* ~28 strawberries.
                          Those are different fields, not rival answers.

    A strawberry punnet reads as container={'type':'punnet','count':1},
    count_visible=28, count_estimated=(40,60), occlusion='partial' - which is
    the honest answer. Collapse to one number at the presentation layer if the
    UI needs it, never here.
    """

    sku_id: str
    unit: str  # discrete | bundle | container, from cv/labels.py
    count_visible: int
    container: Optional[dict] = None
    count_estimated: Optional[Tuple[int, int]] = None
    occlusion: str = OCCLUSION_NONE
    confidence: float = 1.0
    evidence_box: Optional[Tuple[float, float, float, float]] = None

    def best_count(self):
        """One number, for callers that must have one.

        Bundles and containers count as one unit - a coriander bunch is 1, not
        200 leaves - which is the whole point of the unit taxonomy.
        """
        if self.unit in ("bundle", "container"):
            return (self.container or {}).get("count", 1)
        return self.count_visible

    def is_floor(self):
        """True when the count is a lower bound rather than a total."""
        return self.occlusion in (OCCLUSION_PARTIAL, OCCLUSION_FULL)


class DetectorBackend(Protocol):
    def predict(self, frame) -> List[Detection]:
        """Run inference on a single BGR frame."""
        ...


def iou(a, b):
    """Intersection-over-union of two xyxy boxes."""
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
    ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])
    overlap = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    if overlap <= 0:
        return 0.0

    area_a = max(0.0, a[2] - a[0]) * max(0.0, a[3] - a[1])
    area_b = max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])
    union = area_a + area_b - overlap
    return overlap / union if union > 0 else 0.0


def encode_jpeg(frame, max_edge=MAX_EDGE_PX):
    """BGR frame -> base64 JPEG, downscaled first.

    Lives here rather than in a VLM module so the local Ollama path does not
    have to import the Anthropic one (and with it pydantic) just to reuse it.

    The downscale is worth it on both paths: hosted models bill an image at
    roughly width*height/750 tokens, and a local model's latency scales the
    same way. Produce fills enough of a drawer frame that 1024px loses
    nothing.
    """
    height, width = frame.shape[:2]
    longest = max(height, width)
    if longest > max_edge:
        scale = max_edge / longest
        frame = cv2.resize(
            frame,
            (int(width * scale), int(height * scale)),
            interpolation=cv2.INTER_AREA,
        )

    ok, buffer = cv2.imencode(".jpg", frame)
    if not ok:
        raise RuntimeError("Failed to JPEG-encode frame for the vision request")
    return base64.b64encode(buffer.tobytes()).decode("ascii")


def draw_focus_box(frame, bbox, thickness=6):
    """Copy of the frame with one box outlined, for context prompting.

    A tight crop of a red blob is genuinely ambiguous between apple, tomato,
    nectarine and red pepper - a person cannot do it either. What separates
    them is scale relative to the shelf and neighbours, which is precisely
    what cropping destroys. Sending this alongside the crop restores it.
    """
    out = frame.copy()
    x1, y1, x2, y2 = (int(v) for v in bbox)
    cv2.rectangle(out, (x1, y1), (x2, y2), (0, 0, 255), thickness)
    return out


def containment(a, b):
    """Fraction of the *smaller* box that the two boxes share.

    IoU is the wrong test for one box swallowing another: a large 'kale' box
    covering two small 'lettuce' boxes scores only ~0.39 IoU, because IoU
    charges for the size difference. Containment ignores it and reads ~1.0,
    which is what "these are the same object" actually looks like.
    """
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
    ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])
    overlap = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    if overlap <= 0:
        return 0.0

    area_a = max(0.0, a[2] - a[0]) * max(0.0, a[3] - a[1])
    area_b = max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])
    smaller = min(area_a, area_b)
    return overlap / smaller if smaller > 0 else 0.0


def deduplicate(detections, iou_threshold=0.6, containment_threshold=0.8):
    """Collapse boxes that describe the same physical item.

    Two distinct causes, so two tests:

    Same label, high IoU. Each produce class is prompted several ways (see
    cv/labels.py), and two phrasings landing on the same carrot both survive
    the model's own NMS - they were different classes as far as it knew.

    Different labels, one box inside the other. The model names one object
    twice, e.g. a 'kale' box swallowing two 'lettuce' boxes. For an inventory
    count one object must yield one item, so the enclosed boxes go.

    Highest confidence wins in both cases.
    """
    kept = []
    for det in sorted(detections, key=lambda d: -d.confidence):
        duplicate = False
        for other in kept:
            if other.label == det.label:
                duplicate = iou(other.bbox, det.bbox) >= iou_threshold
            else:
                duplicate = (
                    containment(other.bbox, det.bbox) >= containment_threshold
                )
            if duplicate:
                break
        if not duplicate:
            kept.append(det)
    return kept
