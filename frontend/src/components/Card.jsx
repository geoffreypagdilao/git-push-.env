// Gray-fill rounded container. Separation is fill contrast, not shadow.
// `tappable` adds the lift-on-press micro-interaction and renders a <button>.

export default function Card({ tappable = false, className = '', children, ...rest }) {
  const cls = `card ${tappable ? 'card--tappable' : ''} ${className}`.trim()
  if (tappable) {
    return (
      <button type="button" className={cls} {...rest}>
        {children}
      </button>
    )
  }
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  )
}
