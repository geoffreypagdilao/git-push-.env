// Pure helpers for the consumption-rate + expiry logic. No React here.

import { CATEGORY_ORDER } from './mockData'

const DAY = 86_400_000

// Adapt a raw `items` row from the backend (id, name, category, quantity,
// unit, expiry_date, first_detected_at, ...) into the shape the UI works
// with. perWeek starts null — the backend doesn't return a learned rate on
// the list endpoint, so it's filled in lazily (see estimateConsumption)
// only when an item's detail sheet is opened.
export function adaptItem(row) {
  const addedDaysAgo = row.first_detected_at
    ? Math.max(0, Math.floor((Date.now() - new Date(row.first_detected_at).getTime()) / DAY))
    : 0
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    qty: Number(row.quantity) || 0,
    unit: row.unit,
    expiryDate: row.expiry_date || null,
    addedDaysAgo,
    perWeek: null,
  }
}

// Same "average gap between removals" logic as agent/consumption.py's
// get_consumption_rate, run client-side against /inventory/{id}/log so the
// item-detail sheet can show a learned pace without a dedicated endpoint.
const MIN_DATA_POINTS = 2

export function estimateConsumption(log) {
  const removals = (log || [])
    .filter((e) => e.event_type === 'removed')
    .map((e) => new Date(e.detected_at).getTime())
    .sort((a, b) => a - b)
  if (removals.length < MIN_DATA_POINTS) return null
  const gaps = []
  for (let i = 1; i < removals.length; i++) gaps.push((removals[i] - removals[i - 1]) / DAY)
  const rateDays = gaps.reduce((a, b) => a + b, 0) / gaps.length
  return { rateDays, perWeek: rateDays > 0 ? 7 / rateDays : null }
}

// Group inventory into [category, items[]] pairs in a stable display order.
export function groupByCategory(items) {
  const groups = new Map()
  for (const item of items) {
    if (!groups.has(item.category)) groups.set(item.category, [])
    groups.get(item.category).push(item)
  }
  return [...groups.entries()].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]),
  )
}

export function daysUntilExpiry(item) {
  if (!item.expiryDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(item.expiryDate + 'T00:00:00')
  return Math.round((exp.getTime() - today.getTime()) / DAY)
}

// How long the current quantity lasts at the learned consumption rate.
export function daysUntilEmpty(item) {
  if (!item.perWeek || item.perWeek <= 0) return Infinity
  return (item.qty / item.perWeek) * 7
}

// The date yoink! predicts you'll hit zero — drives proactive reminders.
export function predictedRunOut(item) {
  const d = daysUntilEmpty(item)
  if (!isFinite(d)) return null
  return new Date(Date.now() + d * DAY)
}

// 'bad'  — out now, or already past its date
// 'warn' — running low, or inside the "use soon" freshness window (<= 3 days)
// 'good' — nothing to do
export function statusOf(item) {
  const exp = daysUntilExpiry(item)
  const empty = daysUntilEmpty(item)
  if (item.qty <= 0 || empty < 1 || (exp != null && exp <= 0)) return 'bad'
  if (empty <= 3 || (exp != null && exp <= 3)) return 'warn'
  return 'good'
}

export function isUseSoon(item) {
  const exp = daysUntilExpiry(item)
  return (exp != null && exp <= 3) || daysUntilEmpty(item) <= 2
}

// Fraction of a "full" stock remaining, for the depletion meter (0–1).
// Full is defined as ~2 weeks of consumption, clamped.
export function stockFraction(item) {
  const weeks = item.perWeek > 0 ? item.qty / item.perWeek : 2
  return Math.max(0.04, Math.min(1, weeks / 2))
}

export function freshnessLabel(item) {
  const exp = daysUntilExpiry(item)
  if (exp == null) return null
  if (exp < 0) return 'past its date'
  if (exp === 0) return 'use today'
  if (exp === 1) return 'use tomorrow'
  if (exp <= 10) return `use within ${exp} days`
  // far-off dates aren't useful on a row — let the stock label speak instead
  return null
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function stockLabel(item) {
  const d = daysUntilEmpty(item)
  if (!isFinite(d)) return 'well stocked'
  if (d < 1) return 'out today'
  if (d < 2) return 'about a day left'
  if (d < 7) return `about ${Math.round(d)} days left`
  if (d < 14) return 'about a week left'
  return 'well stocked'
}

// Short reason line for why yoink! would act on this item now.
export function reminderCopy(item) {
  const exp = daysUntilExpiry(item)
  const empty = daysUntilEmpty(item)
  if (exp != null && exp <= 3 && exp <= empty) {
    if (exp < 0) return 'Past its date — cook it or bin it'
    if (exp === 0) return 'Best eaten today'
    if (exp === 1) return 'Eat it tomorrow'
    return `Good for ${exp} more days`
  }
  if (empty <= 3) {
    const runOut = predictedRunOut(item)
    const when = runOut?.toLocaleDateString(undefined, { weekday: 'long' })
    return empty < 1 ? 'You’re out' : `Runs out ${when || 'soon'}`
  }
  return 'Stocked'
}

export function formatQty(item) {
  const q = Number.isInteger(item.qty) ? item.qty : Number(item.qty.toFixed(2))
  return `${q} ${item.unit}`
}

export function relativeAdded(days) {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  const w = Math.round(days / 7)
  return `${w} week${w === 1 ? '' : 's'} ago`
}
