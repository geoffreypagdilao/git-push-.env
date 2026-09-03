# Runs locally on the machine with the webcam attached - not containerized.
import os
import sys
import time
from pathlib import Path

import cv2
import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cv.detector import Detector

from category_map import DETECTOR_CLASS_NAMES, canonical_name, category_for

load_dotenv()

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8010")
FRAME_ENDPOINT = f"{BACKEND_URL}/webhook/frame"
CAPTURE_INTERVAL_SECONDS = 2


def diff_counts(previous_counts, current_counts):
    items = []
    for name in set(previous_counts) | set(current_counts):
        delta = current_counts.get(name, 0) - previous_counts.get(name, 0)
        if delta == 0:
            continue
        event_type = "added" if delta > 0 else "removed"
        category = category_for(name)
        payload_name = canonical_name(name)
        for _ in range(abs(delta)):
            items.append({"name": payload_name, "category": category, "event_type": event_type})
    return items


def main():
    detector = Detector(DETECTOR_CLASS_NAMES)

    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not cap.isOpened():
        raise RuntimeError("Could not open webcam (index 0). Is it connected and not in use by another app?")

    print(f"Capturing frames every {CAPTURE_INTERVAL_SECONDS}s -> POST {FRAME_ENDPOINT}")
    print("Press Ctrl+C to stop.")

    previous_counts = {}

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                print("Failed to read frame from webcam, retrying...")
                time.sleep(CAPTURE_INTERVAL_SECONDS)
                continue

            current_counts = detector.detect(frame)
            items = diff_counts(previous_counts, current_counts)
            previous_counts = current_counts

            if items:
                try:
                    response = requests.post(FRAME_ENDPOINT, json={"items": items}, timeout=5)
                    response.raise_for_status()
                except requests.RequestException as exc:
                    print(f"Failed to POST frame diff: {exc}")

            time.sleep(CAPTURE_INTERVAL_SECONDS)
    except KeyboardInterrupt:
        print("\nStopping capture.")
    finally:
        cap.release()


if __name__ == "__main__":
    main()
