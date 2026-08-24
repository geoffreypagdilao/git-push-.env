from collections import Counter

from ultralytics import YOLOWorld


class Detector:
    def __init__(self, class_names, model_path="yolov8s-worldv2.pt"):
        self.model = YOLOWorld(model_path)
        self.model.set_classes(class_names)

    def detect(self, frame):
        results = self.model.predict(frame, verbose=False)
        result = results[0]

        counts = Counter()
        for cls_idx in result.boxes.cls.tolist():
            label = result.names[int(cls_idx)]
            counts[label] += 1

        return dict(counts)
