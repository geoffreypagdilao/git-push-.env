import { useState } from 'react'
import './App.css'

const vars = {
  '--bg-page': '#FFFFFF',
  '--bg-card': '#F6F6F6',
  '--bg-muted': '#F6F6F6',
  '--bg-active-pill': '#171717',
  '--text-primary': '#171717',
  '--text-secondary': '#737373',
  '--text-tertiary': '#B4B4B8',
  '--border-subtle': '#E8E8E8',
}

const pool = [
  { emoji: '🥛', label: 'Milk' },
  { emoji: '🧄', label: 'Garlic' },
  { emoji: '🍋', label: 'Lemon' },
  { emoji: '🥒', label: 'Cucumber' },
]

function pillStyle(active) {
  return active
    ? { background: 'var(--bg-active-pill)', color: '#fff' }
    : { background: 'transparent', color: 'var(--text-secondary)' }
}

// ---- Watch tab: idle scan state + detected ingredients ----
function WatchTab({ scanState, onScan, items, onRemove, onAdd }) {
  if (scanState !== 'done') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span
            className="lo-pulse-ring"
            style={{ position: 'absolute', width: 120, height: 120, borderRadius: 999, border: '1px solid var(--text-tertiary)' }}
          />
          <span
            className="lo-pulse-ring"
            style={{
              position: 'absolute',
              width: 120,
              height: 120,
              borderRadius: 999,
              border: '1px solid var(--text-tertiary)',
              animationDelay: '1.1s',
            }}
          />
          <div
            style={{
              width: 78,
              height: 78,
              borderRadius: 22,
              background: 'var(--bg-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
            }}
          >
            🧊
          </div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Watching your fridge</div>
    
        </div>
        {scanState === 'scanning' ? (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            Door closed · analyzing
            <span style={{ display: 'flex', gap: 3 }}>
              <span className="lo-dot" style={{ width: 4, height: 4, borderRadius: 999, background: 'var(--text-tertiary)' }} />
              <span
                className="lo-dot"
                style={{ width: 4, height: 4, borderRadius: 999, background: 'var(--text-tertiary)', animationDelay: '.2s' }}
              />
              <span
                className="lo-dot"
                style={{ width: 4, height: 4, borderRadius: 999, background: 'var(--text-tertiary)', animationDelay: '.4s' }}
              />
            </span>
          </div>
        ) : (
          <button
            onClick={onScan}
            style={{
              background: '#000',
              color: '#fff',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              padding: '12px 20px',
              borderRadius: 999,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Simulate door close
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={onScan}
        aria-label="Rescan"
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          background: 'var(--bg-card)',
          boxShadow: '0 2px 8px rgba(0,0,0,.06)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M16.5 10A6.5 6.5 0 1 1 14 5" stroke="#171717" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M16.5 4V9H11.5" stroke="#171717" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 20,
          marginTop: 32,
          maxWidth: 320,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {items.map((item, i) => (
          <div
            key={item.id}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              transform: `translateY(${[0, 14, -6, 10][i % 4]}px)`,
            }}
          >
            <span
              className="lo-emoji"
              style={{ fontSize: 56, display: 'inline-block', transform: `rotate(${[-8, 5, -4, 6][i % 4]}deg)` }}
            >
              {item.emoji}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}>{item.label}</span>
          </div>
        ))}
        <button
          onClick={onAdd}
          aria-label="Add ingredient"
          style={{
            width: 44,
            height: 44,
            alignSelf: 'center',
            borderRadius: 999,
            background: 'var(--bg-card)',
            boxShadow: '0 2px 8px rgba(0,0,0,.06)',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 48 }}>
        <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Let's find out what's</div>
        <div style={{ fontSize: 28, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-secondary)' }}>on your plate</div>
      </div>

      {/* reserves scroll space so the fixed bar below never covers content */}
      <div style={{ height: 262 }} />

      <div
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 720,
          padding: '0 clamp(16px, 4vw, 32px) calc(16px + env(safe-area-inset-bottom))',
          boxSizing: 'border-box',
          zIndex: 4,
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['15 min recipes', 'Easy breakfast', 'Tomato Soup'].map((label) => (
            <span
              key={label}
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 500,
                padding: '8px 16px',
                borderRadius: 999,
                boxShadow: '0 1px 4px rgba(0,0,0,.06)',
              }}
            >
              {label}
            </span>
          ))}
        </div>

        <div
          style={{
            marginTop: 12,
            background: 'var(--bg-card)',
            borderRadius: 28,
            padding: 16,
            minHeight: 130,
            boxShadow: '0 8px 30px -10px rgba(0,0,0,.1)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          <span style={{ fontSize: 15, color: 'var(--text-tertiary)' }}>Describe the dish...</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                background: 'var(--bg-muted)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                padding: '8px 14px',
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 13 13">
                <path d="M6.5 10V2M6.5 2L3 5.5M6.5 2L10 5.5" stroke="#171717" strokeWidth="1.4" fill="none" />
                <path d="M2 11H11" stroke="#171717" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Upload
            </span>
            <button
              aria-label="Send"
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                background: '#000',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 13 13">
                <path d="M6.5 11V2M6.5 2L2 6.5M6.5 2L11 6.5" stroke="#fff" strokeWidth="1.6" fill="none" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const shoppingList = [
  { emoji: '🥚', name: 'Eggs', note: 'Last one used · lasts ~6 days', time: '2 hrs ago', suggestion: false, low: true, expiring: false },
  { emoji: '🥛', name: 'Milk', note: '1 serving left · lasts ~4 days', time: '1 day ago', suggestion: false, low: true, expiring: false },
  { emoji: '🧄🧅', name: 'Garlic & Onion', note: 'Restock suggested · lasts ~9 days', time: '3d ago', suggestion: true, low: false, expiring: true },
]

// ---- List tab ----
function ListTab({ tab3, setTab3, showStoreSuggestion }) {
  const rows = shoppingList.filter((row) => {
    if (tab3 === 'low') return row.low
    if (tab3 === 'exp') return row.expiring
    return true
  })

  return (
    <div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Your shopping list.</div>
        <div style={{ fontSize: 28, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-secondary)' }}>Learns your pace</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 28, alignItems: 'center' }}>
        <span onClick={() => setTab3('all')} style={{ ...pillStyle(tab3 === 'all'), fontSize: 13, fontWeight: 500, padding: '8px 16px', borderRadius: 999, cursor: 'pointer' }}>
          All
        </span>
        <span
          onClick={() => setTab3('low')}
          style={{ color: tab3 === 'low' ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13, fontWeight: 500, padding: '8px 6px', cursor: 'pointer' }}
        >
          Low stock
        </span>
        <span
          onClick={() => setTab3('exp')}
          style={{ color: tab3 === 'exp' ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13, fontWeight: 500, padding: '8px 6px', cursor: 'pointer' }}
        >
          Expiring
        </span>
      </div>

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {rows.map((row) => (
          <div
            key={row.name}
            style={{
              background: 'var(--bg-card)',
              borderRadius: 22,
              boxShadow: '0 4px 20px -4px rgba(0,0,0,.06)',
              border: '1px solid var(--border-subtle)',
              padding: 22,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div style={{ fontSize: 28, flex: 'none' }}>{row.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{row.note}</div>
              {row.suggestion && showStoreSuggestion && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>📍 Trader Joe's · 0.4mi</div>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'right', flex: 'none' }}>{row.time}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const expiryList = [
  { id: 'e1', emoji: '🧀', name: 'Cheese', category: 'Dairy Product', time: '4h', urgent: true },
  { id: 'e2', emoji: '🥦', name: 'Broccoli', category: 'Vegetable', time: '2d', urgent: true },
  { id: 'e3', emoji: '🍇', name: 'Grape', category: 'Fruit', time: '6d', urgent: false },
  { id: 'e4', emoji: '🌽', name: 'Corn', category: 'Grain and Cereal', time: '1w', urgent: false },
]

// ---- Expiry Countdown tab ----
function ExpiryTab({ onAdd }) {
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Expiry Countdown</div>

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {expiryList.map((item) => (
          <div
            key={item.id}
            style={{
              background: 'var(--bg-card)',
              borderRadius: 22,
              padding: 22,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div style={{ fontSize: 28, flex: 'none' }}>{item.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{item.category}</div>
            </div>
            {item.urgent && (
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', flex: 'none' }}>!</span>
            )}
            <span
              style={{
                background: 'var(--bg-muted)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 600,
                padding: '8px 14px',
                borderRadius: 999,
                flex: 'none',
              }}
            >
              {item.time}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={onAdd}
        aria-label="Add item"
        style={{
          position: 'fixed',
          bottom: 'calc(24px + env(safe-area-inset-bottom))',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 56,
          height: 56,
          borderRadius: 999,
          background: '#000',
          border: 'none',
          color: '#fff',
          fontSize: 24,
          fontWeight: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 12px 24px -8px rgba(0,0,0,.35)',
          cursor: 'pointer',
          zIndex: 5,
        }}
      >
        +
      </button>
    </div>
  )
}

const extrasPool = [
  { emoji: '🥛', label: 'Milk' },
  { emoji: '🧄', label: 'Garlic' },
  { emoji: '🍋', label: 'Lemon' },
  { emoji: '🫒', label: 'Olive' },
]

const quickPrompts = ['15 min recipes', 'Easy breakfast', 'Use up spinach']

const recipeBook = [
  {
    id: 'frittata',
    match: ['eggs', 'cheese'],
    title: 'Veggie Frittata',
    emoji: '🍳',
    blurb: 'Uses the eggs and spinach before they expire',
    ingredients: [
      { emoji: '🥚', label: 'Eggs', qty: '4' },
      { emoji: '🥬', label: 'Spinach', qty: '1 cup' },
      { emoji: '🧀', label: 'Cheese', qty: '40g' },
      { emoji: '🥛', label: 'Milk', qty: '2 tbsp' },
    ],
    step: { time: '8m', title: 'Whisk the eggs', body: 'Crack the eggs into a bowl, add a splash of milk and a pinch of salt, then whisk until combined and slightly frothy.' },
  },
  {
    id: 'salad',
    match: ['tomato', 'cucumber', 'olive'],
    title: 'Garden Salad',
    emoji: '🥗',
    blurb: 'A crisp, no-cook way to use up what’s about to turn',
    ingredients: [
      { emoji: '🍅', label: 'Tomato', qty: '2' },
      { emoji: '🥒', label: 'Cucumber', qty: '1' },
      { emoji: '🫒', label: 'Olive', qty: 'handful' },
      { emoji: '🧀', label: 'Cheese', qty: '30g' },
    ],
    step: { time: '5m', title: 'Chop the vegetables', body: 'Dice the tomato and cucumber, halve the olives, then toss everything with the cheese and a drizzle of oil.' },
  },
  {
    id: 'stirfry',
    match: [],
    title: 'Fridge Stir-Fry',
    emoji: '🥘',
    blurb: 'A quick one-pan dish built from whatever you picked',
    ingredients: [
      { emoji: '🧄', label: 'Garlic', qty: '2 cloves' },
      { emoji: '🍅', label: 'Tomato', qty: '1' },
      { emoji: '🧀', label: 'Cheese', qty: '20g' },
    ],
    step: { time: '10m', title: 'Heat the pan', body: 'Warm oil over medium-high heat, add the garlic until fragrant, then add the rest of your picked ingredients and toss for 6–8 minutes.' },
  },
]

function pickRecipe(selectedLabels) {
  const labels = selectedLabels.map((l) => l.toLowerCase())
  for (const recipe of recipeBook) {
    if (recipe.match.length && recipe.match.every((m) => labels.includes(m))) return recipe
  }
  return recipeBook[recipeBook.length - 1]
}

function ClockIcon({ color = '#8A8A8E', size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 11 11">
      <circle cx="5.5" cy="5.5" r="4.8" stroke={color} fill="none" />
      <path d="M5.5 3V5.5L7.3 6.8" stroke={color} strokeWidth="1" />
    </svg>
  )
}

function IngredientCountIcon({ color = '#8A8A8E', size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 11 11">
      <rect x="1" y="1" width="9" height="9" rx="1.5" stroke={color} fill="none" />
      <path d="M3 4h5M3 6h5M3 8h3" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

function DishPhoto({ emoji }) {
  return (
    <div style={{ position: 'relative', width: 130 }}>
      <svg width="130" height="112" viewBox="0 0 150 130" style={{ borderRadius: 18, display: 'block' }}>
        <defs>
          <pattern id="stripe1" width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="#F4F4F4" />
            <rect width="5" height="10" fill="#ECECEC" />
          </pattern>
        </defs>
        <rect width="150" height="130" fill="url(#stripe1)" rx="20" />
        <text x="75" y="70" textAnchor="middle" fontSize="34">
          {emoji}
        </text>
      </svg>
      <svg width="40" height="40" viewBox="0 0 46 46" style={{ position: 'absolute', bottom: -12, right: -12, borderRadius: 999, boxShadow: '0 6px 16px -4px rgba(0,0,0,.15)' }}>
        <defs>
          <pattern id="stripe2" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#fff" />
            <rect width="4" height="8" fill="#F4F4F4" />
          </pattern>
        </defs>
        <circle cx="23" cy="23" r="23" fill="url(#stripe2)" />
      </svg>
    </div>
  )
}

// ---- Recipes tab: AI ask flow + saved cookbook, built from what's in the fridge ----
function RecipesTab({ tab2, setTab2, fridgeItems, view, setView }) {
  const [selected, setSelected] = useState(() => new Set(fridgeItems.map((it) => it.id)))
  const [extras, setExtras] = useState([])
  const [query, setQuery] = useState('')
  const [thinking, setThinking] = useState(false)
  const [recipe, setRecipe] = useState(null)
  const [cookbook, setCookbook] = useState([
    { id: 'c1', title: 'Pancakes', subtitle: 'Classic recipe', time: '1 day ago', ingredients: ['🍓', '🥛', '🍯'] },
    { id: 'c2', title: 'Fresh Salad', subtitle: 'Classic recipe', time: '2 days ago', ingredients: ['🥒', '🍅', '🧅', '🫒', '🧀'] },
    { id: 'c3', title: 'Cheese Sandwich', subtitle: 'Classic recipe', time: '4 days ago', ingredients: ['🍞', '🧀', '🥬', '🌿'] },
  ])

  const stickers = [...fridgeItems.map((it) => ({ ...it, fromFridge: true })), ...extras]

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addExtra = () => {
    const pick = extrasPool[extras.length % extrasPool.length]
    const id = `extra-${extras.length}-${pick.label}`
    setExtras((cur) => [...cur, { id, ...pick, fromFridge: false }])
    setSelected((prev) => new Set(prev).add(id))
  }

  const removeExtra = (id) => {
    setExtras((cur) => cur.filter((it) => it.id !== id))
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const ask = () => {
    const chosenLabels = stickers.filter((it) => selected.has(it.id)).map((it) => it.label)
    setThinking(true)
    setTimeout(() => {
      setRecipe(pickRecipe(chosenLabels))
      setThinking(false)
      setView('result')
    }, 1100)
  }

  const saveToCookbook = () => {
    if (!recipe) return
    setCookbook((cur) => [
      { id: `c-${Date.now()}`, title: recipe.title, subtitle: 'AI generated', time: 'just now', ingredients: recipe.ingredients.map((i) => i.emoji) },
      ...cur,
    ])
    setView('cookbook')
  }

  if (view === 'cookbook') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Your personal cookbook.</div>
            <div style={{ fontSize: 28, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-secondary)' }}>Powered by AI</div>
          </div>
        </div>
        <span
          onClick={() => setView('ask')}
          style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer', display: 'inline-block', marginTop: 12 }}
        >
          ← Ask AI for something new
        </span>

        <div style={{ display: 'flex', gap: 8, marginTop: 28, alignItems: 'center' }}>
          <span
            onClick={() => setTab2('easy')}
            style={{ ...pillStyle(tab2 === 'easy'), fontSize: 13, fontWeight: 500, padding: '8px 16px', borderRadius: 999, cursor: 'pointer', display: 'flex', gap: 4 }}
          >
            Easy<span style={{ opacity: 0.7 }}>15m</span>
          </span>
          <span
            onClick={() => setTab2('standard')}
            style={{ color: tab2 === 'standard' ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13, fontWeight: 500, padding: '8px 6px', cursor: 'pointer' }}
          >
            Standard
          </span>
          <span
            onClick={() => setTab2('pro')}
            style={{ color: tab2 === 'pro' ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13, fontWeight: 500, padding: '8px 6px', cursor: 'pointer' }}
          >
            Pro
          </span>
        </div>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {cookbook.map((entry) => (
            <div
              key={entry.id}
              style={{
                background: 'var(--bg-card)',
                borderRadius: 22,
                boxShadow: '0 4px 20px -4px rgba(0,0,0,.06)',
                border: '1px solid var(--border-subtle)',
                padding: 22,
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <ClockIcon size={12} /> {entry.time}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <IngredientCountIcon size={12} /> {entry.ingredients.length} ingredients
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                {entry.ingredients.map((emoji, i) => (
                  <span key={i} style={{ fontSize: 28 }}>
                    {emoji}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginTop: 16 }}>{entry.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>{entry.subtitle}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (view === 'result' && recipe) {
    return (
      <div>
        <DishPhoto emoji={recipe.emoji} />

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 400, color: 'var(--text-secondary)' }}>Yum! That looks like</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginTop: 2 }}>
            {recipe.title} {recipe.emoji}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4 }}>{recipe.blurb}</div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 20, alignItems: 'center' }}>
          <span
            onClick={() => setTab2('easy')}
            style={{ ...pillStyle(tab2 === 'easy'), fontSize: 11, fontWeight: 500, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', display: 'flex', gap: 4 }}
          >
            Easy<span style={{ opacity: 0.7 }}>15m</span>
          </span>
          <span
            onClick={() => setTab2('standard')}
            style={{ color: tab2 === 'standard' ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 11, fontWeight: 500, padding: '6px 4px', cursor: 'pointer' }}
          >
            Standard
          </span>
          <span
            onClick={() => setTab2('pro')}
            style={{ color: tab2 === 'pro' ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 11, fontWeight: 500, padding: '6px 4px', cursor: 'pointer' }}
          >
            Pro
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, overflowX: 'auto', paddingBottom: 4 }}>
          {recipe.ingredients.map((ing) => (
            <div key={ing.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 'none' }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background: 'var(--bg-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 19,
                }}
              >
                {ing.emoji}
              </div>
              <span style={{ fontSize: 9, color: 'var(--text-primary)', fontWeight: 500 }}>{ing.label}</span>
              <span style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{ing.qty}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', fontSize: 10 }}>
              <ClockIcon /> {recipe.step.time}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{recipe.step.title}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{recipe.step.body}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <button
            onClick={() => setView('ask')}
            style={{
              flex: 1,
              background: 'var(--bg-muted)',
              color: 'var(--text-primary)',
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              padding: '12px 16px',
              borderRadius: 999,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Ask again
          </button>
          <button
            onClick={saveToCookbook}
            style={{
              flex: 1,
              background: '#000',
              color: '#fff',
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              padding: '12px 16px',
              borderRadius: 999,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Save to cookbook
          </button>
        </div>
      </div>
    )
  }

  // 'ask' view
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span onClick={() => setView('cookbook')} style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          My cookbook →
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
        {stickers.map((item) => {
          const isSelected = selected.has(item.id)
          return (
            <div
              key={item.id}
              onClick={() => toggleSelected(item.id)}
              style={{
                position: 'relative',
                background: 'var(--bg-card)',
                borderRadius: 16,
                padding: 10,
                width: 66,
                boxShadow: isSelected ? '0 4px 16px -4px rgba(0,0,0,.15)' : '0 2px 8px -4px rgba(0,0,0,.08)',
                outline: isSelected ? '2px solid var(--text-primary)' : '2px solid transparent',
                opacity: isSelected ? 1 : 0.45,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {!item.fromFridge && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeExtra(item.id)
                  }}
                  style={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    width: 19,
                    height: 19,
                    borderRadius: 999,
                    background: 'var(--text-primary)',
                    color: '#fff',
                    border: 'none',
                    fontSize: 11,
                    lineHeight: '19px',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  ×
                </button>
              )}
              <span style={{ fontSize: 25 }}>{item.emoji}</span>
              <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 500 }}>{item.label}</span>
            </div>
          )
        })}
        <button
          onClick={addExtra}
          style={{
            width: 66,
            minHeight: 66,
            border: '1px dashed var(--text-tertiary)',
            borderRadius: 16,
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 20,
            cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <span style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
          Let's find out <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>what's on your plate</span>
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        {quickPrompts.map((label) => (
          <span
            key={label}
            onClick={() => setQuery(label)}
            style={{
              background: 'var(--bg-muted)',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 500,
              padding: '6px 12px',
              borderRadius: 999,
              cursor: 'pointer',
            }}
          >
            {label}
          </span>
        ))}
      </div>

      <div
        style={{
          marginTop: 20,
          background: 'var(--bg-muted)',
          borderRadius: 26,
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !thinking && ask()}
          placeholder="Describe the dish..."
          style={{
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: 13,
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            padding: '4px 2px',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              background: 'var(--bg-card)',
              boxShadow: '0 1px 4px rgba(0,0,0,.06)',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-primary)',
              padding: '6px 12px',
              borderRadius: 999,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 11 11">
              <path d="M5.5 9V1.5M5.5 1.5L2.5 4.5M5.5 1.5L8.5 4.5" stroke="#171717" strokeWidth="1.2" fill="none" />
              <path d="M0.5 9.5H10.5" stroke="#171717" strokeWidth="1.2" />
            </svg>
            Upload
          </span>
          <button
            onClick={ask}
            disabled={thinking || selected.size === 0}
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              background: '#000',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: thinking || selected.size === 0 ? 'default' : 'pointer',
              opacity: thinking || selected.size === 0 ? 0.5 : 1,
            }}
          >
            {thinking ? (
              <span style={{ display: 'flex', gap: 3 }}>
                <span className="lo-dot" style={{ width: 4, height: 4, borderRadius: 999, background: '#fff' }} />
                <span className="lo-dot" style={{ width: 4, height: 4, borderRadius: 999, background: '#fff', animationDelay: '.2s' }} />
                <span className="lo-dot" style={{ width: 4, height: 4, borderRadius: 999, background: '#fff', animationDelay: '.4s' }} />
              </span>
            ) : (
              <svg width="12" height="12" viewBox="0 0 13 13">
                <path d="M6.5 11V2M6.5 2L2 6.5M6.5 2L11 6.5" stroke="#fff" strokeWidth="1.4" fill="none" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function NavIcon({ name, active }) {
  const color = active ? 'var(--text-primary)' : 'var(--text-tertiary)'
  if (name === 'watch') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 9h16M6 9V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" stroke={color} strokeWidth="1.6" />
        <circle cx="12" cy="14" r="2.4" stroke={color} strokeWidth="1.6" />
      </svg>
    )
  }
  if (name === 'list') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="5" cy="6" r="1.4" fill={color} />
        <circle cx="5" cy="12" r="1.4" fill={color} />
        <circle cx="5" cy="18" r="1.4" fill={color} />
        <path d="M9.5 6h10M9.5 12h10M9.5 18h10" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'expiry') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="13" r="8" stroke={color} strokeWidth="1.6" />
        <path d="M12 9v4l3 2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.5 2.5h5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 3c-1.7 0-3 1.6-3 3.5 0 1 .4 1.9 1 2.5-2 .6-3.5 2.6-3.5 5h11c0-2.4-1.5-4.4-3.5-5 .6-.6 1-1.5 1-2.5C15 4.6 13.7 3 12 3Z" stroke={color} strokeWidth="1.6" />
      <path d="M6.5 19.5h11" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

const tabs = [
  { id: 'watch', label: 'Scan' },
  { id: 'list', label: 'List' },
  { id: 'expiry', label: 'Expiry Countdown' },
  { id: 'recipes', label: 'My Cookbook' },
]

function MenuButton({ open, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Open menu"
      style={{
        width: 34,
        height: 34,
        borderRadius: 999,
        background: 'var(--bg-card)',
        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
        border: open ? '1px solid var(--text-primary)' : '1px solid rgba(0,0,0,.05)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 3,
        padding: 10,
        boxSizing: 'border-box',
        cursor: 'pointer',
      }}
    >
      <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--text-secondary)' }} />
      <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--text-secondary)' }} />
      <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--text-secondary)' }} />
      <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--text-secondary)' }} />
    </button>
  )
}

function NavMenu({ activeTab, onSelect }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        background: 'var(--bg-card)',
        borderRadius: 18,
        boxShadow: '0 12px 32px -8px rgba(0,0,0,.2)',
        border: '1px solid var(--border-subtle)',
        padding: 6,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 208,
        zIndex: 20,
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 12,
            border: 'none',
            background: activeTab === t.id ? 'var(--bg-muted)' : 'transparent',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <NavIcon name={t.id} active={activeTab === t.id} />
          <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', color: activeTab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            {t.label}
          </span>
        </button>
      ))}
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('watch')
  const [menuOpen, setMenuOpen] = useState(false)
  const [scanState, setScanState] = useState('idle')
  const [s1Items, setS1Items] = useState([
    { id: 1, emoji: '🥚', label: 'Eggs', isNew: false },
    { id: 2, emoji: '🍅', label: 'Tomato', isNew: false },
    { id: 3, emoji: '🥬', label: 'Spinach', isNew: true },
    { id: 4, emoji: '🧀', label: 'Cheese', isNew: false },
  ])
  const [nextId, setNextId] = useState(5)
  const [tab2, setTab2] = useState('easy')
  const [tab3, setTab3] = useState('all')
  const [recipeView, setRecipeView] = useState('ask')

  const removeItem = (id) => {
    setS1Items((items) => items.filter((it) => it.id !== id))
  }

  const addItem = () => {
    const pick = pool[s1Items.length % pool.length]
    setS1Items((items) => [...items, { id: nextId, ...pick, isNew: true }])
    setNextId((n) => n + 1)
  }

  const runScan = () => {
    setScanState('scanning')
    setTimeout(() => setScanState('done'), 1400)
  }

  return (
    <div
      className="lo-page"
      style={{
        ...vars,
        minHeight: '100dvh',
        background: 'var(--bg-page)',
        display: 'flex',
        justifyContent: 'center',
        fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif",
      }}
    >
      {/* Responsive website layout: full-width page background, content column that
          scales from a single-column mobile view up to a comfortable reading width
          on desktop instead of being boxed into a fixed phone frame. */}
      <div
        className="lo-app"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 720,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {menuOpen && (
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 9 }}
          />
        )}

        <div
          style={{
            position: 'absolute',
            top: 'calc(16px + env(safe-area-inset-top))',
            right: 'clamp(16px, 4vw, 32px)',
            zIndex: 10,
          }}
        >
          <MenuButton open={menuOpen} onClick={() => setMenuOpen((v) => !v)} />
          {menuOpen && (
            <NavMenu
              activeTab={activeTab}
              onSelect={(id) => {
                setActiveTab(id)
                if (id === 'recipes') setRecipeView('cookbook')
                setMenuOpen(false)
              }}
            />
          )}
        </div>

        <main
          style={{
            flex: 1,
            padding: 'calc(64px + env(safe-area-inset-top)) clamp(16px, 4vw, 32px) calc(24px + env(safe-area-inset-bottom))',
            boxSizing: 'border-box',
          }}
        >
          {activeTab === 'watch' && (
            <WatchTab scanState={scanState} onScan={runScan} items={s1Items} onRemove={removeItem} onAdd={addItem} />
          )}
          {activeTab === 'list' && <ListTab tab3={tab3} setTab3={setTab3} showStoreSuggestion />}
          {activeTab === 'expiry' && <ExpiryTab onAdd={addItem} />}
          {activeTab === 'recipes' && (
            <RecipesTab tab2={tab2} setTab2={setTab2} fridgeItems={s1Items} view={recipeView} setView={setRecipeView} />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
