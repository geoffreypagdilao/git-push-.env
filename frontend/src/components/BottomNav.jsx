import Icon from './Icon'
import { useNav } from '../lib/navigation'

// Floating bottom nav — one solid blue pill, icon-only actions.
const TABS = [
  { screen: 'fridge', icon: 'fridge', label: 'My Fridge' },
  { screen: 'shopping', icon: 'list', label: 'Shopping list' },
  { screen: 'recipe', icon: 'recipe', label: 'Recipes' },
]

export default function BottomNav() {
  const { current, go } = useNav()
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav__pill">
        {TABS.map((t) => (
          <button
            key={t.screen}
            type="button"
            className={`bottom-nav__btn ${current.name === t.screen ? 'is-active' : ''}`}
            aria-label={t.label}
            aria-current={current.name === t.screen ? 'page' : undefined}
            onClick={() => go(t.screen)}
          >
            <Icon name={t.icon} size={22} />
          </button>
        ))}
      </div>
    </nav>
  )
}
