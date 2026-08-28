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

// Recipes reference inventory by name. `useDaysBadge` drives the expiry-priority
// badge shown on the recipe screen.
const RECIPES = [
  {
    id: 'r-rigatoni',
    title: 'Tomato Rigatoni',
    blurb: 'A fast weeknight bowl that clears the tomatoes before they turn.',
    minutes: 25,
    serves: 2,
    uses: ['Heirloom Tomatoes', 'Rigatoni', 'Olive Oil', 'Spring Onions'],
    need: ['Garlic', 'Parmesan'],
    addOn: {
      item: 'Baby Spinach',
      copy: 'Wilt in a handful of spinach — you have a bag going soft in 2 days.',
    },
    steps: [
      'Boil the rigatoni in well-salted water until al dente, then save a mug of the pasta water.',
      'While it cooks, halve the tomatoes and slice the spring onions.',
      'Warm olive oil in a wide pan, add garlic and tomatoes, and cook down for 8 minutes until jammy.',
      'Add the drained pasta and a splash of pasta water, tossing until the sauce coats every piece.',
      'Off the heat, fold through spinach and grated parmesan. Season and serve.',
    ],
  },
  {
    id: 'r-salmon',
    title: 'Salmon & Pepper Traybake',
    blurb: 'One tray, thirty minutes, and the salmon gets used on its last good day.',
    minutes: 30,
    serves: 2,
    uses: ['Salmon Fillet', 'Red Bell Pepper', 'Carrots', 'Olive Oil'],
    need: ['Lemon'],
    addOn: {
      item: 'Baby Spinach',
      copy: 'Stir raw spinach through the warm vegetables so it just wilts.',
    },
    steps: [
      'Heat the oven to 210°C. Cut peppers and carrots into thin strips.',
      'Toss the vegetables with olive oil and salt on a tray, roast for 12 minutes.',
      'Nestle the salmon fillets in, squeeze over lemon, and roast 12 minutes more.',
      'Pile onto plates and finish with the spinach and pan juices.',
    ],
  },
  {
    id: 'r-curry',
    title: 'Chicken & Chickpea Curry',
    blurb: 'Uses the chicken thighs on time and leans on pantry cans for the rest.',
    minutes: 35,
    serves: 3,
    uses: ['Chicken Thighs', 'Canned Chickpeas', 'Carrots', 'Soy Sauce', 'Jasmine Rice'],
    need: ['Coconut Milk', 'Curry Paste'],
    addOn: {
      item: 'Baby Spinach',
      copy: 'Drop spinach in for the last two minutes so it keeps its colour.',
    },
    steps: [
      'Start the rice. Dice the chicken and chop the carrots.',
      'Brown the chicken in a deep pan, then stir in the curry paste for a minute.',
      'Add coconut milk, chickpeas, carrots and a splash of soy. Simmer 15 minutes.',
      'Stir spinach through at the end and serve over the rice.',
    ],
  },
]

// Flat list the vision model "detected" on the baseline scan, in the order a
// diff would surface them. `needsDate` items land in inventory without an expiry.
const DETECTED = [
  'Salmon Fillet', 'Chicken Thighs', 'Heirloom Tomatoes', 'Baby Spinach',
  'Milk', 'Eggs', 'Greek Yogurt', 'Cheddar', 'Butter', 'Carrots',
  'Red Bell Pepper', 'Spring Onions', 'Orange Juice', 'Leftover Pad Thai',
]

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

export { RECIPES, DETECTED, id as newId }

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
