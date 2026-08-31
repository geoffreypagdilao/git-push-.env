// Static app config. Inventory, shopping list, and recipes all come from the
// backend now (see lib/api.js) — nothing business-related is seeded here.

// Real category codes from shelf_life_lookup (supabase/migrations/20260823150120_initial_schema.sql).
// Anything the backend returns outside this list still displays fine —
// groupByCategory() falls back to the end of the sort order.
export const CATEGORY_ORDER = ['leafy_greens', 'root_vegetable', 'vegetable_other', 'fruit', 'uncategorized']

export const CATEGORY_LABELS = {
  leafy_greens: 'Leafy Greens',
  root_vegetable: 'Root Vegetables',
  vegetable_other: 'Vegetables',
  fruit: 'Fruit',
  uncategorized: 'Uncategorized',
}

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category
}

// Best-effort sticker (in /public/stickers) for an ingredient/item name.
// Matched case-insensitively since real DB item names arrive lowercase
// (e.g. "broccoli") while recipe ingredient names are Title Case.
const STICKER_BY_NAME = {
  tomato: 'tomato.png',
  'heirloom tomatoes': 'tomato.png',
  egg: 'egg.png',
  eggs: 'egg.png',
  cheese: 'cheese.png',
  cheddar: 'cheese.png',
  lettuce: 'lettuce.png',
  'romaine lettuce': 'lettuce.png',
  broccoli: 'brocolli.png',
  avocado: 'avocado.png',
  radish: 'radish.png',
  radishes: 'radish.png',
  carrot: 'carrot.png',
  carrots: 'carrot.png',
  chili: 'chili.png',
  'red chillies': 'chili.png',
  bread: 'bread.png',
  'sourdough loaf': 'bread.png',
  spinach: 'spinach.png',
  'baby spinach': 'spinach.png',
  potato: 'potato.png',
  potatoes: 'potato.png',
  zucchini: 'zucchini.png',
  garlic: 'garlic.png',
  // filename has a literal space — pre-encoded so every call site's
  // `${BASE_URL}stickers/${sticker}` build stays a one-liner.
  'olive oil': 'olive%20oil.png',
}

export function stickerFor(name) {
  if (!name) return null
  return STICKER_BY_NAME[name.trim().toLowerCase()] || null
}

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
