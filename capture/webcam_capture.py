# Runs locally on the machine with the webcam attached - not containerized.
import os
import time

import cv2
import requests
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
FRAME_ENDPOINT = f"{BACKEND_URL}/webhook/frame"
CAPTURE_INTERVAL_SECONDS = 2


def main():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Could not open webcam (index 0). Is it connected and not in use by another app?")

    print(f"Capturing frames every {CAPTURE_INTERVAL_SECONDS}s -> POST {FRAME_ENDPOINT}")
    print("Press Ctrl+C to stop.")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                print("Failed to read frame from webcam, retrying...")
                time.sleep(CAPTURE_INTERVAL_SECONDS)
                continue

            ok, jpeg = cv2.imencode(".jpg", frame)
            if not ok:
                print("Failed to encode frame as JPEG, skipping...")
                time.sleep(CAPTURE_INTERVAL_SECONDS)
                continue

            try:
                response = requests.post(
                    FRAME_ENDPOINT,
                    data=jpeg.tobytes(),
                    headers={"Content-Type": "image/jpeg"},
                    timeout=5,
                )
                response.raise_for_status()
            except requests.RequestException as exc:
                print(f"Failed to POST frame: {exc}")

            time.sleep(CAPTURE_INTERVAL_SECONDS)
    except KeyboardInterrupt:
        print("\nStopping capture.")
    finally:
        cap.release()


if __name__ == "__main__":
    main()
