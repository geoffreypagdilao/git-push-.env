"""YOLOE finds the items, the VLM names them.

Measured on the real drawer photos, the two models fail in exactly opposite
ways:

- YOLOE localises well and runs in ~0.4s, deterministically. It boxed broccoli
  perfectly and called it 'cabbage'; it boxes romaine correctly and calls it
  'kale'. Every error it has left is a naming error.
- Qwen3-VL names produce well - it read blackberries through a transparent
  punnet - but detecting a whole frame took 37-186s at roughly 50% usable.
  Asking it to name a single crop instead: 1.9-3.2s, 3/3 consistent.

So each model does the half it is good at. Counting stays deterministic and
cheap, which also matters because the count is what drives ``inventory_log``.
"""

import os

from cv.backends.base import Detection, deduplicate, draw_focus_box

# A tight crop hands the model an object with no surroundings, which reads
# very differently to a photo of that object. A little context helps.
DEFAULT_MARGIN = 0.12

# Below this, a crop carries too little detail to name and the model starts
# guessing: a 41x51px box of berries came back 'tomato' three times running,
# where YOLOE's own 'strawberry' was right. Upscaling does not recover the
# detail - it was never captured. Keep the detector's label instead.
MIN_CROP_PX = 48

# Optionally send the whole frame, with this box outlined, alongside the crop,
# so the model can judge scale (see classify() in backends/ollama_vlm.py).
#
# Off by default, because measuring it did not support turning it on. On
# cv/test_images/apple.webp, 32 boxes, each disputed box re-run 5x and stable
# 5/5 both ways:
#
#   72x64 box, mid-bowl   crop alone 'tomato'  -> with context 'apple'  (fixed)
#   47x67 box, top, small crop alone 'apple'   -> with context 'pear'   (broke)
#
# One fixed, one broken, for 22.6s -> 93.3s on the same image. A second image
# per call is a 4x cost, and one photo of one fruit is not enough evidence to
# pay it. Worth re-testing against cv/eval_set (real ground truth, 40 photos)
# before flipping this: CV_HYBRID_CONTEXT=1.
DEFAULT_USE_CONTEXT = False


class HybridBackend:
    # YOLOE supplies the boxes, so its prompt-variant duplicates still need
    # the IoU/containment pass.
    needs_dedupe = True

    def __init__(self, model_path=None, conf=0.25, margin=None, vlm=None,
                 detector=None, use_context=None):
        from cv.backends.ollama_vlm import OllamaVlmBackend
        from cv.backends.yoloe import DEFAULT_MODEL, YoloeBackend

        self.detector = detector or YoloeBackend(model_path or DEFAULT_MODEL, conf=conf)
        self.vlm = vlm or OllamaVlmBackend()
        self.margin = (
            margin
            if margin is not None
            else float(os.environ.get("CV_HYBRID_MARGIN", DEFAULT_MARGIN))
        )
        self.use_context = (
            use_context
            if use_context is not None
            else os.environ.get("CV_HYBRID_CONTEXT", "0") in ("1", "true", "yes")
        )
        # A fixed camera shows the same drawer for hours. Without this the
        # same crops get re-classified every frame at ~2s each.
        self._cache = {}

    def predict(self, frame):
        height, width = frame.shape[:2]

        # Dedupe first: classifying duplicate boxes would pay the VLM cost
        # twice for one object, and they are dropped straight after anyway.
        boxes = deduplicate(self.detector.predict(frame))

        named = []
        for det in boxes:
            named.append(
                Detection(
                    label=self._name(frame, det, width, height),
                    # Keep YOLOE's geometry and score - the VLM supplies only
                    # the name, and has no calibrated confidence to offer.
                    confidence=det.confidence,
                    bbox=det.bbox,
                )
            )
        return named

    def read(self, frame):
        """Full Readings: counts, units, occlusion, container. See base.Reading."""
        return self.vlm.read(frame)

    def count(self, frame):
        """``{name: count}`` for the frame, from the VLM.

        Separate from predict() because the two answer different questions.
        predict() returns boxes, and a box is not an item: YOLOE draws one
        box over a bunch of touching carrots, so counting boxes undercounts
        badly (3 boxes for 7 carrots). The VLM counts the frame directly.
        """
        return self.vlm.count(frame)

    def _name(self, frame, det, width, height):
        key = self._cache_key(det)
        if key in self._cache:
            return self._cache[key]

        crop = _crop(frame, det.bbox, self.margin, width, height)
        label = None
        if crop is not None and min(crop.shape[:2]) >= MIN_CROP_PX:
            context = draw_focus_box(frame, det.bbox) if self.use_context else None
            try:
                label = self.vlm.classify(crop, context=context)
            except RuntimeError:
                # Ollama unreachable or exhausted. A YOLOE name is worse than
                # a VLM name but far better than dropping a real item.
                label = None

        label = label or det.label
        self._cache[key] = label
        return label

    def _cache_key(self, det):
        # Round hard: a box that wobbles a few pixels between frames is the
        # same object, and should not miss the cache.
        return (det.label,) + tuple(round(v / 16) for v in det.bbox)

    def clear_cache(self):
        self._cache.clear()


def _crop(frame, bbox, margin, width, height):
    x1, y1, x2, y2 = bbox
    pad_x = (x2 - x1) * margin
    pad_y = (y2 - y1) * margin

    left = max(0, int(x1 - pad_x))
    top = max(0, int(y1 - pad_y))
    right = min(width, int(x2 + pad_x))
    bottom = min(height, int(y2 + pad_y))
    if right <= left or bottom <= top:
        return None

    return frame[top:bottom, left:right]
