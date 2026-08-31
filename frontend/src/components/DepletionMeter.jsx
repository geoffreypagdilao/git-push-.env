// Thin bar: how much stock is left against the learned consumption rate.
// Colour tracks the item status so it reads at a glance.

export default function DepletionMeter({ fraction = 1, status = 'good' }) {
  const pct = Math.round(Math.max(0.04, Math.min(1, fraction)) * 100)
  return (
    <div className="meter" role="img" aria-label={`About ${pct}% of a typical stock left`}>
      <span className={`meter__fill meter__fill--${status}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
