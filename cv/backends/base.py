"""The contract every detector backend implements.

Keeping this narrow - one method, one return type - is what lets the
zero-shot YOLOE backend and a later fine-tuned backend swap without any
caller changing.
"""

import base64
from dataclasses import dataclass
from typing import List, Protocol, Tuple

import cv2

MAX_EDGE_PX = 1024


@dataclass(frozen=True)
class Detection:
    label: str  # canonical name, see cv/labels.py
    confidence: float
    bbox: Tuple[float, float, float, float]  # xyxy, pixels


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
