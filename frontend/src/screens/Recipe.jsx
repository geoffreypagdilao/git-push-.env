import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon'
import Button from '../components/Button'
import TopBar from '../components/TopBar'
import Segmented from '../components/Segmented'
import AITextLoading from '../components/AITextLoading'
import { useNav } from '../lib/navigation'
import { useStore } from '../lib/store'
import { addRecipeFeedback, fetchRecipes, generateRecipeImage } from '../lib/api'
import { stickerFor } from '../lib/mockData'

const RECIPE_COUNT = 3

const MODES = [
  { value: 'pantry', label: 'What you have' },
  { value: 'healthy', label: 'Healthy ideas' },
]

// Best-effort scale of a quantity string's leading number by `ratio` (e.g.
// "2 tbsp" at 1.5x -> "3 tbsp"). Leaves anything without a clear leading
// number (e.g. "to taste", "a pinch") untouched — good enough for a display
// estimate, not meant to be exact.
function scaleQty(qty, ratio) {
  if (!qty || ratio === 1) return qty
  const m = qty.match(/^(\d+)\/(\d+)|^(\d+(?:\.\d+)?)/)
  if (!m) return qty
  const value = m[1] ? parseInt(m[1], 10) / parseInt(m[2], 10) : parseFloat(m[3])
  const scaled = Math.round(value * ratio * 100) / 100
  const formatted = Number.isInteger(scaled) ? String(scaled) : String(scaled).replace(/0+$/, '').replace(/\.$/, '')
  return formatted + qty.slice(m[0].length)
}

// Every recipe should end up with a real AI photo — while it's generating,
// show a plain centered spinner (not the ingredient list) so it reads as
// "photo loading", not as a finished visual.
function RecipeHero({ recipe, photoState, onRetry }) {
  if (photoState?.status === 'done') {
    return <img className="recipe2__hero-photo" src={photoState.url} alt={recipe.title} />
  }

  if (photoState?.status === 'error') {
    return (
      <button type="button" className="recipe2__hero-retry" onClick={onRetry}>
        <Icon name="refresh" size={18} />
        Couldn’t load a photo — tap to retry
      </button>
    )
  }

  return (
    <span className="recipe2__hero-spinner" role="status" aria-label="Generating photo">
      <Icon name="sparkle" size={26} />
    </span>
  )
}

function IngredientCard({ ing, inFridge, added, onAdd }) {
  const sticker = stickerFor(ing.name)
  return (
    <div className="ing-card">
      <div className="ing-card__img">
        {sticker ? (
          <img src={`${import.meta.env.BASE_URL}stickers/${sticker}`} alt="" />
        ) : (
          <Icon name="leaf" size={22} />
        )}
        <button
          type="button"
          className={`ing-card__add ${added ? 'is-added' : ''}`}
          aria-label={added ? `${ing.name} added to list` : `Add ${ing.name} to list`}
          onClick={onAdd}
          disabled={added}
        >
          <Icon name={added ? 'check' : 'plus'} size={14} />
        </button>
      </div>
      <div className="ing-card__name" title={ing.name}>
        {ing.name}
      </div>
      <div className="ing-card__qty">
        {ing.qty}
        {!inFridge && !ing.pantry && <span className="ing-card__missing"> · not in fridge</span>}
      </div>
    </div>
  )
}

export default function Recipe({ seedItem }) {
  const nav = useNav()
  const { state, addStaple } = useStore()

  const [mode, setMode] = useState('pantry')
  const [byMode, setByMode] = useState({}) // mode -> { list, error }
  const [loadingMode, setLoadingMode] = useState('pantry')
  const [idx, setIdx] = useState(0)
  const [serves, setServes] = useState(1)
  const [added, setAdded] = useState([])
  const [cooking, setCooking] = useState(false)
  const [doneSteps, setDoneSteps] = useState(new Set())
  const [heroPhotos, setHeroPhotos] = useState({}) // title -> { status: 'loading'|'done'|'error', url? }
  const requestedPhotos = useRef(new Set())

  const loadMode = useCallback((m, seed) => {
    setLoadingMode(m)
    fetchRecipes(RECIPE_COUNT, m)
      .then((result) => {
        const list = result.recipes || []
        setByMode((prev) => ({
          ...prev,
          [m]: { list, error: result.error || list.length === 0 ? result.message || 'No recipes came back.' : null },
        }))
        if (list.length > 0) {
          const target = seed?.toLowerCase()
          const startIdx = target
            ? Math.max(0, list.findIndex((r) => r.ingredients.some((ing) => ing.name.toLowerCase() === target)))
            : 0
          setIdx(startIdx)
          setServes(list[startIdx].serves)
        }
      })
      .catch((err) => {
        setByMode((prev) => ({ ...prev, [m]: { list: [], error: err.message } }))
      })
      .finally(() => setLoadingMode((cur) => (cur === m ? null : cur)))
  }, [])

  useEffect(() => {
    loadMode('pantry', seedItem)
    // only on mount — switching tabs/recipes afterward goes through switchTab/switchRecipe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchTab = (m) => {
    if (m === mode) return
    setMode(m)
    setAdded([])
    setCooking(false)
    setDoneSteps(new Set())
    const existing = byMode[m]
    if (existing) {
      setIdx(0)
      if (existing.list.length > 0) setServes(existing.list[0].serves)
    } else {
      loadMode(m)
    }
  }

  const current = byMode[mode]
  const recipeList = current?.list || []
  const recipe = recipeList[idx] || null
  const isLoading = loadingMode === mode && !current

  // One AI photo per recipe — every recipe should end up with a real photo,
  // not settle for the sticker collage, so a failed attempt is retryable
  // (both automatically once here, and manually via the retry pill below).
  const requestPhoto = useCallback((r) => {
    requestedPhotos.current.add(r.title)
    setHeroPhotos((h) => ({ ...h, [r.title]: { status: 'loading' } }))
    generateRecipeImage({
      title: r.title,
      blurb: r.blurb,
      ingredients: r.ingredients.map((ing) => ing.name),
    })
      .then((result) => {
        setHeroPhotos((h) => ({
          ...h,
          [r.title]: result.image ? { status: 'done', url: result.image } : { status: 'error' },
        }))
      })
      .catch((err) => {
        console.error('Failed to generate recipe image:', err)
        setHeroPhotos((h) => ({ ...h, [r.title]: { status: 'error' } }))
      })
  }, [])

  useEffect(() => {
    if (!recipe || requestedPhotos.current.has(recipe.title)) return
    requestPhoto(recipe)
  }, [recipe, requestPhoto])

  const photoState = recipe ? heroPhotos[recipe.title] : null

  const retryPhoto = () => {
    if (!recipe) return
    requestedPhotos.current.delete(recipe.title)
    requestPhoto(recipe)
  }

  const fridgeNames = useMemo(
    () => new Set(state.inventory.map((i) => i.name.toLowerCase())),
    [state.inventory],
  )

  const switchRecipe = () => {
    if (recipeList.length < 2) return
    const next = (idx + 1) % recipeList.length
    setIdx(next)
    setServes(recipeList[next].serves)
    setAdded([])
    setCooking(false)
    setDoneSteps(new Set())
  }

  const toggleStep = (i) => {
    setDoneSteps((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const addToList = (name) => {
    if (added.includes(name)) return
    addStaple(name)
    setAdded((a) => [...a, name])
  }

  const addAll = () => {
    if (!recipe) return
    recipe.ingredients
      .filter((ing) => !fridgeNames.has(ing.name.toLowerCase()) && !added.includes(ing.name))
      .forEach((ing) => addToList(ing.name))
  }

  const ratio = recipe && recipe.serves ? serves / recipe.serves : 1
  const scaledIngredients = recipe
    ? recipe.ingredients.map((ing) => ({ ...ing, qty: scaleQty(ing.qty, ratio) }))
    : []
  const scaledKcal = recipe ? Math.max(0, Math.round(recipe.kcal * ratio)) : 0

  const tabs = (
    <div className="recipe2__tabs">
      <Segmented options={MODES} value={mode} onChange={switchTab} />
    </div>
  )

  if (isLoading) {
    return (
      <div className="screen screen--narrow">
        <TopBar title="Recipe ideas" onBack={() => nav.go('fridge')} />
        <div className="screen__scroll">
          {tabs}
          <AITextLoading />
        </div>
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="screen screen--narrow">
        <TopBar title="Recipe ideas" onBack={() => nav.go('fridge')} />
        <div className="screen__scroll">
          {tabs}
          <p className="muted-note">{current?.error || 'No recipes to show yet.'}</p>
          <Button variant="ghost" onClick={() => loadMode(mode, seedItem)} style={{ marginTop: 12 }}>
            <Icon name="refresh" size={15} />
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen recipe2">
      <div className="recipe2__hero">
        <RecipeHero recipe={recipe} photoState={photoState} onRetry={retryPhoto} />
        <button
          type="button"
          className="recipe2__float recipe2__float--left"
          aria-label="Back to My Fridge"
          onClick={() => nav.go('fridge')}
        >
          <Icon name="arrow-left" size={20} />
        </button>
        <button
          type="button"
          className="recipe2__float recipe2__float--right"
          aria-label="Save recipe"
        >
          <Icon name="bookmark" size={18} />
        </button>
      </div>

      <div className="screen__scroll recipe2__body">
        {tabs}
        <h1 className="recipe2__title">{recipe.title}</h1>
        <p className="recipe2__desc">{recipe.blurb}</p>

        <div className="recipe2__stats">
          <div className="recipe2__stat">
            <span className="recipe2__stat-k">Skill Level</span>
            <span className="recipe2__stat-v">{recipe.skill}</span>
          </div>
          <div className="recipe2__stat">
            <span className="recipe2__stat-k">Cook Time</span>
            <span className="recipe2__stat-v">{recipe.minutes}m</span>
          </div>
          <div className="recipe2__stat">
            <span className="recipe2__stat-k">Ingredients</span>
            <span className="recipe2__stat-v">{recipe.ingredients.length}</span>
          </div>
          <div className="recipe2__stat">
            <span className="recipe2__stat-k">Est. Calories</span>
            <span className="recipe2__stat-v">{scaledKcal}</span>
          </div>
        </div>

        <div className="recipe2__ing-head">
          <h2 className="recipe2__h2">Ingredients</h2>
          <button type="button" className="recipe2__addall" onClick={addAll}>
            Add all
          </button>
        </div>
        <div className="recipe2__ing-scroll">
          {scaledIngredients.map((ing) => (
            <IngredientCard
              key={ing.name}
              ing={ing}
              inFridge={fridgeNames.has(ing.name.toLowerCase())}
              added={added.includes(ing.name)}
              onAdd={() => addToList(ing.name)}
            />
          ))}
        </div>

        <div className="recipe2__ing-head recipe2__steps-head">
          <h2 className="recipe2__h2">Cooking Steps</h2>
          <span className="recipe2__hint">Tick when you're done</span>
        </div>
        <ol className="recipe2__steps">
          {recipe.steps.map((text, i) => {
            const done = doneSteps.has(i)
            return (
              <li className={`cstep ${done ? 'is-done' : ''}`} key={i}>
                <button
                  type="button"
                  className="cstep__check"
                  aria-label={done ? `Mark step ${i + 1} not done` : `Mark step ${i + 1} done`}
                  aria-pressed={done}
                  onClick={() => toggleStep(i)}
                >
                  {done && <Icon name="check" size={13} />}
                </button>
                <span className="cstep__n">{String(i + 1).padStart(2, '0')}</span>
                <span className="cstep__text">{text}</span>
              </li>
            )
          })}
        </ol>

        <button type="button" className="recipe2__another" onClick={switchRecipe} disabled={recipeList.length < 2}>
          <Icon name="refresh" size={15} />
          Show another idea
        </button>
      </div>

      <div className="recipe2__bar">
        <div className="recipe2__serves">
          <button
            type="button"
            aria-label="Fewer servings"
            onClick={() => setServes((s) => Math.max(1, s - 1))}
          >
            <Icon name="minus" size={15} />
          </button>
          <span>Cooking for {serves}</span>
          <button type="button" aria-label="More servings" onClick={() => setServes((s) => s + 1)}>
            <Icon name="plus" size={15} />
          </button>
        </div>
        <button
          type="button"
          className="recipe2__ask"
          onClick={() => nav.push('ask')}
        >
          <Icon name="sparkle" size={15} />
          Ask
        </button>
        <button
          type="button"
          className="recipe2__cook"
          onClick={() => {
            setCooking(true)
            addRecipeFeedback({
              recipeTitle: recipe.title,
              liked: true,
              ingredientsUsed: recipe.ingredients.map((i) => i.name),
            }).catch((err) => console.error('Failed to record recipe feedback:', err))
          }}
        >
          {cooking ? 'Cooking' : 'Cook'}
        </button>
      </div>
    </div>
  )
}
