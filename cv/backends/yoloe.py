"""Zero-shot open-vocabulary backend (YOLOE). Finds and boxes items.

No training, no dataset, no weights to manage: the produce list in
cv/labels.py is pushed in as text prompts at construction time.

This supplies the boxes and counts for cv/backends/hybrid.py, which then has
the VLM name each one. Its own labels are unreliable - it boxes broccoli
perfectly and calls it 'cabbage' - so the hybrid keeps the geometry and
replaces the name.
"""

from ultralytics import YOLOE

from cv.backends.base import Detection
from cv.labels import PROMPT_TO_CANONICAL, PROMPTS
from cv.model_store import download_into_weights_dir, resolve_model_path

DEFAULT_MODEL = "yoloe-26s-seg.pt"


class YoloeBackend:
    def __init__(self, model_path=DEFAULT_MODEL, conf=0.25, prompts=None):
        self.conf = conf
        self._prompts = list(prompts) if prompts is not None else list(PROMPTS)

        model_path = resolve_model_path(model_path)
        # set_classes() pulls down the MobileCLIP text encoder, so it has to
        # happen inside the block too - not just the checkpoint load.
        with download_into_weights_dir():
            self.model = YOLOE(model_path)
            self.model.set_classes(self._prompts)

    def predict(self, frame):
        results = self.model.predict(frame, conf=self.conf, verbose=False)
        return self._to_detections(results[0])

    def _to_detections(self, result):
        boxes = result.boxes
        if boxes is None or len(boxes) == 0:
            return []

        detections = []
        for cls_idx, confidence, xyxy in zip(
            boxes.cls.tolist(), boxes.conf.tolist(), boxes.xyxy.tolist()
        ):
            detections.append(
                Detection(
                    label=self._canonical(result, int(cls_idx)),
                    confidence=float(confidence),
                    bbox=tuple(float(v) for v in xyxy),
                )
            )
        return detections

    def _canonical(self, result, cls_idx):
        raw = result.names[cls_idx]
        # Model echoes the descriptive prompt back; translate to the name the
        # rest of the app uses.
        return PROMPT_TO_CANONICAL.get(raw, raw)
