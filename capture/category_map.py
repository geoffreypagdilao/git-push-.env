# Maps cv.Detector's output labels to the categories used in
# shelf_life_lookup. The Detector has no fixed label set of its own —
# it's YOLO-World, configured per-instantiation via class_names — so
# this list *is* the production label set, picked from the produce
# examples already named in the shelf_life_lookup migration comments.
CATEGORY_MAP = {
    "spinach": "leafy_greens",
    "lettuce": "leafy_greens",
    "kale": "leafy_greens",
    "carrot": "root_vegetable",
    "potato": "root_vegetable",
    "onion": "root_vegetable",
    "broccoli": "vegetable_other",
    "bell pepper": "vegetable_other",
    "tomato": "vegetable_other",
    "apple": "fruit",
    "orange": "fruit",
}

DETECTOR_CLASS_NAMES = list(CATEGORY_MAP.keys())


def category_for(name):
    return CATEGORY_MAP.get(name, "uncategorized")
