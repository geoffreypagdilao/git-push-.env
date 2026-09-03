"""Temporal smoothing over per-frame counts.

The capture script posts a frame every two seconds. A hand reaching into the
drawer, a shadow, or one unlucky frame will make raw counts jump around, and
every jump would otherwise become an ``inventory_log`` row - which is exactly
the signal agent/consumption.py reads to learn consumption pace. Noise there
is worse than latency, so a count only becomes "real" once several recent
frames agree on it.

Pure logic, no model dependency.
"""

from collections import Counter, deque


class CountStabilizer:
    def __init__(self, window=5, min_agreement=3):
        if min_agreement > window:
            raise ValueError("min_agreement cannot exceed window")

        self.window = window
        self.min_agreement = min_agreement
        self._frames = deque(maxlen=window)
        self._stable = {}

    def update(self, counts):
        """Feed one frame's counts, get back the current stable counts."""
        self._frames.append(dict(counts))

        # Labels seen recently at all, plus whatever we already consider
        # stable - a label vanishing needs the same agreement to drop to 0.
        labels = set(self._stable)
        for frame in self._frames:
            labels.update(frame)

        for label in labels:
            values = Counter(frame.get(label, 0) for frame in self._frames)
            value, agreement = values.most_common(1)[0]
            if agreement < self.min_agreement:
                continue

            if value == 0:
                self._stable.pop(label, None)
            else:
                self._stable[label] = value

        return dict(self._stable)

    @property
    def stable_counts(self):
        return dict(self._stable)

    def reset(self):
        self._frames.clear()
        self._stable = {}
