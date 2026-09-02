import Icon from './Icon'
import { useNav } from '../lib/navigation'

// Floating bottom nav — one solid blue pill, icon-only actions.
// "Recipes" and "Cooked" both land on the 'recipe' screen, just with a
// different initialMode prop — so they're matched/highlighted by prop, not
// just screen name, otherwise they'd always show as active together.
const TABS = [
  { screen: 'fridge', icon: 'fridge', label: 'My Fridge' },
  { screen: 'shopping', icon: 'list', label: 'Shopping list' },
  { screen: 'ask', icon: 'message', label: 'Ask AI' },
  { screen: 'recipe', icon: 'recipe', label: 'Recipes' },
  { screen: 'recipe', icon: 'check', label: 'Cooked', props: { initialMode: 'cooked' } },
]

export default function BottomNav() {
  const { current, go } = useNav()
  const isActive = (t) => {
    if (current.name !== t.screen) return false
    const wantMode = t.props?.initialMode || null
    const haveMode = current.props?.initialMode || null
    return wantMode === haveMode
  }
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav__pill">
        {TABS.map((t) => (
          <button
            key={t.label}
            type="button"
            className={`bottom-nav__btn ${isActive(t) ? 'is-active' : ''}`}
            aria-label={t.label}
            aria-current={isActive(t) ? 'page' : undefined}
            onClick={() => go(t.screen, t.props || {})}
          >
            <Icon name={t.icon} size={22} />
          </button>
        ))}
      </div>
    </nav>
  )
}
