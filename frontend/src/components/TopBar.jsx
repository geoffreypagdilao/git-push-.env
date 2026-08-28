import Icon from './Icon'
import { useNav } from '../lib/navigation'

// Slim top bar with an optional back affordance and a right-side slot.
export default function TopBar({ title, onBack, right, wordmark = false }) {
  const nav = useNav()
  const handleBack = onBack || nav.back

  return (
    <header className="topbar">
      <div className="topbar__left">
        {(onBack || nav.canGoBack) && (
          <button type="button" className="icon-btn icon-btn--ghost" onClick={handleBack} aria-label="Back">
            <Icon name="arrow-left" size={20} />
          </button>
        )}
        {wordmark ? (
          <span className="wordmark topbar__wordmark">yoink!</span>
        ) : (
          title && <span className="topbar__title">{title}</span>
        )}
      </div>
      <div className="topbar__right">{right}</div>
    </header>
  )
}
