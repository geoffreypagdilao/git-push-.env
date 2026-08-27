import os
from collections import Counter

from cv.backends.base import deduplicate

DEFAULT_CONF_THRESHOLD = 0.25
DEFAULT_IOU_THRESHOLD = 0.6

_detector = None


class Detector:
    """Turns a webcam frame into produce counts.

    The model is chosen by environment so the rest of the app never names one:

    - ``CV_BACKEND``        ``yoloe`` (default, zero-shot) or ``finetuned``
    - ``CV_MODEL_PATH``     weights path; defaults per backend
    - ``CV_CONF_THRESHOLD`` minimum confidence, default 0.25
    """

    def __init__(self, backend=None, model_path=None, conf=None, iou=None):
        backend = backend or os.environ.get("CV_BACKEND", "yoloe")
        model_path = model_path or os.environ.get("CV_MODEL_PATH")
        if conf is None:
            conf = float(
                os.environ.get("CV_CONF_THRESHOLD", DEFAULT_CONF_THRESHOLD)
            )
        if iou is None:
            iou = float(os.environ.get("CV_IOU_THRESHOLD", DEFAULT_IOU_THRESHOLD))

        self.backend_name = backend
        self.iou_threshold = iou
        self.backend = _build_backend(backend, model_path, conf)

    def detect_detailed(self, frame):
        """Full detections for this frame: label, confidence, bbox.

        Detector backends are deduplicated, so a class matched by two of its
        prompts counts once. VLM backends set ``needs_dedupe = False``: they
        already report each item once, and running the pass over them would
        collapse genuine duplicates, since three carrots share a label and
        usually overlap.
        """
        detections = self.backend.predict(frame)
        if getattr(self.backend, "needs_dedupe", True):
            detections = deduplicate(detections, self.iou_threshold)
        return detections

    def detect(self, frame):
        """``{label: count}`` for this frame - the inventory reading.

        Where the backend can count directly it is asked to, because counting
        boxes is not the same as counting items. YOLOE draws a single box over
        a bunch of touching carrots, so box-counting reported 3 where there
        were 7; the VLM asked to count the same frame said 6, three times out
        of three. Backends without a counter fall back to counting boxes.
        """
        counter = getattr(self.backend, "count", None)
        if counter is not None:
            return counter(frame)

        return dict(Counter(d.label for d in self.detect_detailed(frame)))


def _build_backend(name, model_path, conf):
    # Imported lazily so cv.labels and cv.smoothing stay usable without
    # ultralytics/torch installed.
    if name == "yoloe":
        from cv.backends.yoloe import DEFAULT_MODEL, YoloeBackend

        return YoloeBackend(model_path or DEFAULT_MODEL, conf=conf)

    if name == "hybrid":
        from cv.backends.hybrid import HybridBackend

        return HybridBackend(model_path, conf=conf)

    if name == "ollama":
        from cv.backends.ollama_vlm import OllamaVlmBackend

        return OllamaVlmBackend(model_path, conf=conf)

    raise ValueError(
        f"Unknown CV_BACKEND {name!r} (expected 'hybrid', 'yoloe' or 'ollama')"
    )


def get_detector():
    """Process-wide singleton.

    Loading weights takes seconds; the capture script posts a frame every two,
    so constructing a Detector per request would spend all its time reloading
    the model. Always go through this from request handlers.
    """
    global _detector
    if _detector is None:
        _detector = Detector()
    return _detector
