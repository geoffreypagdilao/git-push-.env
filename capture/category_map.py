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

# Detector labels whose canonical spelling in the items table differs from
# the class name above. Applied capture-side (see webcam_capture.py) before
# an event is sent, so the backend matches the existing row instead of
# creating a near-duplicate. The backend already normalizes case/whitespace;
# this is only for genuine spelling differences it can't infer (e.g.
# singular/plural). Keep it tiny and explicit - it is not a stemmer.
NAME_ALIASES = {
    "carrot": "carrots",
}


def category_for(name):
    return CATEGORY_MAP.get(name, "uncategorized")


def canonical_name(name):
    return NAME_ALIASES.get(name, name)
