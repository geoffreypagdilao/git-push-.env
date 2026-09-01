// Thin fetch wrapper over the FastAPI backend (backend/app/routes/*.py).
// No mock data lives here — every function is a real HTTP call.

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8010'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${options.method || 'GET'} ${path} failed: ${res.status} ${body}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ---- inventory ------------------------------------------------------------

export function fetchInventory() {
  return request('/inventory').then((r) => r.items)
}

export function fetchItemLog(itemId) {
  return request(`/inventory/${itemId}/log`).then((r) => r.log)
}

export function createItem(item) {
  return request('/inventory', { method: 'POST', body: JSON.stringify(item) })
}

export function updateItem(id, patch) {
  return request(`/inventory/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export function deleteItem(id) {
  return request(`/inventory/${id}`, { method: 'DELETE' })
}

// ---- shopping list ----------------------------------------------------------

export function fetchShoppingList() {
  return request('/shopping-list').then((r) => r.shopping_list)
}

export function stageShoppingItem({ itemId, itemName, storeLink }) {
  return request('/shopping-list', {
    method: 'POST',
    body: JSON.stringify({ item_id: itemId ?? null, item_name: itemName, store_link: storeLink ?? null }),
  })
}

export function updateShoppingStatus(entryId, status) {
  return request(`/shopping-list/${entryId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

export function removeShoppingEntry(entryId) {
  return request(`/shopping-list/${entryId}`, { method: 'DELETE' })
}

// ---- preferences ------------------------------------------------------------

export function fetchPreferences() {
  return request('/preferences')
}

export function updatePreferences(patch) {
  return request('/preferences', { method: 'PUT', body: JSON.stringify(patch) })
}

// ---- recipe feedback --------------------------------------------------------

export function addRecipeFeedback({ recipeTitle, liked, ingredientsUsed }) {
  return request('/recipe-feedback', {
    method: 'POST',
    body: JSON.stringify({ recipe_title: recipeTitle, liked, ingredients_used: ingredientsUsed ?? [] }),
  })
}

// ---- recipes ------------------------------------------------------------

export function fetchRecipes(count = 4, mode = 'pantry') {
  return request(`/recipes?count=${count}&mode=${mode}`)
}

export function generateRecipeImage({ title, blurb, ingredients }) {
  return request('/recipes/image', {
    method: 'POST',
    body: JSON.stringify({ title, blurb, ingredients }),
  })
}

// ---- agent --------------------------------------------------------------

export function runAgentForItem(itemName, mode, { force = false } = {}) {
  const params = new URLSearchParams({ mode, force: String(force) })
  return request(`/agent/run/${encodeURIComponent(itemName)}?${params}`, { method: 'POST' })
}

export function runAgentSweep(mode) {
  const params = new URLSearchParams({ mode })
  return request(`/agent/sweep?${params}`, { method: 'POST' })
}

export function chatWithAgent(messages) {
  return request('/agent/chat', {
    method: 'POST',
    body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })) }),
  })
}
