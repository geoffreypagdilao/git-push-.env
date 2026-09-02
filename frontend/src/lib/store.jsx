import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import * as api from './api'
import { adaptItem } from './inventory'

// All inventory/shopping data comes from the backend (see lib/api.js) — this
// store just holds it in React state and exposes actions that call the API
// then patch local state from the real response. Only a few UI-only settings
// (onboarding-seen, autonomy mode, chosen cart) persist to localStorage,
// since the DB has no columns for them yet (see forxp.md §10.2).

const SETTINGS_KEY = 'yoink.settings'
// Recipes are generated fresh each time (LLM or MealDB), not stored server
// side with a stable id — saving is purely a client-side bookmark for now,
// same "no DB column yet" situation as the settings above.
const SAVED_RECIPES_KEY = 'yoink.savedRecipes'
// A memory log of recipes actually cooked (separate from "saved" — this is
// "I made this", not "I might make this"). Client-side only, same reason
// as above; the memory photo gets stored inline as a data URL alongside it.
const COOKED_RECIPES_KEY = 'yoink.cookedRecipes'

const StoreContext = createContext(null)

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) throw new Error('no settings yet')
    return { onboarded: false, autonomy: 'suggest', cart: 'redmart', ...JSON.parse(raw) }
  } catch {
    return { onboarded: false, autonomy: 'suggest', cart: 'redmart' }
  }
}

function loadSavedRecipes() {
  try {
    const raw = localStorage.getItem(SAVED_RECIPES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function loadCookedRecipes() {
  try {
    const raw = localStorage.getItem(COOKED_RECIPES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function initState() {
  return {
    ...loadSettings(),
    inventory: [],
    shopping: [],
    lastSent: null,
    inventoryLoaded: false,
    shoppingLoaded: false,
    savedRecipes: loadSavedRecipes(),
    cookedRecipes: loadCookedRecipes(),
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'COMPLETE_ONBOARDING':
      return { ...state, onboarded: true }

    case 'SET_AUTONOMY':
      return { ...state, autonomy: action.mode }

    case 'SET_CART':
      return { ...state, cart: action.cart }

    case 'SET_INVENTORY':
      return { ...state, inventory: action.items.map(adaptItem), inventoryLoaded: true }

    case 'PATCH_INVENTORY_ITEM':
      return {
        ...state,
        inventory: state.inventory.map((i) => (i.id === action.id ? adaptItem(action.row) : i)),
      }

    case 'REMOVE_INVENTORY_ITEM':
      return { ...state, inventory: state.inventory.filter((i) => i.id !== action.id) }

    case 'SET_SHOPPING':
      return { ...state, shopping: action.entries, shoppingLoaded: true }

    case 'UPSERT_SHOPPING_ENTRY': {
      const exists = state.shopping.some((s) => s.id === action.entry.id)
      return {
        ...state,
        shopping: exists
          ? state.shopping.map((s) => (s.id === action.entry.id ? action.entry : s))
          : [action.entry, ...state.shopping],
      }
    }

    case 'REMOVE_SHOPPING_ENTRY':
      return { ...state, shopping: state.shopping.filter((s) => s.id !== action.id) }

    case 'SET_LAST_SENT':
      return { ...state, lastSent: action.lastSent }

    case 'SAVE_RECIPE': {
      if (state.savedRecipes.some((r) => r.title === action.recipe.title)) return state
      return { ...state, savedRecipes: [{ ...action.recipe, savedAt: Date.now() }, ...state.savedRecipes] }
    }

    case 'UNSAVE_RECIPE':
      return { ...state, savedRecipes: state.savedRecipes.filter((r) => r.title !== action.title) }

    case 'LOG_COOKED':
      // Not deduped by title like SAVE_RECIPE — this is a memory log of
      // each time you actually cooked something, not a single bookmark, so
      // cooking the same recipe twice makes two separate entries.
      return {
        ...state,
        cookedRecipes: [{ ...action.recipe, id: action.id, cookedAt: Date.now(), memoryPhoto: null }, ...state.cookedRecipes],
      }

    case 'SET_COOKED_MEMORY_PHOTO':
      return {
        ...state,
        cookedRecipes: state.cookedRecipes.map((r) => (r.id === action.id ? { ...r, memoryPhoto: action.dataUrl } : r)),
      }

    default:
      return state
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState)

  useEffect(() => {
    const { onboarded, autonomy, cart } = state
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ onboarded, autonomy, cart }))
  }, [state.onboarded, state.autonomy, state.cart])

  useEffect(() => {
    localStorage.setItem(SAVED_RECIPES_KEY, JSON.stringify(state.savedRecipes))
  }, [state.savedRecipes])

  useEffect(() => {
    localStorage.setItem(COOKED_RECIPES_KEY, JSON.stringify(state.cookedRecipes))
  }, [state.cookedRecipes])

  const refreshInventory = useCallback(async () => {
    const items = await api.fetchInventory()
    dispatch({ type: 'SET_INVENTORY', items })
    return items
  }, [])

  const refreshShopping = useCallback(async () => {
    const entries = await api.fetchShoppingList()
    dispatch({ type: 'SET_SHOPPING', entries })
    return entries
  }, [])

  useEffect(() => {
    refreshInventory().catch((err) => console.error('Failed to load inventory:', err))
    refreshShopping().catch((err) => console.error('Failed to load shopping list:', err))
  }, [refreshInventory, refreshShopping])

  const actions = useMemo(
    () => ({
      removeItem: async (id) => {
        await api.deleteItem(id)
        dispatch({ type: 'REMOVE_INVENTORY_ITEM', id })
      },

      setQty: async (id, qty) => {
        const row = await api.updateItem(id, { quantity: Math.max(0, qty) })
        dispatch({ type: 'PATCH_INVENTORY_ITEM', id, row })
      },

      tagExpiry: async (id, days) => {
        const expiryDate = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
        const row = await api.updateItem(id, { expiry_date: expiryDate })
        dispatch({ type: 'PATCH_INVENTORY_ITEM', id, row })
      },

      addStaple: async (name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        const entry = await api.stageShoppingItem({ itemName: trimmed })
        dispatch({ type: 'UPSERT_SHOPPING_ENTRY', entry })
      },

      dismissShopping: async (id) => {
        await api.removeShoppingEntry(id)
        dispatch({ type: 'REMOVE_SHOPPING_ENTRY', id })
      },

      setShoppingStatus: async (id, status) => {
        const entry = await api.updateShoppingStatus(id, status)
        dispatch({ type: 'UPSERT_SHOPPING_ENTRY', entry })
      },

      sendCart: async () => {
        const pending = state.shopping.filter((s) => s.status === 'pending')
        const updated = await Promise.all(pending.map((s) => api.updateShoppingStatus(s.id, 'in_cart')))
        updated.forEach((entry) => dispatch({ type: 'UPSERT_SHOPPING_ENTRY', entry }))
        dispatch({ type: 'SET_LAST_SENT', lastSent: { cart: state.cart, count: pending.length, at: Date.now() } })
      },

      runAgentSweep: async (mode) => {
        const result = await api.runAgentSweep(mode)
        await Promise.all([refreshInventory(), refreshShopping()])
        return result
      },

      runAgentForItem: async (name, mode) => {
        const result = await api.runAgentForItem(name, mode)
        await Promise.all([refreshInventory(), refreshShopping()])
        return result
      },

      toggleSaveRecipe: (recipe) => {
        const isSaved = state.savedRecipes.some((r) => r.title === recipe.title)
        if (isSaved) dispatch({ type: 'UNSAVE_RECIPE', title: recipe.title })
        else dispatch({ type: 'SAVE_RECIPE', recipe })
      },

      logCooked: (recipe) => {
        const id = crypto.randomUUID()
        dispatch({ type: 'LOG_COOKED', recipe, id })
        return id
      },

      setCookedMemoryPhoto: (id, dataUrl) => {
        dispatch({ type: 'SET_COOKED_MEMORY_PHOTO', id, dataUrl })
      },
    }),
    [state.shopping, state.cart, state.savedRecipes, state.cookedRecipes, refreshInventory, refreshShopping],
  )

  const value = useMemo(
    () => ({ state, dispatch, refreshInventory, refreshShopping, ...actions }),
    [state, refreshInventory, refreshShopping, actions],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}
