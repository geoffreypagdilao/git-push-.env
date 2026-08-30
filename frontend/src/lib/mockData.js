// Seed data for the yoink! demo. Dates are computed relative to "now" at
// seed time so the "use soon" / depletion logic always has something to show.
// Shapes mirror the FastAPI backend (backend/app/routes/*.py) so wiring the
// real API later is a swap, not a rewrite.

const DAY = 86_400_000

let uid = 0
const id = (p) => `${p}-${++uid}`

// days-from-now -> ISO date string (date only)
const inDays = (n) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10)

/**
 * item: { id, name, category, section, qty, unit, addedDaysAgo, expiryDate|null,
 *         shelfLifeDays, perWeek }  — perWeek = learned consumption rate
 */
function makeInventory() {
  uid = 0
  // columns: name, category, section, qty, unit, addedDaysAgo, daysToExpiry, perWeek
  // daysToExpiry is measured from *now*; null = no date set yet.
  const raw = [
    // ── fresh ──────────────────────────────────────────────────────────
    ['Salmon Fillet', 'Meat & Fish', 'fresh', 2, 'fillets', 2, 1, 1],
    ['Leftover Pad Thai', 'Leftovers', 'fresh', 1, 'box', 2, 1, 2],
    ['Chicken Thighs', 'Meat & Fish', 'fresh', 1, 'pack', 3, 2, 1],
    ['Baby Spinach', 'Vegetables', 'fresh', 1, 'bag', 4, 2, 1.5],
    ['Heirloom Tomatoes', 'Vegetables', 'fresh', 4, 'pcs', 4, 3, 5],
    ['Milk', 'Dairy & Eggs', 'fresh', 0.4, 'L', 6, 4, 2],
    ['Orange Juice', 'Drinks', 'fresh', 0.9, 'L', 5, 5, 2],
    ['Red Bell Pepper', 'Vegetables', 'fresh', 2, 'pcs', 5, 6, 1.5],
    ['Greek Yogurt', 'Dairy & Eggs', 'fresh', 2, 'tubs', 3, 8, 2],
    ['Eggs', 'Dairy & Eggs', 'fresh', 5, 'pcs', 6, 16, 5],
    ['Carrots', 'Vegetables', 'fresh', 6, 'pcs', 6, 13, 3],
    ['Cheddar', 'Dairy & Eggs', 'fresh', 1, 'block', 10, 22, 1],
    // no expiry yet — surfaces in the baseline-scan "needs a date" flow
    ['Butter', 'Dairy & Eggs', 'fresh', 1, 'block', 8, null, 0.6],
    ['Spring Onions', 'Vegetables', 'fresh', 1, 'bunch', 4, null, 1.5],
    // ── pantry ─────────────────────────────────────────────────────────
    ['Jasmine Rice', 'Grains & Pasta', 'pantry', 0.3, 'kg', 20, 360, 1],
    ['Rigatoni', 'Grains & Pasta', 'pantry', 1.5, 'boxes', 30, 360, 0.5],
    ['Canned Chickpeas', 'Grains & Pasta', 'pantry', 3, 'cans', 40, 540, 1],
    ['Peanut Butter', 'Condiments', 'pantry', 0.08, 'jar', 45, 280, 0.5],
    ['Olive Oil', 'Condiments', 'pantry', 0.7, 'L', 50, 540, 0.18],
    ['Soy Sauce', 'Condiments', 'pantry', 1, 'bottle', 60, 700, 0.1],
    ['Sea Salt Crackers', 'Snacks', 'pantry', 2, 'sleeves', 12, 110, 1.5],
  ]

  return raw.map(([name, category, section, qty, unit, addedDaysAgo, daysToExpiry, perWeek]) => ({
    id: id('itm'),
    name,
    category,
    section,
    qty,
    unit,
    addedDaysAgo,
    shelfLifeDays: daysToExpiry == null ? null : addedDaysAgo + daysToExpiry,
    expiryDate: daysToExpiry == null ? null : inDays(daysToExpiry),
    perWeek,
  }))
}

/**
 * shopping entry: { id, name, source:'auto'|'manual', reason, urgency, qty, unit, status }
 * urgency: 'bad' | 'warn' (auto only) — drives the status dot
 * status mirrors backend: 'pending' | 'in_cart' | 'purchased'
 */
function makeShopping() {
  const s = (name, source, reason, urgency, qty, unit) => ({
    id: id('shp'), name, source, reason, urgency, qty, unit, status: 'pending',
  })
  return [
    s('Peanut Butter', 'auto', 'Out since Monday', 'bad', 1, 'jar'),
    s('Milk', 'auto', 'Runs out tomorrow', 'bad', 2, 'L'),
    s('Jasmine Rice', 'auto', 'Down to one meal', 'warn', 1, 'kg'),
    s('Eggs', 'auto', 'Runs out in 5 days', 'warn', 12, 'pcs'),
    s('Greek Yogurt', 'auto', 'Runs out this week', 'warn', 4, 'tubs'),
    s('Coffee Beans', 'manual', 'Staple', null, 1, 'bag'),
    s('Kitchen Roll', 'manual', 'Staple', null, 1, 'pack'),
    s('Bananas', 'manual', 'Staple', null, 6, 'pcs'),
  ]
}

// Recipes are built around the detected fridge items so the ingredient cards
// show real stickers. `ingredients` = { name, qty, pantry? } — pantry items
// aren't expected to be in the fridge. Names match DETECTED where possible so
// stickerFor() resolves.
const RECIPES = [
  {
    id: 'r-broccoli-bowl',
    title: 'Charred Broccoli & Egg Bowl',
    image: 'recipe-broccoli-bowl.png',
    blurb:
      'A warm, grain-free bowl that clears the broccoli and eggs before they turn — ready in under half an hour.',
    skill: 'Easy',
    minutes: 25,
    serves: 2,
    kcal: 320,
    ingredients: [
      { name: 'Broccoli', qty: '1 head' },
      { name: 'Eggs', qty: '4' },
      { name: 'Cheddar', qty: '40 g' },
      { name: 'Red Chillies', qty: '2' },
      { name: 'Olive oil', qty: '2 tbsp', pantry: true },
      { name: 'Garlic', qty: '3 cloves', pantry: true },
    ],
    steps: [
      'Cut the broccoli into small florets. Bring a pan of salted water to the boil and blanch for 2 minutes, then drain well.',
      'Heat the olive oil in a wide frying pan over high heat. Add the broccoli in one layer and leave it to char for 3–4 minutes before tossing.',
      'Push the broccoli aside, add the sliced garlic and chillies, and cook for 1 minute until fragrant.',
      'Make four gaps in the pan and crack in the eggs. Cover and cook for 3 minutes until the whites are set.',
      'Grate over the cheddar, season, and serve straight from the pan.',
    ],
  },
  {
    id: 'r-avo-toast',
    title: 'Tomato & Avocado Sourdough',
    image: 'recipe-avo-toast.png',
    heroScale: 1.3,
    blurb:
      'Uses the sourdough on its last good day and the avocado at peak ripeness. Weekend breakfast, ten minutes.',
    skill: 'Easy',
    minutes: 10,
    serves: 2,
    kcal: 410,
    ingredients: [
      { name: 'Sourdough Loaf', qty: '4 slices' },
      { name: 'Avocado', qty: '2' },
      { name: 'Heirloom Tomatoes', qty: '3' },
      { name: 'Eggs', qty: '2' },
      { name: 'Red Chillies', qty: '1' },
      { name: 'Lemon', qty: '1/2', pantry: true },
      { name: 'Olive oil', qty: '1 tbsp', pantry: true },
    ],
    steps: [
      'Toast the sourdough slices until deeply golden.',
      'Mash the avocado with a squeeze of lemon and a pinch of salt. Slice the tomatoes and chilli thinly.',
      'Poach or fry the eggs to your liking.',
      'Spread the avocado over the toast, layer on the tomatoes, and top each with an egg.',
      'Scatter over the chilli, drizzle with olive oil, and finish with flaky salt.',
    ],
  },
  {
    id: 'r-radish-salad',
    title: 'Crunchy Radish & Romaine Salad',
    image: 'recipe-radish-salad.png',
    heroScale: 1.3,
    blurb:
      'A sharp, cold salad that gets the radishes and lettuce used up while they’re still crisp.',
    skill: 'Easy',
    minutes: 15,
    serves: 4,
    kcal: 240,
    ingredients: [
      { name: 'Radishes', qty: '1 bunch' },
      { name: 'Romaine Lettuce', qty: '1 head' },
      { name: 'Avocado', qty: '1' },
      { name: 'Cheddar', qty: '30 g' },
      { name: 'Lemon', qty: '1', pantry: true },
      { name: 'Olive oil', qty: '3 tbsp', pantry: true },
    ],
    steps: [
      'Thinly slice the radishes and tear the romaine into bite-sized pieces. Chill both for 10 minutes.',
      'Whisk the lemon juice with the olive oil, salt and pepper to make a quick dressing.',
      'Dice the avocado and shave the cheddar with a peeler.',
      'Toss the leaves and radishes with most of the dressing, then fold through the avocado.',
      'Top with the shaved cheddar and the last of the dressing.',
    ],
  },
]

// What the vision model "detected" on the baseline scan — one entry per
// sticker in /public/stickers. Confirming the scan turns these into fresh
// inventory items (see CONFIRM_BASELINE in the store).
// columns: sticker, name, category, qty, unit, addedDaysAgo, daysToExpiry, perWeek
const DETECTED = [
  ['tomato.png', 'Heirloom Tomatoes', 'Vegetables', 4, 'pcs', 0, 3, 5],
  ['egg.png', 'Eggs', 'Dairy & Eggs', 6, 'pcs', 0, 18, 5],
  ['cheese.png', 'Cheddar', 'Dairy & Eggs', 1, 'block', 0, 24, 1],
  ['lettuce.png', 'Romaine Lettuce', 'Vegetables', 1, 'head', 0, 5, 1.5],
  ['brocolli.png', 'Broccoli', 'Vegetables', 1, 'head', 0, 6, 1],
  ['avocado.png', 'Avocado', 'Fruit', 2, 'pcs', 0, 4, 2],
  ['radish.png', 'Radishes', 'Vegetables', 1, 'bunch', 0, 9, 1],
  ['chili.png', 'Red Chillies', 'Vegetables', 8, 'pcs', 0, 12, 2],
  ['bread.png', 'Sourdough Loaf', 'Grains & Pasta', 1, 'loaf', 0, 4, 3],
].map(([sticker, name, category, qty, unit, addedDaysAgo, daysToExpiry, perWeek]) => ({
  sticker,
  name,
  category,
  qty,
  unit,
  addedDaysAgo,
  daysToExpiry,
  perWeek,
}))

// Build fresh inventory items from the detected list (fresh ISO ids each call).
function detectedInventory() {
  return DETECTED.map((d) => ({
    id: id('itm'),
    name: d.name,
    category: d.category,
    section: 'fresh',
    qty: d.qty,
    unit: d.unit,
    addedDaysAgo: d.addedDaysAgo,
    shelfLifeDays: d.addedDaysAgo + d.daysToExpiry,
    expiryDate: inDays(d.daysToExpiry),
    perWeek: d.perWeek,
  }))
}

// Best-effort sticker (in /public/stickers) for an inventory item by name.
// Detected items map exactly; seed items fall back to a rough visual match.
const STICKER_ALIASES = {
  'Baby Spinach': 'lettuce.png',
  'Spring Onions': 'lettuce.png',
  'Red Bell Pepper': 'chili.png',
  Butter: 'cheese.png',
  Carrots: 'radish.png',
}
export function stickerFor(name) {
  const hit = DETECTED.find((d) => d.name === name)
  return hit?.sticker || STICKER_ALIASES[name] || null
}

// The "added automatically" shopping rows, derived from the detected fridge
// items that will run out soonest — so the shopping list stays in step with
// what My Fridge shows.
export function detectedShopping() {
  return DETECTED.map((d) => {
    const emptyDays = d.perWeek > 0 ? (d.qty / d.perWeek) * 7 : Infinity
    return { d, days: Math.min(d.daysToExpiry, emptyDays) }
  })
    .sort((a, b) => a.days - b.days)
    .slice(0, 4)
    .map(({ d, days }) => ({
      id: id('shp'),
      name: d.name,
      source: 'auto',
      reason:
        days < 1
          ? 'Runs out today'
          : days < 2
            ? 'Runs out tomorrow'
            : days < 7
              ? `Runs out in ${Math.round(days)} days`
              : 'Running low',
      urgency: days <= 2 ? 'bad' : 'warn',
      qty: Math.max(1, Math.round(d.qty)),
      unit: d.unit,
      status: 'pending',
    }))
}

export function seedState() {
  return {
    version: 5,
    onboarded: false,
    autonomy: 'suggest', // 'suggest' | 'auto'
    cart: 'redmart',
    inventory: makeInventory(),
    shopping: makeShopping(),
    recipeFeedback: [],
    lastSent: null, // { cart, count, at }
  }
}

export { RECIPES, DETECTED, detectedInventory, id as newId }

export const CATEGORY_ORDER = [
  'Vegetables', 'Fruit', 'Dairy & Eggs', 'Meat & Fish', 'Leftovers',
  'Drinks', 'Grains & Pasta', 'Condiments', 'Snacks',
]

export const CARTS = [
  { id: 'instacart', label: 'Instacart', note: 'US & Canada only', disabled: true },
  { id: 'redmart', label: 'RedMart', note: 'Singapore', disabled: false },
  { id: 'amazon', label: 'Amazon Fresh', note: 'Prime', disabled: false },
  { id: 'mock', label: 'Mock cart', note: 'Demo', disabled: false },
]

export const EXPIRY_PRESETS = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
]
