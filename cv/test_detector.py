import cv2

from cv.detector import Detector

detector = Detector(["egg carton", "milk carton", "cereal box"])

frame = cv2.imread("cv/test_images/before.jpg")
result = detector.detect(frame)

print(result)
