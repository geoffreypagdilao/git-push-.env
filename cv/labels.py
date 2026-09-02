"""Single source of truth for what the drawer camera looks for.

Each class carries:

- ``canonical`` - what gets written to ``items.name`` in Supabase.
- ``prompts``   - one or more phrasings handed to the open-vocabulary model.
- ``category``  - one of the five rows in ``shelf_life_lookup``.

Why several prompts per class: YOLOE's score for the *same object* swings
wildly with phrasing, and not in one direction. Measured on real photos:

    'banana'                    0.78   vs  'a yellow banana'          0.17
    'carrot'                    0.47   vs  'an orange carrot'         0.25
    'cucumber'                  0.23   vs  'a long green cucumber'    0.12
    'a head of green broccoli'  0.50   vs  'broccoli'                 0.31
    'a head of green leaf lettuce' 0.26 vs 'lettuce'                  0.17

The pattern: leading colour adjectives hurt badly, structural descriptors
("a head of", "a bunch of") help. Rather than bet on one phrasing per class,
every class keeps its bare noun and adds a structural variant only where the
variant earns its place. All variants map back to one canonical name, so the
detector merges them; overlapping boxes are deduplicated by IoU downstream
(cv/backends/base.py) to stop one carrot counting as two.

``category`` must be one of the five rows seeded in ``shelf_life_lookup``
(see supabase/migrations/20260823150120_initial_schema.sql). ``items.category``
is a foreign key onto that table, so an unmapped label fails the insert rather
than falling back gracefully.
"""

from dataclasses import dataclass
from typing import Tuple

LEAFY_GREENS = "leafy_greens"
ROOT_VEGETABLE = "root_vegetable"
VEGETABLE_OTHER = "vegetable_other"
FRUIT = "fruit"
UNCATEGORIZED = "uncategorized"

# Mirrors the primary keys of shelf_life_lookup.
VALID_CATEGORIES = frozenset(
    {LEAFY_GREENS, ROOT_VEGETABLE, VEGETABLE_OTHER, FRUIT, UNCATEGORIZED}
)


# --- Counting units -------------------------------------------------
# "How many things are here" has no answer until you fix what a thing is.
# Every class must be exactly one of these, and the counting logic reads the
# unit off the class rather than guessing per prompt.
DISCRETE = "discrete"    # 1 object = 1 count.       apple, cucumber, pepper
BUNDLE = "bundle"        # 1 bunch/bag = 1 count.    coriander, spinach
CONTAINER = "container"  # 1 container = 1 count, contents estimated apart.

VALID_UNITS = frozenset({DISCRETE, BUNDLE, CONTAINER})


@dataclass(frozen=True)
class ProduceClass:
    canonical: str
    prompts: Tuple[str, ...]
    category: str
    unit: str = DISCRETE


def _c(canonical, category, *extra_prompts, unit=DISCRETE):
    """A class prompted by its bare noun plus any variants worth adding."""
    return ProduceClass(canonical, (canonical,) + extra_prompts, category, unit)


PRODUCE_CLASSES = [
    # --- leafy greens -------------------------------------------------
    _c("spinach", LEAFY_GREENS, "a bunch of fresh spinach leaves", unit=BUNDLE),
    _c("lettuce", LEAFY_GREENS, "a head of green leaf lettuce"),
    _c("kale", LEAFY_GREENS, "a bunch of curly kale", unit=BUNDLE),
    _c("cabbage", LEAFY_GREENS, "a round head of cabbage"),
    _c("bok choy", LEAFY_GREENS, unit=BUNDLE),
    _c("spring onion", LEAFY_GREENS, "a bunch of spring onions", unit=BUNDLE),
    _c("coriander", LEAFY_GREENS, "a bunch of fresh coriander", "cilantro", unit=BUNDLE),
    _c("parsley", LEAFY_GREENS, "a bunch of flat leaf parsley", unit=BUNDLE),
    _c("herbs", LEAFY_GREENS, unit=BUNDLE),
    # --- root vegetables ----------------------------------------------
    _c("carrot", ROOT_VEGETABLE, "a carrot vegetable"),
    _c("potato", ROOT_VEGETABLE, "a raw potato"),
    _c("onion", ROOT_VEGETABLE, "a whole onion with papery skin"),
    _c("sweet potato", ROOT_VEGETABLE),
    _c("garlic", ROOT_VEGETABLE, "a bulb of garlic"),
    _c("ginger", ROOT_VEGETABLE, "a root of fresh ginger"),
    _c("radish", ROOT_VEGETABLE),
    # --- other vegetables ---------------------------------------------
    _c("broccoli", VEGETABLE_OTHER, "a head of green broccoli"),
    _c("cauliflower", VEGETABLE_OTHER, "a head of cauliflower"),
    _c("bell pepper", VEGETABLE_OTHER, "a glossy bell pepper"),
    # The only class prompted without its bare noun. "chili pepper" alone
    # scores 0.87 on a red *bell* pepper and steals it; the shape-based
    # phrasing scores 0.07 on the same pepper, so it discriminates.
    ProduceClass("chili pepper", ("a long thin chili pepper",), VEGETABLE_OTHER),
    # Botanically a fruit, but the schema's seed notes file it under
    # vegetable_other - follow the schema, not the botany.
    _c("tomato", VEGETABLE_OTHER, "a ripe tomato"),
    _c("cucumber", VEGETABLE_OTHER, "a cucumber vegetable"),
    _c("zucchini", VEGETABLE_OTHER, "a zucchini courgette"),
    _c("eggplant", VEGETABLE_OTHER, "an eggplant aubergine"),
    _c("green beans", VEGETABLE_OTHER, "a handful of green beans", unit=BUNDLE),
    _c("corn", VEGETABLE_OTHER, "an ear of corn"),
    _c("mushroom", VEGETABLE_OTHER, "a button mushroom"),
    # --- fruit ---------------------------------------------------------
    _c("apple", FRUIT),
    _c("banana", FRUIT, "a bunch of bananas"),   # discrete: bananas are counted individually
    # "orange" alone is also a colour; the variant disambiguates.
    _c("orange", FRUIT, "an orange citrus fruit"),
    _c("lemon", FRUIT),
    _c("lime", FRUIT, "a lime fruit"),
    _c("grapes", FRUIT, "a bunch of grapes", unit=CONTAINER),
    _c("strawberry", FRUIT, unit=CONTAINER),
    _c("cherry", FRUIT, "a jar of cherries", unit=CONTAINER),
    _c("avocado", FRUIT),
    _c("pear", FRUIT),
    _c("mango", FRUIT),
]

# The list actually passed to YOLOE.set_classes(), in index order.
PROMPTS = [prompt for item in PRODUCE_CLASSES for prompt in item.prompts]

# YOLOE echoes prompts back as class names; translate them back before the
# labels leave this package. Many-to-one by design.
PROMPT_TO_CANONICAL = {
    prompt: item.canonical for item in PRODUCE_CLASSES for prompt in item.prompts
}

CATEGORY_FOR = {item.canonical: item.category for item in PRODUCE_CLASSES}
UNIT_FOR = {item.canonical: item.unit for item in PRODUCE_CLASSES}

# Units for names the VLM may return that are not prompted for.
EXTRA_UNITS = {
    "green onion": BUNDLE, "scallion": BUNDLE,
    "blackberry": CONTAINER, "blueberry": CONTAINER, "raspberry": CONTAINER,
    "berry": CONTAINER, "cilantro": BUNDLE, "asparagus": BUNDLE,
    "celery": BUNDLE, "leek": BUNDLE, "peas": CONTAINER,
}


def unit_for(label):
    """How this item is counted: discrete, bundle or container."""
    if not label:
        return DISCRETE
    name = label.strip().lower()
    for table in (UNIT_FOR, EXTRA_UNITS):
        if name in table:
            return table[name]
    words = name.split()
    if len(words) > 1:
        for table in (UNIT_FOR, EXTRA_UNITS):
            if words[-1] in table:
                return table[words[-1]]
    return DISCRETE

# Names the VLM returns that are not worth prompting YOLOE for, but still need
# a shelf life. The VLM names things open-vocabulary, so it is not limited to
# the 33 classes above - it reported 'blackberry' off a real drawer photo, and
# without an entry here that becomes 'uncategorized' and gets a 7-day shelf
# life when berries last about three.
EXTRA_CATEGORIES = {
    # Synonyms the VLM returns for classes we already have. Without these the
    # same object fragments across two names in the inventory table.
    "cilantro": LEAFY_GREENS,
    "green onion": LEAFY_GREENS,
    "scallion": LEAFY_GREENS,
    "capsicum": VEGETABLE_OTHER,
    "courgette": VEGETABLE_OTHER,
    "aubergine": VEGETABLE_OTHER,
    "blackberry": FRUIT,
    "blueberry": FRUIT,
    "raspberry": FRUIT,
    "berry": FRUIT,
    "celery": VEGETABLE_OTHER,
    "leek": VEGETABLE_OTHER,
    "asparagus": VEGETABLE_OTHER,
    "peas": VEGETABLE_OTHER,
}


def category_for(label):
    """Shelf-life category for a produce name, or 'uncategorized'.

    Never raises - an unrecognised name is a detection problem, not a reason
    to drop the item, and 'uncategorized' is a real row in shelf_life_lookup
    so the foreign key on items.category still holds.
    """
    if not label:
        return UNCATEGORIZED

    name = label.strip().lower()
    for table in (CATEGORY_FOR, EXTRA_CATEGORIES):
        if name in table:
            return table[name]

    # Fall back to the head noun, so varietal and size modifiers inherit the
    # right shelf life: 'romaine lettuce' -> lettuce, 'cherry tomato' ->
    # tomato, 'baby carrot' -> carrot. The VLM produces these freely.
    words = name.split()
    if len(words) > 1:
        head = words[-1]
        for table in (CATEGORY_FOR, EXTRA_CATEGORIES):
            if head in table:
                return table[head]

    return UNCATEGORIZED


def _assert_labels_valid():
    unmapped = {
        item.canonical: item.category
        for item in PRODUCE_CLASSES
        if item.category not in VALID_CATEGORIES
    }
    if unmapped:
        raise ValueError(
            f"Labels map to categories that are not in shelf_life_lookup: {unmapped}"
        )

    if len(PROMPT_TO_CANONICAL) != len(PROMPTS):
        raise ValueError("Duplicate prompt text across PRODUCE_CLASSES")

    bad_units = {i.canonical: i.unit for i in PRODUCE_CLASSES if i.unit not in VALID_UNITS}
    if bad_units:
        raise ValueError(f"Classes with an invalid counting unit: {bad_units}")


_assert_labels_valid()
