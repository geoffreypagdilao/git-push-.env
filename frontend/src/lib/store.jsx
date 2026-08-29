import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { seedState, newId, detectedInventory } from './mockData'

const KEY = 'yoink.state'
const DAY = 86_400_000

const StoreContext = createContext(null)

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seedState()
    const parsed = JSON.parse(raw)
    const fresh = seedState()
    if (parsed.version !== fresh.version) return fresh
    return parsed
  } catch {
    return seedState()
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'COMPLETE_ONBOARDING':
      return { ...state, onboarded: true }

    // Baseline scan confirmed: the detected ingredients become the fresh
    // inventory; seeded pantry staples stay.
    case 'CONFIRM_BASELINE':
      return {
        ...state,
        onboarded: true,
        inventory: [...detectedInventory(), ...state.inventory.filter((i) => i.section === 'pantry')],
      }

    case 'REMOVE_ITEM':
      return { ...state, inventory: state.inventory.filter((i) => i.id !== action.id) }

    case 'ADD_ITEM': {
      const name = action.name.trim()
      if (!name) return state
      const item = {
        id: newId('itm'),
        name,
        category: action.category || 'Vegetables',
        section: action.section || 'fresh',
        qty: 1,
        unit: 'pcs',
        addedDaysAgo: 0,
        shelfLifeDays: null,
        expiryDate: null,
        perWeek: 1,
      }
      return { ...state, inventory: [item, ...state.inventory] }
    }

    case 'SET_QTY':
      return {
        ...state,
        inventory: state.inventory.map((i) =>
          i.id === action.id ? { ...i, qty: Math.max(0, action.qty) } : i,
        ),
      }

    case 'TAG_EXPIRY':
      return {
        ...state,
        inventory: state.inventory.map((i) =>
          i.id === action.id
            ? {
                ...i,
                shelfLifeDays: action.days,
                expiryDate: new Date(Date.now() + action.days * DAY).toISOString().slice(0, 10),
              }
            : i,
        ),
      }

    case 'DISMISS_SHOPPING':
      return { ...state, shopping: state.shopping.filter((s) => s.id !== action.id) }

    case 'SET_SHOPPING_QTY':
      return {
        ...state,
        shopping: state.shopping.map((s) =>
          s.id === action.id ? { ...s, qty: Math.max(1, action.qty) } : s,
        ),
      }

    case 'ADD_STAPLE': {
      const name = action.name.trim()
      if (!name) return state
      return {
        ...state,
        shopping: [
          ...state.shopping,
          { id: newId('shp'), name, source: 'manual', reason: 'Staple', qty: 1, unit: 'pcs', status: 'pending' },
        ],
      }
    }

    case 'SET_CART':
      return { ...state, cart: action.cart }

    case 'SET_AUTONOMY':
      return { ...state, autonomy: action.mode }

    case 'SEND_CART': {
      const count = state.shopping.filter((s) => s.status === 'pending').length
      return {
        ...state,
        shopping: state.shopping.map((s) =>
          s.status === 'pending' ? { ...s, status: 'in_cart' } : s,
        ),
        lastSent: { cart: state.cart, count, at: Date.now() },
      }
    }

    case 'RATE_RECIPE': {
      const entry = {
        id: newId('fb'),
        recipe_title: action.title,
        liked: action.liked,
        ingredients_used: action.ingredientsUsed || [],
        at: Date.now(),
      }
      return {
        ...state,
        recipeFeedback: [entry, ...state.recipeFeedback.filter((f) => f.recipe_title !== action.title)],
      }
    }

    case 'RESET_DEMO':
      return seedState()

    default:
      return state
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* private mode / quota — the demo still works in-memory */
    }
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}
