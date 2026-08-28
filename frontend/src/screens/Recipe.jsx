import { useMemo, useState } from 'react'
import TopBar from '../components/TopBar'
import Button from '../components/Button'
import Icon from '../components/Icon'
import SectionHeader from '../components/SectionHeader'
import { DishScene } from '../components/Illustration'
import { useStore } from '../lib/store'
import { RECIPES } from '../lib/mockData'
import { daysUntilExpiry, isUseSoon } from '../lib/inventory'

function shortFresh(item) {
  const d = daysUntilExpiry(item)
  if (d == null) return null
  if (d <= 0) return 'use today'
  if (d === 1) return 'use in 1d'
  return `use in ${d}d`
}

function Step({ n, text, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`step ${open ? 'is-open' : ''}`}>
      <button type="button" className="step__head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="step__n">{n}</span>
        <span className="step__lead">{text}</span>
        <Icon name="chevron-down" size={18} className="step__chev" />
      </button>
    </div>
  )
}

export default function Recipe({ seedItem }) {
  const { state, dispatch } = useStore()

  const startIdx = useMemo(() => {
    if (!seedItem) return 0
    const i = RECIPES.findIndex((r) => r.uses.includes(seedItem))
    return i < 0 ? 0 : i
  }, [seedItem])

  const [idx, setIdx] = useState(startIdx)
  const [added, setAdded] = useState([]) // names added to list from "you'll need"
  const [addOnUsed, setAddOnUsed] = useState(false)
  const recipe = RECIPES[idx]

  const invByName = useMemo(() => {
    const m = new Map()
    for (const it of state.inventory) m.set(it.name, it)
    return m
  }, [state.inventory])

  const haveCount = recipe.uses.filter((n) => invByName.has(n)).length
  const feedback = state.recipeFeedback.find((f) => f.recipe_title === recipe.title)

  const anotherIdea = () => {
    setIdx((i) => (i + 1) % RECIPES.length)
    setAdded([])
    setAddOnUsed(false)
  }

  const rate = (liked) =>
    dispatch({ type: 'RATE_RECIPE', title: recipe.title, liked, ingredientsUsed: recipe.uses })

  return (
    <div className="screen screen--narrow">
      <TopBar title="Recipe" />

      <div className="screen__scroll">
        <span className="eyebrow recipe__eyebrow">Tonight’s cook</span>
        <h1 className="recipe__title">{recipe.title}</h1>
        <p className="recipe__blurb">{recipe.blurb}</p>

        <p className="meta" style={{ marginBottom: 8 }}>
          Uses up {haveCount} thing{haveCount === 1 ? '' : 's'} you already have
        </p>
        <div className="recipe__uses-line">
          {recipe.uses.map((name) => {
            const item = invByName.get(name)
            const warn = item && isUseSoon(item)
            return (
              <span key={name} className={`use-badge ${warn ? 'use-badge--warn' : ''}`}>
                {warn && <Icon name="clock" size={12} />}
                {name}
                {warn ? ` · ${shortFresh(item)}` : ''}
              </span>
            )
          })}
        </div>

        <div className="recipe__hero">
          <DishScene />
        </div>

        <div className="recipe-cols">
          <div>
            <SectionHeader label="You’ll use" tag="from your fridge" />
            <div className="ing-list">
              {recipe.uses.map((name) => {
                const item = invByName.get(name)
                const warn = item && isUseSoon(item)
                return (
                  <div className="ing" key={name}>
                    <span className="ing__check">
                      <Icon name="check" size={13} />
                    </span>
                    <span className="ing__name">{name}</span>
                    {warn && <span className="ing__tag ing__tag--warn">{shortFresh(item)}</span>}
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <SectionHeader label="You’ll need" tag="not in your fridge" />
            <div className="ing-list">
              {recipe.need.map((name) => {
                const isAdded = added.includes(name)
                return (
                  <div className="ing" key={name}>
                    <span className="ing__dot">
                      <span className="status-dot status-dot--bad" style={{ width: 7, height: 7 }} />
                    </span>
                    <span className="ing__name">{name}</span>
                    <button
                      type="button"
                      className="ing__add"
                      disabled={isAdded}
                      onClick={() => {
                        dispatch({ type: 'ADD_STAPLE', name })
                        setAdded((a) => [...a, name])
                      }}
                    >
                      {isAdded ? 'Added' : 'Add to list'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="addon-card">
          <Icon name="leaf" size={20} className="addon-card__icon" />
          <div>
            <div className="addon-card__title">Add {recipe.addOn.item.toLowerCase()}</div>
            <p className="addon-card__copy">{recipe.addOn.copy}</p>
            <button
              type="button"
              className="addon-card__btn"
              disabled={addOnUsed}
              onClick={() => setAddOnUsed(true)}
            >
              {addOnUsed ? (
                <>
                  <Icon name="check" size={13} /> Added in
                </>
              ) : (
                <>
                  <Icon name="plus" size={13} /> Work it in
                </>
              )}
            </button>
          </div>
        </div>

        <SectionHeader label="Method" tag={`${recipe.minutes} min · serves ${recipe.serves}`} />
        <div>
          {recipe.steps.map((text, i) => (
            <Step key={`${recipe.id}-${i}`} n={i + 1} text={text} defaultOpen={i === 0} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <Button full>
            <Icon name="recipe" size={17} />
            Start cooking
          </Button>
          <Button variant="ghost" onClick={anotherIdea}>
            <Icon name="refresh" size={16} />
            Another
          </Button>
        </div>

        <SectionHeader label="Was this a good call?" />
        <div className="thumbs">
          <button
            type="button"
            className={`thumb ${feedback?.liked === true ? 'is-on--up' : ''}`}
            onClick={() => rate(true)}
          >
            <Icon name="thumb-up" size={18} />
            Cook again
          </button>
          <button
            type="button"
            className={`thumb ${feedback?.liked === false ? 'is-on--down' : ''}`}
            onClick={() => rate(false)}
          >
            <Icon name="thumb-down" size={18} />
            Not for me
          </button>
        </div>
        {feedback && (
          <p className="meta" style={{ textAlign: 'center', marginTop: 12 }}>
            {feedback.liked
              ? 'Noted — yoink! will lean into meals like this.'
              : 'Got it — you’ll see fewer of these.'}
          </p>
        )}
      </div>
    </div>
  )
}
