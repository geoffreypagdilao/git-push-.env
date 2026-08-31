import { useMemo, useState } from 'react'
import Icon from '../components/Icon'
import { DishScene } from '../components/Illustration'
import { useNav } from '../lib/navigation'
import { useStore } from '../lib/store'
import { RECIPES, stickerFor } from '../lib/mockData'

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
  const { state, dispatch } = useStore()

  const startIdx = useMemo(() => {
    if (!seedItem) return 0
    const i = RECIPES.findIndex((r) => r.ingredients.some((ing) => ing.name === seedItem))
    return i < 0 ? 0 : i
  }, [seedItem])

  const [idx, setIdx] = useState(startIdx)
  const [serves, setServes] = useState(RECIPES[startIdx].serves)
  const [added, setAdded] = useState([]) // ingredient names added to the list
  const [cooking, setCooking] = useState(false)

  const recipe = RECIPES[idx]

  const fridgeNames = useMemo(
    () => new Set(state.inventory.map((i) => i.name)),
    [state.inventory],
  )

  const switchRecipe = () => {
    const next = (idx + 1) % RECIPES.length
    setIdx(next)
    setServes(RECIPES[next].serves)
    setAdded([])
    setCooking(false)
  }

  const addToList = (name) => {
    if (added.includes(name)) return
    dispatch({ type: 'ADD_STAPLE', name })
    setAdded((a) => [...a, name])
  }

  const addAll = () => {
    recipe.ingredients
      .filter((ing) => !fridgeNames.has(ing.name) && !added.includes(ing.name))
      .forEach((ing) => addToList(ing.name))
  }

  return (
    <div className="screen recipe2">
      <div className="recipe2__hero">
        {recipe.image ? (
          <img
            className="recipe2__hero-img"
            src={`${import.meta.env.BASE_URL}stickers/${recipe.image}`}
            alt={recipe.title}
            style={recipe.heroScale ? { '--hero-scale': recipe.heroScale } : undefined}
          />
        ) : (
          <DishScene />
        )}
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
            <span className="recipe2__stat-v">{recipe.kcal}</span>
          </div>
        </div>

        <div className="recipe2__ing-head">
          <h2 className="recipe2__h2">Ingredients</h2>
          <button type="button" className="recipe2__addall" onClick={addAll}>
            Add all
          </button>
        </div>
        <div className="recipe2__ing-scroll">
          {recipe.ingredients.map((ing) => (
            <IngredientCard
              key={ing.name}
              ing={ing}
              inFridge={fridgeNames.has(ing.name)}
              added={added.includes(ing.name)}
              onAdd={() => addToList(ing.name)}
            />
          ))}
        </div>

        <h2 className="recipe2__h2 recipe2__steps-head">Cooking Steps</h2>
        <ol className="recipe2__steps">
          {recipe.steps.map((text, i) => (
            <li className="cstep" key={`${recipe.id}-${i}`}>
              <span className="cstep__n">{String(i + 1).padStart(2, '0')}</span>
              <span className="cstep__text">{text}</span>
            </li>
          ))}
        </ol>

        <button type="button" className="recipe2__another" onClick={switchRecipe}>
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
            dispatch({ type: 'RATE_RECIPE', title: recipe.title, liked: true, ingredientsUsed: recipe.ingredients.map((i) => i.name) })
          }}
        >
          {cooking ? 'Cooking' : 'Cook'}
        </button>
      </div>
    </div>
  )
}
